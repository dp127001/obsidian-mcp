-- SQLite Knowledge Graph Schema
-- Optimized for CL methodology and semantic reasoning
-- Version: 1.0 (Phase 1)

-- =====================================================
-- Core Knowledge Nodes (notes/entities)
-- =====================================================
CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    state TEXT NOT NULL CHECK (state IN ('plasma', 'fluid', 'gel', 'crystal')),
    confidence TEXT NOT NULL CHECK (confidence IN ('low', 'medium', 'high')),
    content_hash TEXT NOT NULL,        -- SHA-256 for change detection
    created_at DATETIME NOT NULL,
    modified_at DATETIME NOT NULL,
    authority_weight REAL DEFAULT 0.0, -- Calculated based on dependents
    content_summary TEXT,              -- AI-generated summary for search
    vault_name TEXT NOT NULL,          -- Multi-vault support
    file_size INTEGER DEFAULT 0,       -- File size in bytes
    line_count INTEGER DEFAULT 0       -- Number of lines in content
);

-- =====================================================
-- Semantic Relationships between nodes
-- =====================================================
CREATE TABLE IF NOT EXISTS semantic_edges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id INTEGER NOT NULL,
    target_id INTEGER NOT NULL,
    relation_type TEXT NOT NULL,       -- 'depends_on', 'implements', 'conflicts_with', etc.
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    evidence TEXT,                     -- JSON array of supporting text snippets
    inferred BOOLEAN DEFAULT FALSE,    -- TRUE if auto-detected, FALSE if explicit
    created_at DATETIME NOT NULL,
    modified_at DATETIME NOT NULL,
    weight REAL DEFAULT 1.0,          -- Relationship strength
    validation_status TEXT DEFAULT 'unvalidated', -- 'validated', 'disputed', 'unvalidated'
    FOREIGN KEY (source_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY (target_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    UNIQUE(source_id, target_id, relation_type)
);

-- =====================================================
-- Semantic Entities (extracted concepts)
-- =====================================================
CREATE TABLE IF NOT EXISTS semantic_entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    entity_type TEXT NOT NULL,         -- 'project', 'decision', 'technology', 'person'
    description TEXT,
    authority_node_id INTEGER,         -- Which node is authoritative for this entity
    confidence REAL DEFAULT 0.5,
    vault_name TEXT NOT NULL,
    created_at DATETIME NOT NULL,
    modified_at DATETIME NOT NULL,
    mention_count INTEGER DEFAULT 0,   -- How many times this entity is mentioned
    FOREIGN KEY (authority_node_id) REFERENCES knowledge_nodes(id) ON DELETE SET NULL
);

-- =====================================================
-- Entity Mentions (where entities appear in notes)
-- =====================================================
CREATE TABLE IF NOT EXISTS entity_mentions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_id INTEGER NOT NULL,
    node_id INTEGER NOT NULL,
    mention_text TEXT NOT NULL,        -- Exact text that mentions the entity
    context TEXT,                      -- Surrounding paragraph
    confidence REAL NOT NULL,          -- 0.0-1.0 confidence in this mention
    position_start INTEGER,            -- Character position in note
    position_end INTEGER,
    mention_type TEXT DEFAULT 'reference', -- 'definition', 'reference', 'usage'
    created_at DATETIME NOT NULL,
    FOREIGN KEY (entity_id) REFERENCES semantic_entities(id) ON DELETE CASCADE,
    FOREIGN KEY (node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

-- =====================================================
-- State History (track knowledge evolution)
-- =====================================================
CREATE TABLE IF NOT EXISTS state_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL,
    from_state TEXT,
    to_state TEXT NOT NULL,
    from_confidence TEXT,
    to_confidence TEXT NOT NULL,
    reason TEXT,
    evidence_quality REAL DEFAULT 0.5, -- How strong the evidence was
    transition_date DATETIME NOT NULL,
    user_id TEXT,                      -- Who made the change (future)
    FOREIGN KEY (node_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

-- =====================================================
-- Sync Metadata (track sync operations)
-- =====================================================
CREATE TABLE IF NOT EXISTS sync_metadata (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vault_name TEXT NOT NULL,
    sync_start DATETIME NOT NULL,
    sync_end DATETIME,
    status TEXT NOT NULL,              -- 'running', 'completed', 'failed'
    notes_processed INTEGER DEFAULT 0,
    notes_added INTEGER DEFAULT 0,
    notes_updated INTEGER DEFAULT 0,
    notes_deleted INTEGER DEFAULT 0,
    relationships_found INTEGER DEFAULT 0,
    error_message TEXT
);

-- =====================================================
-- Full-text search support
-- =====================================================
CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_search USING fts5(
    path, title, content_summary, state, confidence, vault_name,
    content='knowledge_nodes',
    content_rowid='id'
);

-- =====================================================
-- Performance Indexes
-- =====================================================

-- Node indexes for common queries
CREATE INDEX IF NOT EXISTS idx_nodes_state_confidence ON knowledge_nodes(state, confidence);
CREATE INDEX IF NOT EXISTS idx_nodes_vault ON knowledge_nodes(vault_name);
CREATE INDEX IF NOT EXISTS idx_nodes_modified ON knowledge_nodes(modified_at);
CREATE INDEX IF NOT EXISTS idx_nodes_authority ON knowledge_nodes(authority_weight DESC);
CREATE INDEX IF NOT EXISTS idx_nodes_hash ON knowledge_nodes(content_hash);

-- Edge indexes for relationship queries
CREATE INDEX IF NOT EXISTS idx_edges_source ON semantic_edges(source_id);
CREATE INDEX IF NOT EXISTS idx_edges_target ON semantic_edges(target_id);
CREATE INDEX IF NOT EXISTS idx_edges_relation_type ON semantic_edges(relation_type);
CREATE INDEX IF NOT EXISTS idx_edges_confidence ON semantic_edges(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_edges_weight ON semantic_edges(weight DESC);

-- Entity indexes
CREATE INDEX IF NOT EXISTS idx_entities_type ON semantic_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_entities_vault ON semantic_entities(vault_name);
CREATE INDEX IF NOT EXISTS idx_entities_authority ON semantic_entities(authority_node_id);
CREATE INDEX IF NOT EXISTS idx_entities_mentions ON semantic_entities(mention_count DESC);

-- Mention indexes
CREATE INDEX IF NOT EXISTS idx_mentions_entity ON entity_mentions(entity_id);
CREATE INDEX IF NOT EXISTS idx_mentions_node ON entity_mentions(node_id);
CREATE INDEX IF NOT EXISTS idx_mentions_confidence ON entity_mentions(confidence DESC);

-- History indexes
CREATE INDEX IF NOT EXISTS idx_history_node ON state_history(node_id);
CREATE INDEX IF NOT EXISTS idx_history_date ON state_history(transition_date);

-- Sync indexes
CREATE INDEX IF NOT EXISTS idx_sync_vault ON sync_metadata(vault_name);
CREATE INDEX IF NOT EXISTS idx_sync_status ON sync_metadata(status);

-- =====================================================
-- Database Triggers for Automatic Updates
-- =====================================================

-- Update FTS index when nodes are modified
CREATE TRIGGER IF NOT EXISTS fts_nodes_update 
AFTER UPDATE ON knowledge_nodes
BEGIN
    INSERT INTO knowledge_search(knowledge_search, rowid, path, title, content_summary, state, confidence, vault_name)
    VALUES('delete', OLD.id, OLD.path, OLD.title, OLD.content_summary, OLD.state, OLD.confidence, OLD.vault_name);
    INSERT INTO knowledge_search(rowid, path, title, content_summary, state, confidence, vault_name)
    VALUES(NEW.id, NEW.path, NEW.title, NEW.content_summary, NEW.state, NEW.confidence, NEW.vault_name);
END;

-- Insert into FTS when nodes are created
CREATE TRIGGER IF NOT EXISTS fts_nodes_insert 
AFTER INSERT ON knowledge_nodes
BEGIN
    INSERT INTO knowledge_search(rowid, path, title, content_summary, state, confidence, vault_name)
    VALUES(NEW.id, NEW.path, NEW.title, NEW.content_summary, NEW.state, NEW.confidence, NEW.vault_name);
END;

-- Remove from FTS when nodes are deleted
CREATE TRIGGER IF NOT EXISTS fts_nodes_delete 
BEFORE DELETE ON knowledge_nodes
BEGIN
    INSERT INTO knowledge_search(knowledge_search, rowid, path, title, content_summary, state, confidence, vault_name)
    VALUES('delete', OLD.id, OLD.path, OLD.title, OLD.content_summary, OLD.state, OLD.confidence, OLD.vault_name);
END;

-- Update entity mention count when mentions are added/removed
CREATE TRIGGER IF NOT EXISTS update_mention_count_insert
AFTER INSERT ON entity_mentions
BEGIN
    UPDATE semantic_entities 
    SET mention_count = mention_count + 1,
        modified_at = datetime('now')
    WHERE id = NEW.entity_id;
END;

CREATE TRIGGER IF NOT EXISTS update_mention_count_delete
AFTER DELETE ON entity_mentions
BEGIN
    UPDATE semantic_entities 
    SET mention_count = mention_count - 1,
        modified_at = datetime('now')
    WHERE id = OLD.entity_id;
END;

-- =====================================================
-- Views for Common Queries
-- =====================================================

-- Authority hierarchy view
CREATE VIEW IF NOT EXISTS authority_hierarchy AS
SELECT 
    n.id,
    n.path,
    n.title,
    n.state,
    n.confidence,
    n.authority_weight,
    COUNT(se.target_id) as dependent_count,
    n.vault_name
FROM knowledge_nodes n
LEFT JOIN semantic_edges se ON n.id = se.target_id
GROUP BY n.id, n.path, n.title, n.state, n.confidence, n.authority_weight, n.vault_name
ORDER BY n.authority_weight DESC, dependent_count DESC;

-- Knowledge evolution view
CREATE VIEW IF NOT EXISTS knowledge_evolution AS
SELECT 
    n.id,
    n.path,
    n.title,
    n.state,
    sh.from_state,
    sh.to_state,
    sh.transition_date,
    sh.reason,
    sh.evidence_quality
FROM knowledge_nodes n
JOIN state_history sh ON n.id = sh.node_id
ORDER BY sh.transition_date DESC;

-- Relationship network view
CREATE VIEW IF NOT EXISTS relationship_network AS
SELECT 
    source.path as source_path,
    source.title as source_title,
    source.state as source_state,
    se.relation_type,
    target.path as target_path,
    target.title as target_title,
    target.state as target_state,
    se.confidence,
    se.weight,
    se.inferred
FROM semantic_edges se
JOIN knowledge_nodes source ON se.source_id = source.id
JOIN knowledge_nodes target ON se.target_id = target.id
ORDER BY se.weight DESC, se.confidence DESC;

-- =====================================================
-- Database Pragmas for Performance
-- =====================================================

-- Optimize for performance and reliability
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = 10000;
PRAGMA temp_store = memory;
PRAGMA mmap_size = 268435456; -- 256MB
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Type definitions for CL methodology
export type CLState = 'plasma' | 'fluid' | 'gel' | 'crystal';
export type CLConfidence = 'low' | 'medium' | 'high';

export interface KnowledgeNode {
    id?: number;
    path: string;
    title: string;
    state: CLState;
    confidence: CLConfidence;
    content_hash: string;
    created_at: string;
    modified_at: string;
    authority_weight: number;
    content_summary?: string;
    vault_name: string;
    file_size: number;
    line_count: number;
}

export interface SemanticEdge {
    id?: number;
    source_id: number;
    target_id: number;
    relation_type: string;
    confidence: number;
    evidence?: string;
    inferred: boolean;
    created_at: string;
    modified_at: string;
    weight: number;
    validation_status: string;
}

export interface SemanticEntity {
    id?: number;
    name: string;
    entity_type: string;
    description?: string;
    authority_node_id?: number;
    confidence: number;
    vault_name: string;
    created_at: string;
    modified_at: string;
    mention_count: number;
}

export interface StateTransition {
    id?: number;
    node_id: number;
    from_state?: string;
    to_state: string;
    from_confidence?: string;
    to_confidence: string;
    reason?: string;
    evidence_quality: number;
    transition_date: string;
    user_id?: string;
}

export interface SyncMetadata {
    id?: number;
    vault_name: string;
    sync_start: string;
    sync_end?: string;
    status: 'running' | 'completed' | 'failed';
    notes_processed: number;
    notes_added: number;
    notes_updated: number;
    notes_deleted: number;
    relationships_found: number;
    error_message?: string;
}

export interface KnowledgeGraphConfig {
    dbPath: string;
    vaultPath: string;
    vaultName: string;
    autoSync: boolean;
    batchSize: number;
    enableWAL: boolean;
    pragmas?: Record<string, string | number>;
}

/**
 * SQLite Knowledge Graph Database Manager
 * Handles all database operations for the CL knowledge graph
 */
export class KnowledgeGraphDatabase {
    private db: Database.Database;
    private config: KnowledgeGraphConfig;
    private isInitialized: boolean = false;

    constructor(config: KnowledgeGraphConfig) {
        this.config = config;
        
        // Initialize database with performance optimizations
        this.db = new Database(config.dbPath, {
            verbose: process.env.NODE_ENV === 'development' ? console.log : undefined
        });
        
        this.initializeDatabase();
    }

    /**
     * Initialize database schema and apply performance settings
     */
    private initializeDatabase(): void {
        try {
            // Apply performance pragmas
            this.applyPragmas();
            
            // Load and execute schema
            this.executeSchema();
            
            // Verify schema integrity
            this.verifySchema();
            
            this.isInitialized = true;
            console.log(`Knowledge graph database initialized: ${this.config.dbPath}`);
        } catch (error) {
            throw new Error(`Failed to initialize knowledge graph database: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Apply SQLite performance pragmas
     */
    private applyPragmas(): void {
        const defaultPragmas = {
            foreign_keys: 'ON',
            journal_mode: this.config.enableWAL ? 'WAL' : 'DELETE',
            synchronous: 'NORMAL',
            cache_size: 10000,
            temp_store: 'memory',
            mmap_size: 268435456 // 256MB
        };

        const pragmas = { ...defaultPragmas, ...this.config.pragmas };

        for (const [key, value] of Object.entries(pragmas)) {
            this.db.pragma(`${key} = ${value}`);
        }
    }

    /**
     * Load and execute the database schema
     */
    private executeSchema(): void {
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
        const schemaPath = join(__dirname, 'schema.sql');
        
        const schema = readFileSync(schemaPath, 'utf-8');
        this.db.exec(schema);
    }

    /**
     * Verify database schema is correctly installed
     */
    private verifySchema(): void {
        const requiredTables = [
            'knowledge_nodes',
            'semantic_edges', 
            'semantic_entities',
            'entity_mentions',
            'state_history',
            'sync_metadata',
            'knowledge_search'
        ];

        for (const table of requiredTables) {
            const result = this.db.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name=?
            `).get(table);

            if (!result) {
                throw new Error(`Required table '${table}' not found in database`);
            }
        }

        // Verify FTS table is working
        try {
            this.db.prepare("SELECT * FROM knowledge_search LIMIT 1").all();
        } catch (error) {
            throw new Error(`FTS table 'knowledge_search' is not properly configured: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Close database connection
     */
    close(): void {
        if (this.db) {
            this.db.close();
            this.isInitialized = false;
        }
    }

    /**
     * Get database instance for direct queries
     */
    getDatabase(): Database.Database {
        if (!this.isInitialized) {
            throw new Error('Database not initialized');
        }
        return this.db;
    }

    // =====================================================
    // Knowledge Node Operations
    // =====================================================

    /**
     * Insert new knowledge node
     */
    insertNode(node: Omit<KnowledgeNode, 'id'>): number {
        const stmt = this.db.prepare(`
            INSERT INTO knowledge_nodes 
            (path, title, state, confidence, content_hash, created_at, modified_at, 
             authority_weight, content_summary, vault_name, file_size, line_count)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            node.path,
            node.title,
            node.state,
            node.confidence,
            node.content_hash,
            node.created_at,
            node.modified_at,
            node.authority_weight,
            node.content_summary || null,
            node.vault_name,
            node.file_size,
            node.line_count
        );

        return result.lastInsertRowid as number;
    }

    /**
     * Update existing knowledge node
     */
    updateNode(id: number, updates: Partial<KnowledgeNode>): void {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updates[field as keyof KnowledgeNode]);

        const stmt = this.db.prepare(`
            UPDATE knowledge_nodes 
            SET ${setClause}, modified_at = datetime('now')
            WHERE id = ?
        `);

        stmt.run(...values, id);
    }

    /**
     * Get node by ID
     */
    getNodeById(id: number): KnowledgeNode | null {
        const stmt = this.db.prepare(`
            SELECT * FROM knowledge_nodes WHERE id = ?
        `);
        return stmt.get(id) as KnowledgeNode | null;
    }

    /**
     * Get node by path
     */
    getNodeByPath(path: string, vaultName: string): KnowledgeNode | null {
        const stmt = this.db.prepare(`
            SELECT * FROM knowledge_nodes 
            WHERE path = ? AND vault_name = ?
        `);
        return stmt.get(path, vaultName) as KnowledgeNode | null;
    }

    /**
     * Get nodes by state
     */
    getNodesByState(state: CLState, vaultName?: string): KnowledgeNode[] {
        let query = `SELECT * FROM knowledge_nodes WHERE state = ?`;
        const params: any[] = [state];

        if (vaultName) {
            query += ` AND vault_name = ?`;
            params.push(vaultName);
        }

        query += ` ORDER BY authority_weight DESC, modified_at DESC`;

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as KnowledgeNode[];
    }

    /**
     * Delete node and all related data
     */
    deleteNode(id: number): void {
        // Foreign key constraints will handle cascading deletes
        const stmt = this.db.prepare(`DELETE FROM knowledge_nodes WHERE id = ?`);
        stmt.run(id);
    }

    // =====================================================
    // Semantic Edge Operations  
    // =====================================================

    /**
     * Insert semantic relationship
     */
    insertEdge(edge: Omit<SemanticEdge, 'id'>): number {
        const stmt = this.db.prepare(`
            INSERT INTO semantic_edges 
            (source_id, target_id, relation_type, confidence, evidence, inferred,
             created_at, modified_at, weight, validation_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            edge.source_id,
            edge.target_id,
            edge.relation_type,
            edge.confidence,
            edge.evidence || null,
            edge.inferred ? 1 : 0,  // Convert boolean to integer
            edge.created_at,
            edge.modified_at,
            edge.weight,
            edge.validation_status
        );

        return result.lastInsertRowid as number;
    }

    /**
     * Get edges for a node (both incoming and outgoing)
     */
    getEdgesForNode(nodeId: number): { outgoing: SemanticEdge[]; incoming: SemanticEdge[] } {
        const outgoing = this.db.prepare(`
            SELECT * FROM semantic_edges WHERE source_id = ?
            ORDER BY weight DESC, confidence DESC
        `).all(nodeId) as SemanticEdge[];

        const incoming = this.db.prepare(`
            SELECT * FROM semantic_edges WHERE target_id = ?
            ORDER BY weight DESC, confidence DESC  
        `).all(nodeId) as SemanticEdge[];

        return { outgoing, incoming };
    }

    /**
     * Get relationships by type
     */
    getEdgesByType(relationType: string, vaultName?: string): SemanticEdge[] {
        let query = `
            SELECT se.* FROM semantic_edges se
            JOIN knowledge_nodes n ON se.source_id = n.id
            WHERE se.relation_type = ?
        `;
        const params: any[] = [relationType];

        if (vaultName) {
            query += ` AND n.vault_name = ?`;
            params.push(vaultName);
        }

        query += ` ORDER BY se.weight DESC, se.confidence DESC`;

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as SemanticEdge[];
    }

    // =====================================================
    // State History Operations
    // =====================================================

    /**
     * Record state transition
     */
    recordStateTransition(transition: Omit<StateTransition, 'id'>): number {
        const stmt = this.db.prepare(`
            INSERT INTO state_history 
            (node_id, from_state, to_state, from_confidence, to_confidence, 
             reason, evidence_quality, transition_date, user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(
            transition.node_id,
            transition.from_state || null,
            transition.to_state,
            transition.from_confidence || null,
            transition.to_confidence,
            transition.reason || null,
            transition.evidence_quality,
            transition.transition_date,
            transition.user_id || null
        );

        return result.lastInsertRowid as number;
    }

    /**
     * Get state history for node
     */
    getStateHistory(nodeId: number): StateTransition[] {
        const stmt = this.db.prepare(`
            SELECT * FROM state_history 
            WHERE node_id = ? 
            ORDER BY transition_date DESC
        `);
        return stmt.all(nodeId) as StateTransition[];
    }

    // =====================================================
    // Sync Operations
    // =====================================================

    /**
     * Start sync operation
     */
    startSync(vaultName: string): number {
        const stmt = this.db.prepare(`
            INSERT INTO sync_metadata 
            (vault_name, sync_start, status, notes_processed, notes_added, 
             notes_updated, notes_deleted, relationships_found)
            VALUES (?, datetime('now'), 'running', 0, 0, 0, 0, 0)
        `);

        const result = stmt.run(vaultName);
        return result.lastInsertRowid as number;
    }

    /**
     * Update sync progress
     */
    updateSyncProgress(syncId: number, updates: Partial<SyncMetadata>): void {
        const fields = Object.keys(updates).filter(key => key !== 'id');
        const setClause = fields.map(field => `${field} = ?`).join(', ');
        const values = fields.map(field => updates[field as keyof SyncMetadata]);

        const stmt = this.db.prepare(`
            UPDATE sync_metadata 
            SET ${setClause}
            WHERE id = ?
        `);

        stmt.run(...values, syncId);
    }

    /**
     * Complete sync operation
     */
    completeSync(syncId: number, status: 'completed' | 'failed', errorMessage?: string): void {
        const stmt = this.db.prepare(`
            UPDATE sync_metadata 
            SET status = ?, sync_end = datetime('now'), error_message = ?
            WHERE id = ?
        `);

        stmt.run(status, errorMessage || null, syncId);
    }

    // =====================================================
    // Utility Operations
    // =====================================================

    /**
     * Generate content hash for change detection
     */
    static generateContentHash(content: string): string {
        return crypto.createHash('sha256').update(content).digest('hex');
    }

    /**
     * Get database statistics
     */
    getStatistics(vaultName?: string): Record<string, number> {
        const stats: Record<string, number> = {};

        let whereClause = '';
        const params: any[] = [];
        if (vaultName) {
            whereClause = ' WHERE vault_name = ?';
            params.push(vaultName);
        }

        // Node counts by state
        const stateCounts = this.db.prepare(`
            SELECT state, COUNT(*) as count 
            FROM knowledge_nodes${whereClause}
            GROUP BY state
        `).all(...params) as Array<{ state: string; count: number }>;

        for (const { state, count } of stateCounts) {
            stats[`${state}_nodes`] = count;
        }

        // Total counts
        const totalNodesResult = this.db.prepare(`SELECT COUNT(*) as count FROM knowledge_nodes${whereClause}`).get(...params) as { count: number } | undefined;
        stats.total_nodes = totalNodesResult?.count || 0;
        
        const totalEdgesResult = this.db.prepare(`
            SELECT COUNT(*) as count FROM semantic_edges se
            JOIN knowledge_nodes n ON se.source_id = n.id${whereClause}
        `).get(...params) as { count: number } | undefined;
        stats.total_edges = totalEdgesResult?.count || 0;
        
        const totalEntitiesResult = this.db.prepare(`SELECT COUNT(*) as count FROM semantic_entities${whereClause}`).get(...params) as { count: number } | undefined;
        stats.total_entities = totalEntitiesResult?.count || 0;

        return stats;
    }

    /**
     * Execute database maintenance
     */
    maintain(): void {
        // Update FTS index
        this.db.prepare("INSERT INTO knowledge_search(knowledge_search) VALUES('rebuild')").run();
        
        // Analyze for query optimization
        this.db.prepare("ANALYZE").run();
        
        // Vacuum if not using WAL mode
        if (!this.config.enableWAL) {
            this.db.prepare("VACUUM").run();
        }
    }
}
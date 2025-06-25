import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { KnowledgeGraphDatabase, KnowledgeNode, SemanticEdge, StateTransition } from './database.js';
import { unlink } from 'fs/promises';
import { existsSync } from 'fs';

const TEST_DB_PATH = './test-knowledge-graph.db';
const TEST_CONFIG = {
    dbPath: TEST_DB_PATH,
    vaultPath: './test-vault',
    vaultName: 'test-vault',
    autoSync: false,
    batchSize: 10,
    enableWAL: true
};

describe('KnowledgeGraphDatabase', () => {
    let db: KnowledgeGraphDatabase;

    beforeEach(() => {
        // Clean up any existing test database
        if (existsSync(TEST_DB_PATH)) {
            try { 
                require('fs').unlinkSync(TEST_DB_PATH);
            } catch (e) { /* ignore */ }
        }
        
        db = new KnowledgeGraphDatabase(TEST_CONFIG);
    });

    afterEach(async () => {
        if (db) {
            db.close();
        }
        
        // Clean up test database
        try {
            if (existsSync(TEST_DB_PATH)) {
                await unlink(TEST_DB_PATH);
            }
        } catch (e) {
            // Ignore cleanup errors
        }
    });

    describe('Database Initialization', () => {
        test('should initialize database with all required tables', () => {
            const database = db.getDatabase();
            
            const tables = database.prepare(`
                SELECT name FROM sqlite_master 
                WHERE type='table' AND name NOT LIKE 'sqlite_%'
                ORDER BY name
            `).all() as Array<{ name: string }>;

            const tableNames = tables.map(t => t.name);
            
            expect(tableNames).toContain('knowledge_nodes');
            expect(tableNames).toContain('semantic_edges');
            expect(tableNames).toContain('semantic_entities');
            expect(tableNames).toContain('entity_mentions');
            expect(tableNames).toContain('state_history');
            expect(tableNames).toContain('sync_metadata');
            expect(tableNames).toContain('knowledge_search');
        });

        test('should have proper foreign key constraints enabled', () => {
            const database = db.getDatabase();
            const result = database.pragma('foreign_keys', { simple: true });
            expect(result).toBe(1); // Foreign keys enabled
        });

        test('should have WAL mode enabled when configured', () => {
            const database = db.getDatabase();
            const result = database.pragma('journal_mode', { simple: true });
            expect(result).toBe('wal');
        });
    });

    describe('Knowledge Node Operations', () => {
        const testNode: Omit<KnowledgeNode, 'id'> = {
            path: 'test/sample-note.md',
            title: 'Sample Test Note',
            state: 'fluid',
            confidence: 'medium',
            content_hash: KnowledgeGraphDatabase.generateContentHash('test content'),
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            authority_weight: 0.0,
            content_summary: 'A test note for validation',
            vault_name: 'test-vault',
            file_size: 1024,
            line_count: 42
        };

        test('should insert new knowledge node', () => {
            const nodeId = db.insertNode(testNode);
            expect(nodeId).toBeGreaterThan(0);
            
            const retrieved = db.getNodeById(nodeId);
            expect(retrieved).toBeTruthy();
            expect(retrieved?.title).toBe(testNode.title);
            expect(retrieved?.state).toBe(testNode.state);
        });

        test('should retrieve node by path', () => {
            const nodeId = db.insertNode(testNode);
            
            const retrieved = db.getNodeByPath(testNode.path, testNode.vault_name);
            expect(retrieved).toBeTruthy();
            expect(retrieved?.id).toBe(nodeId);
            expect(retrieved?.title).toBe(testNode.title);
        });

        test('should update existing node', () => {
            const nodeId = db.insertNode(testNode);
            
            const updates = {
                title: 'Updated Title',
                state: 'gel' as const,
                confidence: 'high' as const
            };
            
            db.updateNode(nodeId, updates);
            
            const updated = db.getNodeById(nodeId);
            expect(updated?.title).toBe('Updated Title');
            expect(updated?.state).toBe('gel');
            expect(updated?.confidence).toBe('high');
        });

        test('should get nodes by state', () => {
            // Insert multiple nodes with different states
            const fluidNode = { ...testNode, path: 'test/fluid.md', state: 'fluid' as const };
            const gelNode = { ...testNode, path: 'test/gel.md', state: 'gel' as const };
            
            db.insertNode(fluidNode);
            db.insertNode(gelNode);
            
            const fluidNodes = db.getNodesByState('fluid');
            const gelNodes = db.getNodesByState('gel');
            
            expect(fluidNodes).toHaveLength(1);
            expect(gelNodes).toHaveLength(1);
            expect(fluidNodes[0].state).toBe('fluid');
            expect(gelNodes[0].state).toBe('gel');
        });

        test('should delete node and related data', () => {
            const nodeId = db.insertNode(testNode);
            
            db.deleteNode(nodeId);
            
            const retrieved = db.getNodeById(nodeId);
            expect(retrieved).toBeNull();
        });
    });

    describe('Semantic Edge Operations', () => {
        let sourceNodeId: number;
        let targetNodeId: number;

        beforeEach(() => {
            const sourceNode: Omit<KnowledgeNode, 'id'> = {
                path: 'test/source.md',
                title: 'Source Node',
                state: 'gel',
                confidence: 'medium',
                content_hash: KnowledgeGraphDatabase.generateContentHash('source content'),
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                authority_weight: 0.0,
                vault_name: 'test-vault',
                file_size: 512,
                line_count: 20
            };

            const targetNode: Omit<KnowledgeNode, 'id'> = {
                path: 'test/target.md',
                title: 'Target Node',
                state: 'crystal',
                confidence: 'high',
                content_hash: KnowledgeGraphDatabase.generateContentHash('target content'),
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                authority_weight: 1.0,
                vault_name: 'test-vault',
                file_size: 256,
                line_count: 10
            };

            sourceNodeId = db.insertNode(sourceNode);
            targetNodeId = db.insertNode(targetNode);
        });

        test('should insert semantic edge', () => {
            const edge: Omit<SemanticEdge, 'id'> = {
                source_id: sourceNodeId,
                target_id: targetNodeId,
                relation_type: 'depends_on',
                confidence: 0.9,
                evidence: 'WikiLink found in source note',
                inferred: false,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                weight: 1.0,
                validation_status: 'unvalidated'
            };

            const edgeId = db.insertEdge(edge);
            expect(edgeId).toBeGreaterThan(0);
        });

        test('should get edges for node', () => {
            const edge: Omit<SemanticEdge, 'id'> = {
                source_id: sourceNodeId,
                target_id: targetNodeId,
                relation_type: 'implements',
                confidence: 0.8,
                inferred: false,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                weight: 1.0,
                validation_status: 'unvalidated'
            };

            db.insertEdge(edge);

            const sourceEdges = db.getEdgesForNode(sourceNodeId);
            const targetEdges = db.getEdgesForNode(targetNodeId);

            expect(sourceEdges.outgoing).toHaveLength(1);
            expect(sourceEdges.incoming).toHaveLength(0);
            expect(targetEdges.outgoing).toHaveLength(0);
            expect(targetEdges.incoming).toHaveLength(1);
        });

        test('should get edges by relation type', () => {
            const dependsEdge: Omit<SemanticEdge, 'id'> = {
                source_id: sourceNodeId,
                target_id: targetNodeId,
                relation_type: 'depends_on',
                confidence: 0.9,
                inferred: false,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                weight: 1.0,
                validation_status: 'unvalidated'
            };

            const implementsEdge: Omit<SemanticEdge, 'id'> = {
                source_id: targetNodeId,
                target_id: sourceNodeId,
                relation_type: 'implements',
                confidence: 0.7,
                inferred: false,
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                weight: 0.8,
                validation_status: 'unvalidated'
            };

            db.insertEdge(dependsEdge);
            db.insertEdge(implementsEdge);

            const dependsEdges = db.getEdgesByType('depends_on');
            const implementsEdges = db.getEdgesByType('implements');

            expect(dependsEdges).toHaveLength(1);
            expect(implementsEdges).toHaveLength(1);
            expect(dependsEdges[0].relation_type).toBe('depends_on');
            expect(implementsEdges[0].relation_type).toBe('implements');
        });
    });

    describe('State History Operations', () => {
        let nodeId: number;

        beforeEach(() => {
            const node: Omit<KnowledgeNode, 'id'> = {
                path: 'test/evolving-note.md',
                title: 'Evolving Note',
                state: 'fluid',
                confidence: 'low',
                content_hash: KnowledgeGraphDatabase.generateContentHash('initial content'),
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                authority_weight: 0.0,
                vault_name: 'test-vault',
                file_size: 128,
                line_count: 5
            };

            nodeId = db.insertNode(node);
        });

        test('should record state transition', () => {
            const transition: Omit<StateTransition, 'id'> = {
                node_id: nodeId,
                from_state: 'fluid',
                to_state: 'gel',
                from_confidence: 'low',
                to_confidence: 'medium',
                reason: 'Sufficient evidence gathered',
                evidence_quality: 0.8,
                transition_date: new Date().toISOString(),
                user_id: 'test-user'
            };

            const transitionId = db.recordStateTransition(transition);
            expect(transitionId).toBeGreaterThan(0);
        });

        test('should get state history for node', () => {
            // Record multiple transitions
            const transition1: Omit<StateTransition, 'id'> = {
                node_id: nodeId,
                to_state: 'gel',
                to_confidence: 'medium',
                reason: 'Initial promotion',
                evidence_quality: 0.7,
                transition_date: new Date().toISOString()
            };

            const transition2: Omit<StateTransition, 'id'> = {
                node_id: nodeId,
                from_state: 'gel',
                to_state: 'crystal',
                from_confidence: 'medium',
                to_confidence: 'high',
                reason: 'Full validation completed',
                evidence_quality: 0.95,
                transition_date: new Date().toISOString()
            };

            db.recordStateTransition(transition1);
            db.recordStateTransition(transition2);

            const history = db.getStateHistory(nodeId);
            expect(history).toHaveLength(2);
            expect(history[0].to_state).toBe('crystal'); // Most recent first
            expect(history[1].to_state).toBe('gel');
        });
    });

    describe('Utility Functions', () => {
        test('should generate consistent content hashes', () => {
            const content = 'This is test content for hashing';
            const hash1 = KnowledgeGraphDatabase.generateContentHash(content);
            const hash2 = KnowledgeGraphDatabase.generateContentHash(content);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex length
        });

        test('should generate different hashes for different content', () => {
            const content1 = 'First content';
            const content2 = 'Second content';
            
            const hash1 = KnowledgeGraphDatabase.generateContentHash(content1);
            const hash2 = KnowledgeGraphDatabase.generateContentHash(content2);
            
            expect(hash1).not.toBe(hash2);
        });

        test('should get database statistics', () => {
            // Insert test data
            const node1: Omit<KnowledgeNode, 'id'> = {
                path: 'test/node1.md',
                title: 'Node 1',
                state: 'fluid',
                confidence: 'medium',
                content_hash: KnowledgeGraphDatabase.generateContentHash('content 1'),
                created_at: new Date().toISOString(),
                modified_at: new Date().toISOString(),
                authority_weight: 0.0,
                vault_name: 'test-vault',
                file_size: 100,
                line_count: 5
            };

            const node2: Omit<KnowledgeNode, 'id'> = {
                ...node1,
                path: 'test/node2.md',
                title: 'Node 2',
                state: 'gel'
            };

            const nodeId1 = db.insertNode(node1);
            const nodeId2 = db.insertNode(node2);

            const stats = db.getStatistics('test-vault');
            
            expect(stats.total_nodes).toBe(2);
            expect(stats.fluid_nodes).toBe(1);
            expect(stats.gel_nodes).toBe(1);
        });
    });

    describe('Sync Operations', () => {
        test('should manage sync lifecycle', () => {
            const syncId = db.startSync('test-vault');
            expect(syncId).toBeGreaterThan(0);

            // Update progress
            db.updateSyncProgress(syncId, {
                notes_processed: 10,
                notes_added: 5,
                notes_updated: 3,
                relationships_found: 15
            });

            // Complete sync
            db.completeSync(syncId, 'completed');

            // Verify sync record
            const database = db.getDatabase();
            const syncRecord = database.prepare('SELECT * FROM sync_metadata WHERE id = ?').get(syncId) as any;
            
            expect(syncRecord).toBeTruthy();
            expect(syncRecord.status).toBe('completed');
            expect(syncRecord.notes_processed).toBe(10);
            expect(syncRecord.sync_end).toBeTruthy();
        });
    });
});
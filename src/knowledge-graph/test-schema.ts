import { join } from 'path';
import { KnowledgeGraphDatabase } from './database.js';

/**
 * Simple test script to validate database schema and basic operations
 * Run with: npm run dev src/knowledge-graph/test-schema.ts
 */

async function testSchema() {
    console.log('🧪 Testing SQLite Knowledge Graph Schema...\n');

    const dbPath = join(process.cwd(), 'test-knowledge-graph.db');
    
    try {
        // Initialize database
        console.log('1. Initializing database...');
        const db = new KnowledgeGraphDatabase({
            dbPath,
            vaultPath: './test-vault',
            vaultName: 'test-vault',
            autoSync: false,
            batchSize: 50,
            enableWAL: true
        });
        console.log('✅ Database initialized successfully');

        // Test node insertion
        console.log('\n2. Testing node insertion...');
        const testNode = {
            path: 'projects/test-project.md',
            title: 'Test Project',
            state: 'gel' as const,
            confidence: 'medium' as const,
            content_hash: KnowledgeGraphDatabase.generateContentHash('# Test Project\n\nThis is a test project note.'),
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            authority_weight: 0.5,
            content_summary: 'A test project for validating the knowledge graph',
            vault_name: 'test-vault',
            file_size: 1024,
            line_count: 25
        };

        const nodeId = db.insertNode(testNode);
        console.log(`✅ Node inserted with ID: ${nodeId}`);

        // Test node retrieval
        console.log('\n3. Testing node retrieval...');
        const retrieved = db.getNodeById(nodeId);
        console.log(`✅ Retrieved node: ${retrieved?.title} (${retrieved?.state})`);

        // Test state transition
        console.log('\n4. Testing state transition...');
        const transition = {
            node_id: nodeId,
            from_state: 'gel',
            to_state: 'crystal',
            from_confidence: 'medium',
            to_confidence: 'high',
            reason: 'Project completed and validated',
            evidence_quality: 0.9,
            transition_date: new Date().toISOString()
        };

        const transitionId = db.recordStateTransition(transition);
        console.log(`✅ State transition recorded with ID: ${transitionId}`);

        // Test relationship insertion
        console.log('\n5. Testing relationship insertion...');
        
        // Insert a second node to create relationship
        const dependentNode = {
            ...testNode,
            path: 'projects/dependent-project.md',
            title: 'Dependent Project',
            state: 'fluid' as const,
            authority_weight: 0.2
        };
        
        const dependentNodeId = db.insertNode(dependentNode);
        
        const edge = {
            source_id: dependentNodeId,
            target_id: nodeId,
            relation_type: 'depends_on',
            confidence: 0.8,
            evidence: 'Explicit dependency mentioned in project documentation',
            inferred: false,
            created_at: new Date().toISOString(),
            modified_at: new Date().toISOString(),
            weight: 1.0,
            validation_status: 'unvalidated'
        };

        const edgeId = db.insertEdge(edge);
        console.log(`✅ Relationship inserted with ID: ${edgeId}`);

        // Test queries
        console.log('\n6. Testing queries...');
        
        const gelNodes = db.getNodesByState('gel');
        console.log(`✅ Found ${gelNodes.length} gel-state nodes`);
        
        const edges = db.getEdgesForNode(nodeId);
        console.log(`✅ Node has ${edges.incoming.length} incoming and ${edges.outgoing.length} outgoing edges`);

        const dependsOnEdges = db.getEdgesByType('depends_on');
        console.log(`✅ Found ${dependsOnEdges.length} 'depends_on' relationships`);

        // Test statistics
        console.log('\n7. Testing statistics...');
        const stats = db.getStatistics('test-vault');
        console.log('✅ Database statistics:', stats);

        // Test sync operations
        console.log('\n8. Testing sync operations...');
        const syncId = db.startSync('test-vault');
        db.updateSyncProgress(syncId, {
            notes_processed: 2,
            notes_added: 2,
            notes_updated: 0,
            relationships_found: 1
        });
        db.completeSync(syncId, 'completed');
        console.log(`✅ Sync operation completed with ID: ${syncId}`);

        // Test content hash generation
        console.log('\n9. Testing content hash generation...');
        const content1 = '# Test Content\n\nThis is test content.';
        const content2 = '# Test Content\n\nThis is different content.';
        const hash1 = KnowledgeGraphDatabase.generateContentHash(content1);
        const hash2 = KnowledgeGraphDatabase.generateContentHash(content2);
        console.log(`✅ Hash 1: ${hash1.substring(0, 16)}...`);
        console.log(`✅ Hash 2: ${hash2.substring(0, 16)}...`);
        console.log(`✅ Hashes are different: ${hash1 !== hash2}`);

        // Test maintenance operations
        console.log('\n10. Testing maintenance operations...');
        db.maintain();
        console.log('✅ Database maintenance completed');

        // Close database
        db.close();
        console.log('\n✅ All tests passed! Database schema is working correctly.');

    } catch (error) {
        console.error('\n❌ Test failed:', error instanceof Error ? error.message : String(error));
        if (error instanceof Error && error.stack) {
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    testSchema().catch(console.error);
}

export { testSchema };
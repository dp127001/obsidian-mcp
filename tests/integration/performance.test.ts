// tests/integration/performance.test.ts
describe('Performance Requirements', () => {
    test('crystal cache lookup under 50ms', async () => {
        const db = new CLStateDatabase('./test-vault');
        
        const start = Date.now();
        const results = db.searchByState('crystal');
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(50);
        expect(results).toBeDefined();
    });
    
    test('note creation under 200ms', async () => {
        const fs = new AtomicFilesystemInterface('./test-vault');
        
        const start = Date.now();
        await fs.createNoteWithChunking('test.md', 'Test', 'Content');
        const duration = Date.now() - start;
        
        expect(duration).toBeLessThan(200);
    });
});

test('chunking triggers for large content', async () => {
    const largeContent = 'x'.repeat(1000);
    const result = await fs.createNoteWithChunking('large.md', 'Large Note', largeContent);
    
    expect(result.chunking_applied).toBe(true);
    expect(result.chunks_created).toBeGreaterThan(1);
    expect(result.success).toBe(true);
});
import { testSchema } from './build/knowledge-graph/test-schema.js';

testSchema().then(() => {
    console.log('Test completed successfully');
    process.exit(0);
}).catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
import { CLErrorFactory } from "../src/utils/enhanced-errors.js";
import { McpError } from "@modelcontextprotocol/sdk/types.js";

/**
 * Test suite for enhanced error messages
 */
describe('Enhanced Error Messages', () => {
  
  test('State validation error includes CL methodology guidance', () => {
    const error = CLErrorFactory.stateValidationError('invalid-state', 'create note');
    
    expect(error).toBeInstanceOf(McpError);
    expect(error.message).toContain('Cannot create note');
    expect(error.message).toContain('[plasma, fluid, gel, crystal]');
    expect(error.message).toContain('Remediation:');
    expect(error.message).toContain('CL Methodology:');
    expect(error.message).toContain('Examples:');
    expect(error.message.length).toBeGreaterThan(300); // Substantial enhancement
  });

  test('Confidence validation error provides clear guidance', () => {
    const error = CLErrorFactory.confidenceValidationError('maybe', 'update state');
    
    expect(error.message).toContain('Cannot update state');
    expect(error.message).toContain('[low, medium, high]');
    expect(error.message).toContain('Confidence levels indicate certainty');
    expect(error.message).toContain('Examples:');
  });

  test('State transition error explains CL methodology rules', () => {
    const error = CLErrorFactory.stateTransitionError('fluid', 'crystal', 'insufficient evidence', 'medium');
    
    expect(error.message).toContain('Cannot transition fluid→crystal');
    expect(error.message).toContain('evidence hierarchy');
    expect(error.message).toContain('Remediation:');
    expect(error.message).toContain('CL Methodology:');
  });

  test('Authority conflict error explains one-crystal rule', () => {
    const error = CLErrorFactory.authorityConflictError('database-design', 'architecture/db.md');
    
    expect(error.message).toContain('Cannot create second crystal-state note');
    expect(error.message).toContain('One Crystal Rule');
    expect(error.message).toContain('architecture/db.md');
    expect(error.message).toContain('cl_update_note');
  });

  test('Path security error maintains security while being helpful', () => {
    const error = CLErrorFactory.pathSecurityError('../../../etc/passwd');
    
    expect(error.message).toContain('escapes vault boundaries');
    expect(error.message).toContain('Security constraints protect');
    expect(error.message).toContain('vault-relative paths');
    expect(error.message).toContain('Examples:');
  });

  test('Vault access error lists available options', () => {
    const error = CLErrorFactory.vaultAccessError('missing-vault', ['personal', 'work', 'research']);
    
    expect(error.message).toContain('vault \'missing-vault\' does not exist');
    expect(error.message).toContain('Available vaults: [personal, work, research]');
    expect(error.message).toContain('case-sensitive');
  });

  test('Performance warning provides optimization guidance', () => {
    const error = CLErrorFactory.performanceWarningError('search operation', 5500, 10000);
    
    expect(error.message).toContain('taking longer than expected (5500ms)');
    expect(error.message).toContain('10000+ notes');
    expect(error.message).toContain('path_filter parameter');
    expect(error.message).toContain('crystal, gel');
  });

  test('Note not found error provides helpful context', () => {
    const error = CLErrorFactory.noteNotFoundError('missing/note.md', 'personal');
    
    expect(error.message).toContain('does not exist in vault "personal"');
    expect(error.message).toContain('cl_create_note');
    expect(error.message).toContain('search: cl_search_by_state');
  });

  test('Note exists error provides clear alternatives', () => {
    const error = CLErrorFactory.noteExistsError('existing/note.md');
    
    expect(error.message).toContain('note already exists');
    expect(error.message).toContain('cl_update_note');
    expect(error.message).toContain('cl_update_state');
    expect(error.message).toContain('prevents accidental overwriting');
  });

  test('Missing field error provides field-specific guidance', () => {
    const error = CLErrorFactory.missingFieldError('title', 'create note');
    
    expect(error.message).toContain('required field \'title\' is missing');
    expect(error.message).toContain('Descriptive title helps identify');
    expect(error.message).toContain('knowledge graph');
  });

  test('All enhanced errors meet quality criteria', () => {
    const testCases = [
      CLErrorFactory.stateValidationError('wrong', 'create'),
      CLErrorFactory.confidenceValidationError('bad', 'update'),
      CLErrorFactory.stateTransitionError('fluid', 'crystal', 'no reason'),
      CLErrorFactory.authorityConflictError('topic', 'path.md'),
      CLErrorFactory.pathSecurityError('../bad/path'),
      CLErrorFactory.vaultAccessError('bad', ['good']),
      CLErrorFactory.noteNotFoundError('missing.md', 'vault'),
      CLErrorFactory.noteExistsError('existing.md'),
      CLErrorFactory.missingFieldError('field', 'operation')
    ];

    testCases.forEach(error => {
      expect(error.message).toContain('Cannot'); // Specific problem identification
      expect(error.message.includes('Remediation:') || error.message.length > 200).toBe(true); // Actionable steps
      expect(error.message.length).toBeGreaterThan(150); // Substantial content
      expect(error).toBeInstanceOf(McpError); // Proper error type
    });
  });

  test('Performance characteristics are acceptable', () => {
    const startTime = performance.now();
    
    // Generate 100 enhanced error messages
    for (let i = 0; i < 100; i++) {
      CLErrorFactory.stateValidationError('invalid', 'operation');
    }
    
    const endTime = performance.now();
    const avgTime = (endTime - startTime) / 100;
    
    expect(avgTime).toBeLessThan(5); // Less than 5ms per error message
  });
});

// Manual test runner for development
function runManualTests() {
  console.log('🧪 Testing Enhanced Error Messages\n');

  // Test 1: State validation
  console.log('1. State Validation Error:');
  try {
    throw CLErrorFactory.stateValidationError('wrong-state', 'create note');
  } catch (error) {
    if (error instanceof McpError) {
      console.log(error.message);
      console.log(`Length: ${error.message.length} characters\n`);
    }
  }

  // Test 2: State transition
  console.log('2. State Transition Error:');
  try {
    throw CLErrorFactory.stateTransitionError('fluid', 'crystal', 'insufficient evidence', 'medium');
  } catch (error) {
    if (error instanceof McpError) {
      console.log(error.message);
      console.log(`Length: ${error.message.length} characters\n`);
    }
  }

  // Test 3: Authority conflict
  console.log('3. Authority Conflict Error:');
  try {
    throw CLErrorFactory.authorityConflictError('database-architecture', 'architecture/database-design.md');
  } catch (error) {
    if (error instanceof McpError) {
      console.log(error.message);
      console.log(`Length: ${error.message.length} characters\n`);
    }
  }

  console.log('✅ Enhanced error message testing complete');
}

// Export for Node.js testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runManualTests };
} else if (typeof process !== 'undefined' && process.argv && process.argv[1]?.includes('enhanced-error-tests')) {
  // Run manual tests if called directly
  runManualTests();
}

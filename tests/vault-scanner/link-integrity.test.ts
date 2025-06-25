import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { LinkAnalyzer } from '../../src/tools/vault-scanner/link-analyzer.js';
import { LinkUpdater } from '../../src/tools/vault-scanner/link-updater.js';
import { createLinkRepairTool } from '../../src/tools/vault-scanner/link-repair-tool.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import { tmpdir } from 'os';

describe('Link Integrity Analysis', () => {
  let testVaultPath: string;
  let linkAnalyzer: LinkAnalyzer;
  let linkUpdater: LinkUpdater;

  beforeEach(async () => {
    // Create temporary test vault
    testVaultPath = await fs.mkdtemp(path.join(tmpdir(), 'obsidian-test-'));
    linkAnalyzer = new LinkAnalyzer(testVaultPath);
    linkUpdater = new LinkUpdater(testVaultPath);
  });

  afterEach(async () => {
    // Clean up test vault
    try {
      await fs.rm(testVaultPath, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up test vault:', error);
    }
  });

  describe('Broken Link Detection', () => {
    test('detects broken WikiLinks', async () => {
      // Create note with broken link
      await createTestNote('source.md', 'This links to [[NonExistentNote]] which does not exist.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.broken_links).toHaveLength(1);
      expect(analysis.broken_links[0].target_link).toBe('NonExistentNote');
      expect(analysis.broken_links[0].source_note).toBe('source.md');
      expect(analysis.valid_links).toBe(0);
      expect(analysis.link_health_score).toBe(0);
    });

    test('identifies valid WikiLinks', async () => {
      await createTestNote('target.md', '# Target Note\nThis is the target note.');
      await createTestNote('source.md', 'This links to [[target]] which exists.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.valid_links).toBe(1);
      expect(analysis.broken_links).toHaveLength(0);
      expect(analysis.link_health_score).toBe(1);
    });

    test('handles links with aliases', async () => {
      await createTestNote('target.md', '# Target Note\nContent here.');
      await createTestNote('source.md', 'Link with [[target|custom alias]] text.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.valid_links).toBe(1);
      expect(analysis.broken_links).toHaveLength(0);
    });

    test('detects links to files in subdirectories', async () => {
      await fs.mkdir(path.join(testVaultPath, 'projects'), { recursive: true });
      await createTestNote('projects/project-note.md', '# Project Note');
      await createTestNote('index.md', 'Reference to [[projects/project-note]] here.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.valid_links).toBe(1);
      expect(analysis.broken_links).toHaveLength(0);
    });

    test('suggests potential matches for broken links', async () => {
      await createTestNote('target-note.md', '# Target Note');
      await createTestNote('source.md', 'Links to [[target note]] with spaces instead of hyphens.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.broken_links).toHaveLength(1);
      expect(analysis.broken_links[0].potential_matches).toBeDefined();
      expect(analysis.broken_links[0].potential_matches![0].file_path).toBe('target-note.md');
      expect(analysis.broken_links[0].potential_matches![0].similarity_score).toBeGreaterThan(0.8);
    });

    test('resolves links by title from frontmatter', async () => {
      await createTestNote('note-with-title.md', `---
title: "Custom Title"
---
# Custom Title
Content here.`);
      await createTestNote('source.md', 'Link to [[Custom Title]] using title.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.valid_links).toBe(1);
      expect(analysis.broken_links).toHaveLength(0);
    });
  });

  describe('Similarity Matching', () => {
    test('calculates string similarity correctly', async () => {
      await createTestNote('javascript-basics.md', '# JavaScript Basics');
      await createTestNote('source.md', 'Link to [[JavaScript Basic]] - typo in link.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.broken_links).toHaveLength(1);
      const match = analysis.broken_links[0].potential_matches![0];
      expect(match.similarity_score).toBeGreaterThan(0.9);
      expect(match.file_path).toBe('javascript-basics.md');
    });

    test('handles case insensitive matching', async () => {
      await createTestNote('Important-Note.md', '# Important Note');
      await createTestNote('source.md', 'Link to [[important note]] in lowercase.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.broken_links).toHaveLength(1);
      const match = analysis.broken_links[0].potential_matches![0];
      expect(match.similarity_score).toBeGreaterThan(0.8);
    });

    test('limits potential matches to top 3', async () => {
      // Create multiple similar files
      await createTestNote('note-1.md', '# Note One');
      await createTestNote('note-2.md', '# Note Two');
      await createTestNote('note-3.md', '# Note Three');
      await createTestNote('note-4.md', '# Note Four');
      await createTestNote('source.md', 'Link to [[note]] without number.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.broken_links).toHaveLength(1);
      expect(analysis.broken_links[0].potential_matches).toHaveLength(3);
    });
  });

  describe('Link Statistics and Health', () => {
    test('calculates link health scores correctly', async () => {
      await createTestNote('valid-target.md', '# Valid Target');
      await createTestNote('mixed-links.md', `# Mixed Links
Valid link: [[valid-target]]
Broken link: [[nonexistent]]
Another valid: [[valid-target]]
Another broken: [[also-missing]]`);
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.total_links).toBe(4);
      expect(analysis.valid_links).toBe(2);
      expect(analysis.broken_links).toHaveLength(2);
      expect(analysis.link_health_score).toBe(0.5);
    });

    test('identifies most connected notes', async () => {
      await createTestNote('target1.md', '# Target 1');
      await createTestNote('target2.md', '# Target 2');
      await createTestNote('target3.md', '# Target 3');
      await createTestNote('hub-note.md', `# Hub Note
Links to [[target1]], [[target2]], and [[target3]].
Also [[target1]] again and [[target2]] repeated.`);
      await createTestNote('simple-note.md', 'Only links to [[target1]].');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.most_connected_notes).toHaveLength(2);
      expect(analysis.most_connected_notes[0].note_path).toBe('hub-note.md');
      expect(analysis.most_connected_notes[0].outbound_links).toBe(5);
      expect(analysis.most_connected_notes[0].valid_outbound).toBe(5);
    });

    test('tracks notes needing repair', async () => {
      await createTestNote('good-note.md', 'Links to [[target]].');
      await createTestNote('target.md', '# Target');
      await createTestNote('broken-note.md', 'Links to [[missing]] file.');
      
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      
      expect(analysis.notes_with_broken_links).toContain('broken-note.md');
      expect(analysis.notes_with_broken_links).not.toContain('good-note.md');
    });
  });

  describe('Link Update Operations', () => {
    test('updates references after file move', async () => {
      await createTestNote('original.md', '# Original Note');
      await createTestNote('source.md', 'Reference to [[original]] note.');
      
      // Simulate file move
      const oldPath = path.join(testVaultPath, 'original.md');
      const newPath = path.join(testVaultPath, 'moved.md');
      
      const result = await linkUpdater.updateReferencesAfterMove(oldPath, newPath);
      
      expect(result.totalNotesProcessed).toBe(1);
      expect(result.successfulUpdates).toBe(1);
      expect(result.totalLinksUpdated).toBe(1);
      
      // Verify content was updated
      const updatedContent = await fs.readFile(path.join(testVaultPath, 'source.md'), 'utf-8');
      expect(updatedContent).toContain('[[moved]]');
      expect(updatedContent).not.toContain('[[original]]');
    });

    test('applies individual link fix', async () => {
      await createTestNote('actual-target.md', '# Actual Target');
      await createTestNote('source.md', 'Broken link to [[wrong-target]] here.');
      
      const fix = {
        source_note: 'source.md',
        broken_link: 'wrong-target',
        suggested_target: 'actual-target.md',
        confidence: 0.9,
        fix_type: 'fuzzy_match' as const
      };
      
      const result = await linkUpdater.applyLinkFix(fix);
      
      expect(result.success).toBe(true);
      expect(result.source_note).toBe('source.md');
      expect(result.new_link).toBe('actual-target.md');
      
      // Verify fix was applied
      const content = await fs.readFile(path.join(testVaultPath, 'source.md'), 'utf-8');
      expect(content).toContain('[[actual-target]]');
      expect(content).not.toContain('[[wrong-target]]');
    });

    test('validates fixes before applying', async () => {
      await createTestNote('source.md', 'Some content here.');
      
      const invalidFix = {
        source_note: 'source.md',
        broken_link: 'nonexistent-link',
        suggested_target: 'also-nonexistent.md',
        confidence: 0.8,
        fix_type: 'fuzzy_match' as const
      };
      
      const validation = await linkUpdater.validateFix(invalidFix);
      
      expect(validation.isValid).toBe(false);
      expect(validation.reason).toContain('Target note does not exist');
    });
  });

  describe('Bulk Fix Operations', () => {
    test('applies multiple fixes with backup', async () => {
      await createTestNote('target1.md', '# Target 1');
      await createTestNote('target2.md', '# Target 2');
      await createTestNote('source.md', 'Links to [[target-1]] and [[target-2]].');
      
      const fixes = [
        {
          source_note: 'source.md',
          broken_link: 'target-1',
          suggested_target: 'target1.md',
          confidence: 0.9,
          fix_type: 'fuzzy_match' as const
        },
        {
          source_note: 'source.md',
          broken_link: 'target-2',
          suggested_target: 'target2.md',
          confidence: 0.9,
          fix_type: 'fuzzy_match' as const
        }
      ];
      
      const result = await linkUpdater.applyBulkFixes(fixes, true);
      
      expect(result.successful_fixes).toBe(2);
      expect(result.failed_fixes).toBe(0);
      expect(result.backup_created).toBeTruthy();
      
      // Verify both fixes were applied
      const content = await fs.readFile(path.join(testVaultPath, 'source.md'), 'utf-8');
      expect(content).toContain('[[target1]]');
      expect(content).toContain('[[target2]]');
    });

    test('handles partial failures gracefully', async () => {
      await createTestNote('existing-target.md', '# Existing Target');
      await createTestNote('source.md', 'Link to [[broken-link]].');
      
      const fixes = [
        {
          source_note: 'source.md',
          broken_link: 'broken-link',
          suggested_target: 'existing-target.md',
          confidence: 0.9,
          fix_type: 'fuzzy_match' as const
        },
        {
          source_note: 'source.md',
          broken_link: 'another-broken',
          suggested_target: 'nonexistent.md',
          confidence: 0.8,
          fix_type: 'fuzzy_match' as const
        }
      ];
      
      const result = await linkUpdater.applyBulkFixes(fixes, false);
      
      expect(result.successful_fixes).toBe(1);
      expect(result.failed_fixes).toBe(1);
      expect(result.fixes_applied[0].success).toBe(true);
      expect(result.fixes_applied[1].success).toBe(false);
    });
  });

  describe('Performance with Large Vaults', () => {
    test('analyzes large number of notes within reasonable time', async () => {
      // Create 100 notes with interconnected links
      const noteCount = 100;
      
      for (let i = 0; i < noteCount; i++) {
        const nextIndex = (i + 1) % noteCount;
        await createTestNote(`note-${i}.md`, `# Note ${i}\nLinks to [[note-${nextIndex}]].`);
      }
      
      const startTime = Date.now();
      const analysis = await linkAnalyzer.analyzeLinkIntegrity();
      const duration = Date.now() - startTime;
      
      expect(duration).toBeLessThan(5000); // Less than 5 seconds
      expect(analysis.total_links).toBe(noteCount);
      expect(analysis.valid_links).toBe(noteCount);
      expect(analysis.broken_links).toHaveLength(0);
      expect(analysis.link_health_score).toBe(1);
    }, 10000); // 10 second timeout for this test
  });

  describe('Link Repair Tool Integration', () => {
    test('scan mode identifies issues correctly', async () => {
      await createTestNote('good-target.md', '# Good Target');
      await createTestNote('similar-name.md', '# Similar Name');
      await createTestNote('source.md', `# Source
Valid link: [[good-target]]
Broken link: [[similar name]]
Another broken: [[completely-missing]]`);
      
      const vaultsMap = new Map([['test', testVaultPath]]);
      const repairTool = createLinkRepairTool(vaultsMap);
      
      const result = await repairTool.handler({
        vault: 'test',
        mode: 'scan',
        confidence_threshold: 0.8,
        dry_run: true
      });
      
      expect(result.content.summary.total_links).toBe(3);
      expect(result.content.summary.valid_links).toBe(1);
      expect(result.content.summary.broken_links).toBe(2);
      expect(result.content.broken_links).toHaveLength(2);
      expect(result.content.recommendations).toBeDefined();
    });

    test('automatic fix mode with dry run', async () => {
      await createTestNote('correct-target.md', '# Correct Target');
      await createTestNote('source.md', 'Link to [[correct target]] with spaces.');
      
      const vaultsMap = new Map([['test', testVaultPath]]);
      const repairTool = createLinkRepairTool(vaultsMap);
      
      const result = await repairTool.handler({
        vault: 'test',
        mode: 'fix_automatic',
        confidence_threshold: 0.8,
        dry_run: true
      });
      
      expect(result.content.mode).toBe('dry_run');
      expect(result.content.fixes_available).toBe(1);
      expect(result.content.fixes[0].automated).toBe(true);
      expect(result.content.fixes[0].confidence).toBeGreaterThan(0.8);
    });
  });

  // Helper function to create test notes
  async function createTestNote(filename: string, content: string): Promise<void> {
    const filePath = path.join(testVaultPath, filename);
    const dir = path.dirname(filePath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write note content
    await fs.writeFile(filePath, content, 'utf-8');
  }
});

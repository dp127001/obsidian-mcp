import * as fs from 'fs/promises';
import * as path from 'path';

export interface LinkUpdateResult {
  oldPath: string;
  newPath: string;
  totalNotesProcessed: number;
  successfulUpdates: number;
  totalLinksUpdated: number;
  updateDetails: NoteUpdateResult[];
}

export interface NoteUpdateResult {
  notePath: string;
  success: boolean;
  linksUpdated: number;
  error: string | null;
}

export interface LinkFix {
  source_note: string;
  broken_link: string;
  suggested_target: string;
  confidence: number;
  fix_type: 'exact_match' | 'fuzzy_match' | 'manual_review';
}

export interface BulkFixResult {
  total_fixes_attempted: number;
  successful_fixes: number;
  failed_fixes: number;
  fixes_applied: LinkFixApplication[];
  backup_created: string | null;
}

export interface LinkFixApplication {
  source_note: string;
  original_link: string;
  new_link: string;
  success: boolean;
  error?: string;
}

export class LinkUpdater {
  private vaultPath: string;
  private backlinksCache: Map<string, string[]> = new Map();

  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Update all references to a moved/renamed file
   */
  async updateReferencesAfterMove(oldPath: string, newPath: string): Promise<LinkUpdateResult> {
    const oldRelativePath = path.relative(this.vaultPath, oldPath);
    const newRelativePath = path.relative(this.vaultPath, newPath);
    
    // Find all notes that reference the moved file
    const referencingNotes = await this.findBacklinks(oldRelativePath);
    
    const updateResults: NoteUpdateResult[] = [];
    
    for (const notePath of referencingNotes) {
      try {
        const result = await this.updateLinksInNote(notePath, oldRelativePath, newRelativePath);
        updateResults.push(result);
      } catch (error) {
        updateResults.push({
          notePath,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          linksUpdated: 0
        });
      }
    }

    return {
      oldPath: oldRelativePath,
      newPath: newRelativePath,
      totalNotesProcessed: referencingNotes.length,
      successfulUpdates: updateResults.filter(r => r.success).length,
      totalLinksUpdated: updateResults.reduce((sum, r) => sum + r.linksUpdated, 0),
      updateDetails: updateResults
    };
  }

  /**
   * Apply a specific link fix to a note
   */
  async applyLinkFix(fix: LinkFix): Promise<LinkFixApplication> {
    try {
      const notePath = fix.source_note;
      const fullPath = path.join(this.vaultPath, notePath);
      
      // Read current content
      const content = await fs.readFile(fullPath, 'utf-8');
      
      // Apply the fix
      const result = await this.updateSpecificLink(content, fix.broken_link, fix.suggested_target);
      
      if (result.linksUpdated > 0) {
        // Write updated content
        await fs.writeFile(fullPath, result.updatedContent, 'utf-8');
        
        return {
          source_note: notePath,
          original_link: fix.broken_link,
          new_link: fix.suggested_target,
          success: true
        };
      } else {
        return {
          source_note: notePath,
          original_link: fix.broken_link,
          new_link: fix.suggested_target,
          success: false,
          error: 'No matching links found to update'
        };
      }
    } catch (error) {
      return {
        source_note: fix.source_note,
        original_link: fix.broken_link,
        new_link: fix.suggested_target,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Apply multiple link fixes in batch with backup
   */
  async applyBulkFixes(fixes: LinkFix[], createBackup: boolean = true): Promise<BulkFixResult> {
    let backupPath: string | null = null;
    
    // Create backup if requested
    if (createBackup) {
      backupPath = await this.createVaultBackup();
    }

    const fixApplications: LinkFixApplication[] = [];
    
    try {
      for (const fix of fixes) {
        const application = await this.applyLinkFix(fix);
        fixApplications.push(application);
      }
      
      const successful = fixApplications.filter(app => app.success).length;
      const failed = fixApplications.filter(app => !app.success).length;
      
      return {
        total_fixes_attempted: fixes.length,
        successful_fixes: successful,
        failed_fixes: failed,
        fixes_applied: fixApplications,
        backup_created: backupPath
      };
    } catch (error) {
      // If something went wrong, attempt to restore from backup
      if (backupPath && createBackup) {
        console.warn('Bulk fix failed, backup available at:', backupPath);
      }
      throw error;
    }
  }

  /**
   * Find all notes that contain links to the specified file
   */
  private async findBacklinks(targetPath: string): Promise<string[]> {
    const backlinks: string[] = [];
    const targetBasename = path.basename(targetPath, '.md');
    
    // Search all notes for references
    const allNotes = await this.getAllNoteFiles();
    
    for (const notePath of allNotes) {
      try {
        const content = await fs.readFile(path.join(this.vaultPath, notePath), 'utf-8');
        
        // Check for WikiLinks referencing this file
        const hasReference = this.containsReferenceToFile(content, targetBasename, targetPath);
        if (hasReference) {
          backlinks.push(notePath);
        }
      } catch (error) {
        console.warn(`Failed to scan ${notePath} for backlinks:`, error);
      }
    }

    return backlinks;
  }

  /**
   * Update WikiLinks in a specific note
   */
  private async updateLinksInNote(
    notePath: string, 
    oldTargetPath: string, 
    newTargetPath: string
  ): Promise<NoteUpdateResult> {
    const fullPath = path.join(this.vaultPath, notePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    const oldBasename = path.basename(oldTargetPath, '.md');
    const newBasename = path.basename(newTargetPath, '.md');
    
    let updatedContent = content;
    let linksUpdated = 0;

    // Update [[OldName]] style links
    const wikiLinkPattern = new RegExp(`\\[\\[${this.escapeRegex(oldBasename)}(\\|[^\\]]+)?\\]\\]`, 'g');
    updatedContent = updatedContent.replace(wikiLinkPattern, (match, alias) => {
      linksUpdated++;
      return `[[${newBasename}${alias || ''}]]`;
    });

    // Update [[path/to/OldName]] style links if full path was used
    if (oldTargetPath.includes('/') || oldTargetPath.includes('\\')) {
      const normalizedOldPath = oldTargetPath.replace(/\\/g, '/');
      const normalizedNewPath = newTargetPath.replace(/\\/g, '/');
      
      const fullPathPattern = new RegExp(`\\[\\[${this.escapeRegex(normalizedOldPath)}(\\|[^\\]]+)?\\]\\]`, 'g');
      updatedContent = updatedContent.replace(fullPathPattern, (match, alias) => {
        linksUpdated++;
        return `[[${normalizedNewPath}${alias || ''}]]`;
      });
    }

    if (linksUpdated > 0) {
      await fs.writeFile(fullPath, updatedContent, 'utf-8');
    }

    return {
      notePath,
      success: true,
      linksUpdated,
      error: null
    };
  }

  /**
   * Update specific link in content without file operations
   */
  private async updateSpecificLink(
    content: string, 
    oldLink: string, 
    newTarget: string
  ): Promise<{ updatedContent: string; linksUpdated: number }> {
    let updatedContent = content;
    let linksUpdated = 0;

    // Create pattern to match the specific broken link
    const linkPattern = new RegExp(`\\[\\[${this.escapeRegex(oldLink)}(\\|[^\\]]+)?\\]\\]`, 'g');
    
    updatedContent = updatedContent.replace(linkPattern, (match, alias) => {
      linksUpdated++;
      const targetBasename = path.basename(newTarget, '.md');
      return `[[${targetBasename}${alias || ''}]]`;
    });

    return { updatedContent, linksUpdated };
  }

  /**
   * Get all markdown files in the vault
   */
  private async getAllNoteFiles(): Promise<string[]> {
    const noteFiles: string[] = [];
    await this.scanForNotes(this.vaultPath, '', noteFiles);
    return noteFiles;
  }

  /**
   * Recursively scan for markdown files
   */
  private async scanForNotes(dirPath: string, relativePath: string, noteFiles: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const entryRelativePath = path.join(relativePath, entry.name);
        
        if (entry.isDirectory()) {
          // Skip hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.scanForNotes(fullPath, entryRelativePath, noteFiles);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          noteFiles.push(entryRelativePath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Check if content contains reference to a specific file
   */
  private containsReferenceToFile(content: string, basename: string, fullPath: string): boolean {
    // Check for simple [[Basename]] references
    const simplePattern = new RegExp(`\\[\\[${this.escapeRegex(basename)}(\\|[^\\]]+)?\\]\\]`);
    if (simplePattern.test(content)) return true;

    // Check for full path references
    if (fullPath.includes('/') || fullPath.includes('\\')) {
      const normalizedPath = fullPath.replace(/\\/g, '/');
      const pathPattern = new RegExp(`\\[\\[${this.escapeRegex(normalizedPath)}(\\|[^\\]]+)?\\]\\]`);
      if (pathPattern.test(content)) return true;
    }

    return false;
  }

  /**
   * Escape special regex characters
   */
  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Create a backup of the entire vault
   */
  private async createVaultBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupDir = path.join(path.dirname(this.vaultPath), `vault-backup-${timestamp}`);
    
    await this.copyDirectory(this.vaultPath, backupDir);
    
    return backupDir;
  }

  /**
   * Copy directory recursively
   */
  private async copyDirectory(source: string, destination: string): Promise<void> {
    await fs.mkdir(destination, { recursive: true });
    
    const entries = await fs.readdir(source, { withFileTypes: true });
    
    for (const entry of entries) {
      const sourcePath = path.join(source, entry.name);
      const destPath = path.join(destination, entry.name);
      
      if (entry.isDirectory()) {
        // Skip hidden directories in backup
        if (!entry.name.startsWith('.')) {
          await this.copyDirectory(sourcePath, destPath);
        }
      } else {
        await fs.copyFile(sourcePath, destPath);
      }
    }
  }

  /**
   * Generate automatic fixes from broken links analysis
   */
  static generateAutomaticFixes(
    brokenLinks: Array<{ source_note: string; target_link: string; potential_matches?: Array<{ file_path: string; similarity_score: number }> }>,
    confidenceThreshold: number = 0.8
  ): LinkFix[] {
    const fixes: LinkFix[] = [];
    
    for (const brokenLink of brokenLinks) {
      if (brokenLink.potential_matches && brokenLink.potential_matches.length > 0) {
        const bestMatch = brokenLink.potential_matches[0];
        
        if (bestMatch.similarity_score >= confidenceThreshold) {
          fixes.push({
            source_note: brokenLink.source_note,
            broken_link: brokenLink.target_link,
            suggested_target: bestMatch.file_path,
            confidence: bestMatch.similarity_score,
            fix_type: bestMatch.similarity_score >= 0.95 ? 'exact_match' : 'fuzzy_match'
          });
        } else if (bestMatch.similarity_score >= 0.6) {
          fixes.push({
            source_note: brokenLink.source_note,
            broken_link: brokenLink.target_link,
            suggested_target: bestMatch.file_path,
            confidence: bestMatch.similarity_score,
            fix_type: 'manual_review'
          });
        }
      }
    }
    
    return fixes;
  }

  /**
   * Validate that a fix would be safe to apply
   */
  async validateFix(fix: LinkFix): Promise<{ isValid: boolean; reason?: string }> {
    try {
      // Check that source note exists
      const sourceExists = await this.fileExists(path.join(this.vaultPath, fix.source_note));
      if (!sourceExists) {
        return { isValid: false, reason: 'Source note does not exist' };
      }
      
      // Check that target note exists
      const targetExists = await this.fileExists(path.join(this.vaultPath, fix.suggested_target));
      if (!targetExists) {
        return { isValid: false, reason: 'Target note does not exist' };
      }
      
      // Check that source note actually contains the broken link
      const content = await fs.readFile(path.join(this.vaultPath, fix.source_note), 'utf-8');
      const linkPattern = new RegExp(`\\[\\[${this.escapeRegex(fix.broken_link)}(\\|[^\\]]+)?\\]\\]`);
      
      if (!linkPattern.test(content)) {
        return { isValid: false, reason: 'Broken link not found in source note' };
      }
      
      return { isValid: true };
    } catch (error) {
      return { 
        isValid: false, 
        reason: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
}

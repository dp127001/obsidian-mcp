import * as path from 'path';
import * as fs from 'fs/promises';

interface CreateResult {
    success: boolean;
    message?: string;
    processing_time_ms?: number;
}

// src/enhanced/filesystem/interface.ts
export class AtomicFilesystemInterface {
    private vaultPath: string;
    
    constructor(vaultPath: string) {
        this.vaultPath = vaultPath;
    }
    
    private generateCLFrontmatter(title: string, state: string, confidence: string): string {
        const now = new Date().toISOString();
        return `---
title: ${title}
state: ${state}
confidence: ${confidence}
created: ${now}
modified: ${now}
---

`;
    }
    
    // Atomic write with temp->rename pattern (prevents corruption)
    async writeNoteAtomic(notePath: string, content: string): Promise<void> {
        const fullPath = path.join(this.vaultPath, notePath);
        const tempPath = `${fullPath}.tmp.${Date.now()}`;
        
        try {
            await fs.writeFile(tempPath, content, 'utf8');
            await fs.rename(tempPath, fullPath); // Atomic operation
        } catch (error) {
            try { await fs.unlink(tempPath); } catch {} // Cleanup
            throw error;
        }
    }
    
    // Simplified note creation - no chunking needed for filesystem operations
    async createNote(notePath: string, title: string, content: string, options: any = {}): Promise<CreateResult> {
        const startTime = performance.now();
        
        try {
            const state = options.state || 'fluid';
            const confidence = options.confidence || 'medium';
            const frontmatter = this.generateCLFrontmatter(title, state, confidence);
            const fullContent = frontmatter + content;
            
            // Direct atomic write - handles any size content
            await this.writeNoteAtomic(notePath, fullContent);
            
            return {
                success: true,
                processing_time_ms: performance.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
                processing_time_ms: performance.now() - startTime
            };
        }
    }
    
    // Read note content
    async readNote(notePath: string): Promise<string> {
        const fullPath = path.join(this.vaultPath, notePath);
        return await fs.readFile(fullPath, 'utf8');
    }
    
    // Update existing note
    async updateNote(notePath: string, title: string, content: string, options: any = {}): Promise<CreateResult> {
        const startTime = performance.now();
        
        try {
            // For updates, we might want to preserve existing frontmatter
            const state = options.state || 'fluid';
            const confidence = options.confidence || 'medium';
            
            if (options.preserve_frontmatter) {
                // Read existing note and extract frontmatter
                const existing = await this.readNote(notePath);
                const frontmatterMatch = existing.match(/^---\n([\s\S]*?)\n---\n\n/);
                
                if (frontmatterMatch) {
                    // Update modified timestamp in existing frontmatter
                    const existingFrontmatter = frontmatterMatch[1];
                    const updatedFrontmatter = existingFrontmatter.replace(
                        /modified: .*/,
                        `modified: ${new Date().toISOString()}`
                    );
                    const fullContent = `---\n${updatedFrontmatter}\n---\n\n${content}`;
                    await this.writeNoteAtomic(notePath, fullContent);
                } else {
                    // No existing frontmatter, add it
                    const frontmatter = this.generateCLFrontmatter(title, state, confidence);
                    const fullContent = frontmatter + content;
                    await this.writeNoteAtomic(notePath, fullContent);
                }
            } else {
                // Replace entire content with new frontmatter
                const frontmatter = this.generateCLFrontmatter(title, state, confidence);
                const fullContent = frontmatter + content;
                await this.writeNoteAtomic(notePath, fullContent);
            }
            
            return {
                success: true,
                processing_time_ms: performance.now() - startTime
            };
        } catch (error) {
            return {
                success: false,
                message: error instanceof Error ? error.message : String(error),
                processing_time_ms: performance.now() - startTime
            };
        }
    }
    
    // Rollback operation (delete note if it exists)
    async rollbackOperation(notePath: string): Promise<void> {
        try {
            const fullPath = path.join(this.vaultPath, notePath);
            await fs.unlink(fullPath);
        } catch (error) {
            // File might not exist, which is fine for rollback
        }
    }
}

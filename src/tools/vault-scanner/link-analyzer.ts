import * as fs from 'fs/promises';
import * as path from 'path';

export interface LinkAnalysisResult {
  total_links: number;
  valid_links: number;
  broken_links: BrokenLink[];
  link_health_score: number;
  notes_with_broken_links: string[];
  most_connected_notes: ConnectedNote[];
  link_patterns: LinkPattern[];
}

export interface BrokenLink {
  source_note: string;
  target_link: string;
  link_text: string;
  potential_matches?: PotentialMatch[];
}

export interface PotentialMatch {
  file_path: string;
  similarity_score: number;
  match_type: 'title' | 'filename' | 'content_similarity';
}

export interface ConnectedNote {
  note_path: string;
  outbound_links: number;
  valid_outbound: number;
  inbound_links: number;
  connection_health: number;
}

export interface LinkPattern {
  pattern_type: 'internal_project' | 'cross_project' | 'external_reference';
  frequency: number;
  health_score: number;
  examples: string[];
}

export interface WikiLink {
  raw: string;
  text: string;
  alias?: string;
  position: number;
}

export interface LinkResolution {
  isValid: boolean;
  targetPath?: string;
  linkType: 'exact' | 'title' | 'partial' | 'broken';
}

export interface NoteMetadata {
  title?: string;
  path: string;
  basename: string;
}

export interface NoteLinkAnalysis {
  brokenLinks: BrokenLink[];
  validLinks: ValidLink[];
  connectionHealth: NoteConnectionHealth;
}

export interface ValidLink {
  source: string;
  target: string;
  linkText: string;
  linkType: string;
}

export interface NoteConnectionHealth {
  total_links: number;
  valid_links: number;
  broken_links: number;
  health_score: number;
  health_status: 'excellent' | 'good' | 'fair' | 'poor';
}

export class LinkAnalyzer {
  private vaultPath: string;
  private noteCache: Map<string, NoteMetadata> = new Map();
  private titleLookup: Map<string, string> = new Map();
  private filenameLookup: Map<string, string> = new Map();
  
  constructor(vaultPath: string) {
    this.vaultPath = vaultPath;
  }

  /**
   * Analyze all WikiLinks in the vault for integrity
   */
  async analyzeLinkIntegrity(): Promise<LinkAnalysisResult> {
    await this.buildNoteCache();
    
    const brokenLinks: BrokenLink[] = [];
    const validLinks: ValidLink[] = [];
    const noteHealthMap = new Map<string, NoteConnectionHealth>();

    for (const [notePath, metadata] of this.noteCache) {
      try {
        const linkAnalysis = await this.analyzeNoteLinks(notePath, metadata);
        
        brokenLinks.push(...linkAnalysis.brokenLinks);
        validLinks.push(...linkAnalysis.validLinks);
        noteHealthMap.set(notePath, linkAnalysis.connectionHealth);
      } catch (error) {
        console.warn(`Failed to analyze links in ${notePath}:`, error);
      }
    }

    return this.compileAnalysisResults(brokenLinks, validLinks, noteHealthMap);
  }

  /**
   * Build cache of all notes with metadata for fast lookup
   */
  private async buildNoteCache(): Promise<void> {
    this.noteCache.clear();
    this.titleLookup.clear();
    this.filenameLookup.clear();

    await this.scanDirectoryRecursive(this.vaultPath);
  }

  /**
   * Recursively scan directory for markdown files
   */
  private async scanDirectoryRecursive(dirPath: string): Promise<void> {
    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(this.vaultPath, fullPath);
        
        if (entry.isDirectory()) {
          // Skip .obsidian and other hidden directories
          if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await this.scanDirectoryRecursive(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith('.md')) {
          await this.processNoteFile(relativePath, fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Process individual note file and extract metadata
   */
  private async processNoteFile(relativePath: string, fullPath: string): Promise<void> {
    try {
      const content = await fs.readFile(fullPath, 'utf-8');
      const basename = path.basename(relativePath, '.md');
      
      // Extract title from frontmatter or first heading
      const title = this.extractTitle(content);
      
      const metadata: NoteMetadata = {
        title,
        path: relativePath,
        basename
      };
      
      this.noteCache.set(relativePath, metadata);
      
      // Build lookup indices
      this.filenameLookup.set(basename.toLowerCase(), relativePath);
      if (title && title.toLowerCase() !== basename.toLowerCase()) {
        this.titleLookup.set(title.toLowerCase(), relativePath);
      }
    } catch (error) {
      console.warn(`Failed to process note ${relativePath}:`, error);
    }
  }

  /**
   * Extract title from note content
   */
  private extractTitle(content: string): string | undefined {
    // Try frontmatter title first
    const frontmatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];
      const titleMatch = frontmatter.match(/^title:\s*(.+)$/m);
      if (titleMatch) {
        return titleMatch[1].trim().replace(/^["']|["']$/g, '');
      }
    }
    
    // Try first heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
    
    return undefined;
  }

  /**
   * Analyze links within a specific note
   */
  private async analyzeNoteLinks(notePath: string, metadata: NoteMetadata): Promise<NoteLinkAnalysis> {
    const fullPath = path.join(this.vaultPath, notePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const wikiLinks = this.extractWikiLinks(content);
    
    const brokenLinks: BrokenLink[] = [];
    const validLinks: ValidLink[] = [];

    for (const link of wikiLinks) {
      const resolution = await this.resolveLinkTarget(link);
      
      if (resolution.isValid && resolution.targetPath) {
        validLinks.push({
          source: notePath,
          target: resolution.targetPath,
          linkText: link.text,
          linkType: resolution.linkType
        });
      } else {
        const potentialMatches = await this.findPotentialMatches(link.text);
        brokenLinks.push({
          source_note: notePath,
          target_link: link.text,
          link_text: link.raw,
          potential_matches: potentialMatches
        });
      }
    }

    return {
      brokenLinks,
      validLinks,
      connectionHealth: this.calculateConnectionHealth(brokenLinks.length, validLinks.length)
    };
  }

  /**
   * Resolve WikiLink to actual file path
   */
  private async resolveLinkTarget(link: WikiLink): Promise<LinkResolution> {
    const searchText = link.text.toLowerCase();
    
    // Try exact filename match (most common)
    const exactMatch = this.filenameLookup.get(searchText);
    if (exactMatch) {
      return { isValid: true, targetPath: exactMatch, linkType: 'exact' };
    }

    // Try title-based resolution
    const titleMatch = this.titleLookup.get(searchText);
    if (titleMatch) {
      return { isValid: true, targetPath: titleMatch, linkType: 'title' };
    }

    // Try partial filename match (handle paths like "folder/filename")
    if (link.text.includes('/') || link.text.includes('\\')) {
      const normalizedPath = link.text.replace(/\\/g, '/');
      for (const [path] of this.noteCache) {
        if (path.replace(/\\/g, '/').toLowerCase() === normalizedPath.toLowerCase()) {
          return { isValid: true, targetPath: path, linkType: 'partial' };
        }
      }
    }

    return { isValid: false, linkType: 'broken' };
  }

  /**
   * Find potential matches for broken links using fuzzy matching
   */
  private async findPotentialMatches(linkText: string): Promise<PotentialMatch[]> {
    const matches: PotentialMatch[] = [];
    const searchText = linkText.toLowerCase();

    for (const [path, metadata] of this.noteCache) {
      // Filename similarity
      const filenameSimilarity = this.calculateSimilarity(searchText, metadata.basename.toLowerCase());
      if (filenameSimilarity > 0.6) {
        matches.push({
          file_path: path,
          similarity_score: filenameSimilarity,
          match_type: 'filename'
        });
      }

      // Title similarity
      if (metadata.title) {
        const titleSimilarity = this.calculateSimilarity(searchText, metadata.title.toLowerCase());
        if (titleSimilarity > 0.6) {
          matches.push({
            file_path: path,
            similarity_score: titleSimilarity,
            match_type: 'title'
          });
        }
      }
    }

    // Remove duplicates and sort by similarity
    const uniqueMatches = new Map<string, PotentialMatch>();
    for (const match of matches) {
      const existing = uniqueMatches.get(match.file_path);
      if (!existing || match.similarity_score > existing.similarity_score) {
        uniqueMatches.set(match.file_path, match);
      }
    }

    return Array.from(uniqueMatches.values())
      .sort((a, b) => b.similarity_score - a.similarity_score)
      .slice(0, 3);
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;

    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + cost // substitution
        );
      }
    }
    
    const maxLen = Math.max(str1.length, str2.length);
    return (maxLen - matrix[str2.length][str1.length]) / maxLen;
  }

  /**
   * Extract WikiLinks from note content
   */
  private extractWikiLinks(content: string): WikiLink[] {
    const linkPattern = /\[\[([^\]]+?)\]\]/g;
    const links: WikiLink[] = [];
    let match;

    while ((match = linkPattern.exec(content)) !== null) {
      const [raw, linkText] = match;
      const [target, alias] = linkText.split('|');
      
      links.push({
        raw,
        text: target.trim(),
        alias: alias?.trim(),
        position: match.index
      });
    }

    return links;
  }

  /**
   * Calculate connection health for a note
   */
  private calculateConnectionHealth(brokenCount: number, validCount: number): NoteConnectionHealth {
    const totalLinks = brokenCount + validCount;
    const healthScore = totalLinks === 0 ? 1 : validCount / totalLinks;
    
    return {
      total_links: totalLinks,
      valid_links: validCount,
      broken_links: brokenCount,
      health_score: healthScore,
      health_status: healthScore >= 0.9 ? 'excellent' : 
                    healthScore >= 0.7 ? 'good' : 
                    healthScore >= 0.5 ? 'fair' : 'poor'
    };
  }

  /**
   * Compile final analysis results
   */
  private compileAnalysisResults(
    brokenLinks: BrokenLink[], 
    validLinks: ValidLink[], 
    noteHealthMap: Map<string, NoteConnectionHealth>
  ): LinkAnalysisResult {
    const totalLinks = brokenLinks.length + validLinks.length;
    const linkHealthScore = totalLinks === 0 ? 1 : validLinks.length / totalLinks;
    
    // Find notes with broken links
    const notesWithBrokenLinks = Array.from(new Set(brokenLinks.map(link => link.source_note)));
    
    // Calculate most connected notes
    const connectionCounts = new Map<string, { valid: number; total: number }>();
    
    for (const link of validLinks) {
      const current = connectionCounts.get(link.source) || { valid: 0, total: 0 };
      connectionCounts.set(link.source, { valid: current.valid + 1, total: current.total + 1 });
    }
    
    for (const link of brokenLinks) {
      const current = connectionCounts.get(link.source_note) || { valid: 0, total: 0 };
      connectionCounts.set(link.source_note, { valid: current.valid, total: current.total + 1 });
    }
    
    const mostConnectedNotes: ConnectedNote[] = Array.from(connectionCounts.entries())
      .map(([notePath, counts]) => ({
        note_path: notePath,
        outbound_links: counts.total,
        valid_outbound: counts.valid,
        inbound_links: this.calculateInboundLinks(notePath, validLinks),
        connection_health: counts.total === 0 ? 1 : counts.valid / counts.total
      }))
      .sort((a, b) => (b.outbound_links + b.inbound_links) - (a.outbound_links + a.inbound_links))
      .slice(0, 10);

    // Analyze link patterns
    const linkPatterns = this.analyzeLinkPatterns(validLinks, brokenLinks);

    return {
      total_links: totalLinks,
      valid_links: validLinks.length,
      broken_links: brokenLinks,
      link_health_score: linkHealthScore,
      notes_with_broken_links: notesWithBrokenLinks,
      most_connected_notes: mostConnectedNotes,
      link_patterns: linkPatterns
    };
  }

  /**
   * Calculate inbound links for a note
   */
  private calculateInboundLinks(targetPath: string, validLinks: ValidLink[]): number {
    return validLinks.filter(link => link.target === targetPath).length;
  }

  /**
   * Analyze patterns in link usage
   */
  private analyzeLinkPatterns(validLinks: ValidLink[], brokenLinks: BrokenLink[]): LinkPattern[] {
    const patterns: LinkPattern[] = [];
    
    // Analyze project-internal links
    const internalLinks = validLinks.filter(link => 
      this.isSameProject(link.source, link.target)
    );
    
    if (internalLinks.length > 0) {
      patterns.push({
        pattern_type: 'internal_project',
        frequency: internalLinks.length,
        health_score: 1, // All valid by definition
        examples: internalLinks.slice(0, 3).map(link => `${link.source} → ${link.target}`)
      });
    }
    
    // Analyze cross-project links
    const crossProjectLinks = validLinks.filter(link => 
      !this.isSameProject(link.source, link.target)
    );
    
    if (crossProjectLinks.length > 0) {
      patterns.push({
        pattern_type: 'cross_project',
        frequency: crossProjectLinks.length,
        health_score: 1, // All valid by definition
        examples: crossProjectLinks.slice(0, 3).map(link => `${link.source} → ${link.target}`)
      });
    }

    return patterns;
  }

  /**
   * Check if two notes are in the same project
   */
  private isSameProject(sourcePath: string, targetPath: string): boolean {
    const sourceDir = path.dirname(sourcePath);
    const targetDir = path.dirname(targetPath);
    
    // Consider same project if in same directory or one level apart
    const sourceParts = sourceDir.split(/[/\\]/);
    const targetParts = targetDir.split(/[/\\]/);
    
    return sourceParts[0] === targetParts[0];
  }
}

import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

interface SearchFilters {
    confidence?: string;
    pathFilter?: string;
    includeContent?: boolean;
}

interface CLNote {
    path: string;
    title: string;
    state: string;
    confidence: string;
    created?: string;
    modified?: string;
    content?: string;
}

interface CLMetadata {
    title: string;
    state: string;
    confidence: string;
    created?: string;
    modified?: string;
    tags?: string[];
    dependencies?: string[];
}

export class CLStateDatabase {
    private db: Database.Database;
    constructor(vaultPath: string) {
        const dbPath = path.join(vaultPath, '.cl-state', 'cl_index.db');
        // Ensure directory exists
        const dbDir = path.dirname(dbPath);
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new Database(dbPath);
        this.initializeSchema();
    }
    
    private initializeSchema(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS cl_notes (
                path TEXT PRIMARY KEY,
                title TEXT,
                state TEXT,
                confidence TEXT,
                created TEXT,
                last_modified TEXT,
                tags TEXT,
                dependencies TEXT
            )
        `);
    }
    
    // <50ms search requirement
    searchByState(state: string, filters?: SearchFilters): CLNote[] {
        let query = 'SELECT * FROM cl_notes';
        const params: any[] = [];
        
        if (state !== 'all') {
            query += ' WHERE state = ?';
            params.push(state);
            
            if (filters?.confidence && filters.confidence !== 'any') {
                query += ' AND confidence = ?';
                params.push(filters.confidence);
            }
        } else if (filters?.confidence && filters.confidence !== 'any') {
            query += ' WHERE confidence = ?';
            params.push(filters.confidence);
        }
        
        const stmt = this.db.prepare(query);
        return stmt.all(...params) as CLNote[];
    }
    
    // Fast indexing for CL metadata
    indexNote(notePath: string, metadata: CLMetadata): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO cl_notes 
            (path, title, state, confidence, created, last_modified, tags, dependencies)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const tagsJson = metadata.tags ? JSON.stringify(metadata.tags) : null;
        const depsJson = metadata.dependencies ? JSON.stringify(metadata.dependencies) : null;
        
        stmt.run(
            notePath, 
            metadata.title, 
            metadata.state, 
            metadata.confidence, 
            metadata.created || new Date().toISOString(),
            metadata.modified || new Date().toISOString(),
            tagsJson,
            depsJson
        );
    }
}
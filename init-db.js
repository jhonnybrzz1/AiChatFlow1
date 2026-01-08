import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { repos, demands, repoFiles, files, users } from './shared/schema.ts';

const sqlite = new Database('sqlite.db');
const db = drizzle(sqlite);

async function initDb() {
  try {
    console.log('Initializing database...');
    
    // Test if tables exist by trying to query them
    try {
      await db.select().from(repos).limit(1);
      console.log('Tables already exist, skipping creation');
    } catch (error) {
      if (error.message.includes('no such table')) {
        console.log('Creating database tables...');
        
        // Use raw SQL to create tables since Drizzle doesn't have a built-in migration system
        const createRepos = `
          CREATE TABLE repos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            owner TEXT NOT NULL,
            name TEXT NOT NULL,
            full_name TEXT NOT NULL UNIQUE,
            description TEXT,
            url TEXT NOT NULL,
            clone_url TEXT,
            ssh_url TEXT,
            html_url TEXT,
            default_branch TEXT,
            language TEXT,
            size INTEGER,
            stars INTEGER DEFAULT 0,
            forks INTEGER DEFAULT 0,
            is_private BOOLEAN DEFAULT FALSE,
            is_fork BOOLEAN DEFAULT FALSE,
            indexed_content TEXT,
            indexed_at TIMESTAMP,
            briefing TEXT,
            briefing_generated_at TIMESTAMP,
            system_map TEXT,
            system_map_generated_at TIMESTAMP,
            last_commit TEXT,
            last_commit_date TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        const createRepoFiles = `
          CREATE TABLE repo_files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            repo_id INTEGER REFERENCES repos(id) ON DELETE CASCADE,
            path TEXT NOT NULL,
            filename TEXT NOT NULL,
            content TEXT,
            language TEXT,
            size INTEGER,
            sha TEXT,
            url TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        const createDemands = `
          CREATE TABLE demands (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            description TEXT NOT NULL,
            type TEXT NOT NULL,
            priority TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'processing',
            progress INTEGER NOT NULL DEFAULT 0,
            chat_messages JSONB DEFAULT '[]',
            prd_url TEXT,
            tasks_url TEXT,
            classification JSONB,
            orchestration JSONB,
            current_agent TEXT,
            error_message TEXT,
            validation_notes TEXT,
            completed_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        const createFiles = `
          CREATE TABLE files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            demand_id INTEGER REFERENCES demands(id),
            filename TEXT NOT NULL,
            original_name TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            size INTEGER NOT NULL,
            path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        const createUsers = `
          CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL
          )
        `;
        
        // Execute raw SQL
        sqlite.exec(createRepos);
        sqlite.exec(createRepoFiles);
        sqlite.exec(createDemands);
        sqlite.exec(createFiles);
        sqlite.exec(createUsers);
        
        console.log('Tables created successfully');
      } else {
        throw error;
      }
    }
    
    console.log('Database initialized successfully!');
    
    // Test query
    const result = await db.select().from(repos);
    console.log('Test query successful:', result);
    
  } catch (error) {
    console.error('Error initializing database:', error);
  } finally {
    sqlite.close();
  }
}

initDb();
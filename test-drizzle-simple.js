import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';
import { eq } from 'drizzle-orm';

const sqlite = new Database('test-simple.db');
const db = drizzle(sqlite);

// Define a simple table
const simpleRepos = sqliteTable('simple_repos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
});

async function testDrizzleSimple() {
  try {
    console.log('Testing Drizzle ORM with simple schema...');
    
    // Create table
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS simple_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        full_name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    
    // Test insert
    const newRepo = {
      owner: 'test-owner-2',
      name: 'test-repo-2',
      fullName: 'test-owner-2/test-repo-2',
    };
    
    console.log('Attempting insert...');
    const inserted = await db.insert(simpleRepos).values(newRepo).returning();
    console.log('Insert successful:', inserted);
    
    // Test query
    const found = await db.select().from(simpleRepos).where(
      eq(simpleRepos.fullName, 'test-owner-2/test-repo-2')
    ).limit(1);
    console.log('Query successful:', found);
    
    console.log('All Drizzle simple tests passed!');
    
  } catch (error) {
    console.error('Error in Drizzle simple test:', error);
  } finally {
    sqlite.close();
  }
}

testDrizzleSimple();
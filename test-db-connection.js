import { db } from './server/db.ts';
import { repos } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testDbConnection() {
  try {
    console.log('Testing database connection...');
    
    // Test simple query
    const result = await db.select().from(repos);
    console.log('Database query successful:', result);
    
    // Test insert
    const newRepo = {
      owner: 'test-owner',
      name: 'test-repo',
      fullName: 'test-owner/test-repo',
      description: 'Test repository',
      url: 'https://github.com/test-owner/test-repo',
      defaultBranch: 'main',
      language: 'TypeScript',
      size: 100,
      stars: 0,
      forks: 0,
      isPrivate: false,
      isFork: false,
    };
    
    const inserted = await db.insert(repos).values(newRepo).returning();
    console.log('Insert successful:', inserted);
    
    // Test query with where clause
    const found = await db.select().from(repos).where(
      eq(repos.fullName, 'test-owner/test-repo')
    ).limit(1);
    console.log('Query with where successful:', found);
    
    console.log('All database tests passed!');
    
  } catch (error) {
    console.error('Error in database test:', error);
    process.exit(1);
  }
}

testDbConnection();
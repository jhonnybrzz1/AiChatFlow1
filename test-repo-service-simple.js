import { db } from './server/db.ts';
import { repos } from './shared/schema.ts';
import { eq } from 'drizzle-orm';

async function testRepoServiceSimple() {
  try {
    console.log('Testing RepoService with direct DB access...');
    
    // Test the exact query that was failing
    const repo = await db.select().from(repos).where(
      eq(repos.fullName, 'test-owner/test-repo')
    ).limit(1);
    
    console.log('Query successful:', repo);
    
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
    
    // Test the query again
    const found = await db.select().from(repos).where(
      eq(repos.fullName, 'test-owner/test-repo')
    ).limit(1);
    
    console.log('Query after insert successful:', found);
    console.log('All tests passed!');
    
  } catch (error) {
    console.error('Error in RepoService simple test:', error);
    process.exit(1);
  }
}

testRepoServiceSimple();
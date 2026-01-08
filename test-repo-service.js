import { repoService } from './server/services/repo-service.ts';

async function testRepoService() {
  try {
    console.log('Testing RepoService...');
    
    // Test getOrCreateRepo method
    const repo = await repoService.getOrCreateRepo('test-owner', 'test-repo');
    console.log('Successfully got or created repo:', repo);
    
    // Test getRepoWithFiles method
    const repoWithFiles = await repoService.getRepoWithFiles('test-owner', 'test-repo');
    console.log('Successfully got repo with files:', repoWithFiles);
    
    console.log('All tests passed!');
    
  } catch (error) {
    console.error('Error in RepoService test:', error);
    process.exit(1);
  }
}

testRepoService();
import Database from 'better-sqlite3';

const sqlite = new Database('sqlite.db');

try {
  console.log('Testing SQLite connection...');
  
  // Test simple query
  const result = sqlite.prepare('SELECT 1').get();
  console.log('Simple query successful:', result);
  
  // Test if repos table exists
  try {
    const repos = sqlite.prepare('SELECT * FROM repos').all();
    console.log('Repos table exists:', repos);
  } catch (error) {
    console.log('Repos table does not exist or error:', error.message);
  }
  
  // Test creating a simple table
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS test_table (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Test inserting with CURRENT_TIMESTAMP
  const insert = sqlite.prepare('INSERT INTO test_table (name) VALUES (?)');
  const info = insert.run('test');
  console.log('Insert successful:', info);
  
  // Test selecting
  const select = sqlite.prepare('SELECT * FROM test_table');
  const rows = select.all();
  console.log('Select successful:', rows);
  
  console.log('All SQLite tests passed!');
  
} catch (error) {
  console.error('Error in SQLite test:', error);
} finally {
  sqlite.close();
}
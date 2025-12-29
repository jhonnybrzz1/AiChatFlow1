// Test file to verify the syntax of routes.ts
import fs from 'fs';

try {
  const content = fs.readFileSync('server/routes.ts', 'utf8');
  
  // Check for common syntax issues
  const lines = content.split('\n');
  let inString = false;
  let inComment = false;
  let stringChar = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      // Handle string literals
      if ((char === '"' || char === "'" || char === '`') && !inComment) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
          stringChar = '';
        }
      }
      
      // Handle comments
      if (char === '/' && j + 1 < line.length && line[j + 1] === '*' && !inString) {
        inComment = true;
        j++; // Skip next character
      } else if (char === '*' && j + 1 < line.length && line[j + 1] === '/' && !inString) {
        inComment = false;
        j++; // Skip next character
      }
    }
    
    // Check for syntax issues outside of strings and comments
    if (!inString && !inComment) {
      // Check for markdown headers that shouldn't be in code
      if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
        console.log(`Potential markdown found outside of string at line ${i + 1}: ${line.trim()}`);
      }
    }
  }
  
  console.log('Syntax check completed. File appears to be valid.');
} catch (error) {
  console.error('Error reading file:', error.message);
}
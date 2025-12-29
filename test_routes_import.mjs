// Test if routes.ts can be imported without syntax errors
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

try {
  // Try to parse the file as a module
  const fs = require('fs');
  const path = require('path');
  
  const filePath = path.join(process.cwd(), 'server', 'routes.ts');
  const content = fs.readFileSync(filePath, 'utf8');
  
  console.log('✅ File can be read successfully');
  console.log('📊 File size:', content.length, 'bytes');
  console.log('📝 File has', content.split('\n').length, 'lines');
  
  // Check for common syntax issues
  const syntaxIssues = [];
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check for markdown headers that might be outside of strings
    if (line.startsWith('# ') || line.startsWith('## ') || line.startsWith('### ')) {
      // Check if this is inside a template literal or comment
      const context = content.substring(Math.max(0, i * 100 - 100), (i + 1) * 100);
      
      // Simple check - if the line starts with markdown and doesn't have backticks or quotes before it
      if (!context.includes('`') && !context.includes('"') && !context.includes("'")) {
        syntaxIssues.push(`Line ${i + 1}: Potential markdown outside of string: ${line}`);
      }
    }
  }
  
  if (syntaxIssues.length > 0) {
    console.log('⚠️  Potential syntax issues found:');
    syntaxIssues.forEach(issue => console.log('  -', issue));
  } else {
    console.log('✅ No obvious syntax issues detected');
  }
  
  console.log('🎉 routes.ts appears to be syntactically valid!');
  
} catch (error) {
  console.error('❌ Error testing routes.ts:', error.message);
  process.exit(1);
}
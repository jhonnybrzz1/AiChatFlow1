const fs = require('fs');
const path = require('path');

// Lista de arquivos YAML que precisam ser corrigidos
const yamlFiles = [
  'data_analyst.yaml',
  'product_manager.yaml',
  'qa.yaml',
  'scrum_master.yaml',
  'tech_lead.yaml',
  'ux_designer.yaml'
];

// Corrige cada arquivo YAML
yamlFiles.forEach(filename => {
  const filepath = path.join('agents', filename);
  
  if (fs.existsSync(filepath)) {
    let content = fs.readFileSync(filepath, 'utf8');
    
    // Remove caracteres invisíveis e normaliza a codificação
    content = content
      .replace(/\u200B/g, '') // zero-width space
      .replace(/\u200C/g, '') // zero-width non-joiner
      .replace(/\u200D/g, '') // zero-width joiner
      .replace(/\uFEFF/g, '') // BOM
      .replace(/\r\n/g, '\n') // normalize line endings
      .replace(/\r/g, '\n'); // normalize line endings
    
    // Certifica-se de que cada chave esteja alinhada à esquerda
    const lines = content.split('\n');
    let correctedLines = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Se for uma linha de chave (contém ':'), certifica-se de que não tem espaços à esquerda
      if (line.trim().includes(':') && !line.trim().startsWith('|')) {
        // Verifica se é uma das chaves principais (name, description, model, system_prompt)
        if (line.trim().startsWith('name:') || 
            line.trim().startsWith('description:') || 
            line.trim().startsWith('model:') || 
            line.trim().startsWith('system_prompt:')) {
          correctedLines.push(line.trimLeft()); // Remove espaços à esquerda
        } else {
          correctedLines.push(line);
        }
      } else {
        correctedLines.push(line);
      }
    }
    
    content = correctedLines.join('\n');
    
    // Escreve o arquivo corrigido
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Arquivo corrigido: ${filename}`);
  } else {
    console.log(`Arquivo não encontrado: ${filename}`);
  }
});

console.log('Correção de YAML concluída!');
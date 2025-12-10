/**
 * Validação de documentos PRD e Tasks Document
 *
 * Este módulo valida se os documentos gerados seguem os templates mínimos
 * e contêm todos os metadados e estruturas obrigatórias.
 */

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

/**
 * Valida se um documento Tasks contém todos os elementos obrigatórios
 */
export function validateTasksDocument(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar presença de metadados obrigatórios
  if (!content.includes('## Metadados')) {
    errors.push({
      field: 'metadados',
      message: 'Seção "Metadados" ausente no documento',
      severity: 'error'
    });
  }

  // Validar prioridade
  const priorityRegex = /\*\*Prioridade\*\*:\s*(Alta|Média|Baixa)/i;
  if (!priorityRegex.test(content)) {
    errors.push({
      field: 'prioridade',
      message: 'Campo "Prioridade" ausente ou inválido (deve ser Alta, Média ou Baixa)',
      severity: 'error'
    });
  }

  // Validar responsável
  const responsibleRegex = /\*\*Responsável\*\*:\s*(.+)/;
  if (!responsibleRegex.test(content)) {
    errors.push({
      field: 'responsavel',
      message: 'Campo "Responsável" ausente',
      severity: 'error'
    });
  } else {
    const match = content.match(responsibleRegex);
    if (match && match[1].includes('[Time/Área]')) {
      warnings.push({
        field: 'responsavel',
        message: 'Campo "Responsável" ainda contém placeholder',
        severity: 'warning'
      });
    }
  }

  // Validar status
  const statusRegex = /\*\*Status\*\*:\s*(Não Iniciado|Em Progresso|Concluído)/i;
  if (!statusRegex.test(content)) {
    errors.push({
      field: 'status',
      message: 'Campo "Status" ausente ou inválido (deve ser Não Iniciado, Em Progresso ou Concluído)',
      severity: 'error'
    });
  }

  // Validar formato dos IDs de tarefas (T1, T2, etc.)
  const taskIdRegex = /\*\*T\d+\*\*:/g;
  const taskIds = content.match(taskIdRegex);

  if (!taskIds || taskIds.length === 0) {
    errors.push({
      field: 'tarefas',
      message: 'Nenhuma tarefa encontrada com formato válido (T1, T2, etc.)',
      severity: 'error'
    });
  }

  // Validar se cada tarefa tem critérios de aceite
  if (taskIds) {
    taskIds.forEach((taskId) => {
      const taskNumber = taskId.match(/T(\d+)/)?.[1];
      const taskSection = extractTaskSection(content, taskNumber!);

      if (taskSection && !taskSection.includes('Critérios de aceite:')) {
        errors.push({
          field: `tarefa_${taskNumber}`,
          message: `Tarefa ${taskNumber} não possui critérios de aceite`,
          severity: 'error'
        });
      }

      // Verificar se critérios de aceite não estão vazios
      if (taskSection && taskSection.includes('Critérios de aceite: [Lista de condições]')) {
        warnings.push({
          field: `tarefa_${taskNumber}`,
          message: `Tarefa ${taskNumber} possui critérios de aceite vazios (placeholder)`,
          severity: 'warning'
        });
      }

      // Validar vínculo com PRD
      if (taskSection && !taskSection.includes('Vinculado ao PRD:')) {
        warnings.push({
          field: `tarefa_${taskNumber}`,
          message: `Tarefa ${taskNumber} não possui vínculo explícito com requisitos do PRD`,
          severity: 'warning'
        });
      }
    });
  }

  // Validar seção de métricas de sucesso
  if (!content.includes('## Métricas de Sucesso')) {
    warnings.push({
      field: 'metricas',
      message: 'Seção "Métricas de Sucesso" ausente',
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Valida se um documento PRD contém todos os elementos obrigatórios
 */
export function validatePRDDocument(content: string): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  // Validar seção de escopo
  if (!content.includes('## 1. Escopo')) {
    errors.push({
      field: 'escopo',
      message: 'Seção "Escopo" ausente no documento',
      severity: 'error'
    });
  }

  // Validar In Scope e Out of Scope
  if (!content.includes('### In Scope')) {
    errors.push({
      field: 'in_scope',
      message: 'Subseção "In Scope" ausente',
      severity: 'error'
    });
  }

  if (!content.includes('### Out of Scope')) {
    errors.push({
      field: 'out_scope',
      message: 'Subseção "Out of Scope" ausente',
      severity: 'error'
    });
  }

  // Validar requisitos funcionais
  if (!content.includes('## 2. Requisitos Funcionais')) {
    errors.push({
      field: 'requisitos_funcionais',
      message: 'Seção "Requisitos Funcionais" ausente',
      severity: 'error'
    });
  }

  // Validar formato dos requisitos funcionais (RF1, RF2, etc.)
  const rfRegex = /### RF\d+:/g;
  const functionalReqs = content.match(rfRegex);

  if (!functionalReqs || functionalReqs.length === 0) {
    errors.push({
      field: 'requisitos_funcionais',
      message: 'Nenhum requisito funcional encontrado com formato válido (RF1, RF2, etc.)',
      severity: 'error'
    });
  }

  // Validar se cada RF tem critérios de aceite
  if (functionalReqs) {
    functionalReqs.forEach((rf) => {
      const rfNumber = rf.match(/RF(\d+)/)?.[1];
      const rfSection = extractRFSection(content, rfNumber!);

      if (rfSection && !rfSection.includes('**Critérios de Aceite**:')) {
        errors.push({
          field: `rf_${rfNumber}`,
          message: `Requisito Funcional ${rfNumber} não possui critérios de aceite`,
          severity: 'error'
        });
      }

      // Validar prioridade do RF
      if (rfSection && !rfSection.includes('**Prioridade**:')) {
        warnings.push({
          field: `rf_${rfNumber}`,
          message: `Requisito Funcional ${rfNumber} não possui prioridade definida`,
          severity: 'warning'
        });
      }
    });
  }

  // Validar requisitos não funcionais
  if (!content.includes('## 3. Requisitos Não Funcionais')) {
    warnings.push({
      field: 'requisitos_nao_funcionais',
      message: 'Seção "Requisitos Não Funcionais" ausente',
      severity: 'warning'
    });
  }

  // Validar critérios de aceitação gerais
  if (!content.includes('## 4. Critérios de Aceitação Gerais')) {
    errors.push({
      field: 'criterios_aceitacao',
      message: 'Seção "Critérios de Aceitação Gerais" ausente',
      severity: 'error'
    });
  }

  // Validar métricas de sucesso
  if (!content.includes('Métricas de Sucesso')) {
    warnings.push({
      field: 'metricas',
      message: 'Seção "Métricas de Sucesso" ausente',
      severity: 'warning'
    });
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Extrai a seção de uma tarefa específica do documento
 */
function extractTaskSection(content: string, taskNumber: string): string | null {
  const taskRegex = new RegExp(`\\*\\*T${taskNumber}\\*\\*:([\\s\\S]*?)(?=\\*\\*T\\d+\\*\\*:|### |## |$)`, 'm');
  const match = content.match(taskRegex);
  return match ? match[1] : null;
}

/**
 * Extrai a seção de um requisito funcional específico do documento
 */
function extractRFSection(content: string, rfNumber: string): string | null {
  const rfRegex = new RegExp(`### RF${rfNumber}:([\\s\\S]*?)(?=### RF\\d+:|## |$)`, 'm');
  const match = content.match(rfRegex);
  return match ? match[1] : null;
}

/**
 * Valida ambos os documentos (PRD e Tasks) e retorna um resultado consolidado
 */
export function validateDocuments(prdContent: string, tasksContent: string): {
  prd: ValidationResult;
  tasks: ValidationResult;
  overallValid: boolean;
} {
  const prdValidation = validatePRDDocument(prdContent);
  const tasksValidation = validateTasksDocument(tasksContent);

  return {
    prd: prdValidation,
    tasks: tasksValidation,
    overallValid: prdValidation.isValid && tasksValidation.isValid
  };
}

/**
 * Formata os erros de validação em uma mensagem legível
 */
export function formatValidationErrors(validation: ValidationResult, documentType: 'PRD' | 'Tasks'): string {
  const messages: string[] = [`\n❌ Erros de validação no ${documentType}:\n`];

  if (validation.errors.length > 0) {
    messages.push('**Erros críticos:**');
    validation.errors.forEach((error, index) => {
      messages.push(`${index + 1}. [${error.field}] ${error.message}`);
    });
  }

  if (validation.warnings.length > 0) {
    messages.push('\n⚠️ **Avisos:**');
    validation.warnings.forEach((warning, index) => {
      messages.push(`${index + 1}. [${warning.field}] ${warning.message}`);
    });
  }

  return messages.join('\n');
}

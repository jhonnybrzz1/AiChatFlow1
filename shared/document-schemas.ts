/**
 * Document Validation Schemas
 *
 * Schemas de validação para PRD e Tasks Document usando Zod.
 * Garantem que todos os campos obrigatórios estejam presentes e válidos.
 */

import { z } from "zod";

/**
 * Schema para Requisito Funcional
 */
export const FunctionalRequirementSchema = z.object({
  id: z.string()
    .min(1, "ID do requisito é obrigatório")
    .regex(/^RF\d+$/, "ID deve seguir o padrão RF1, RF2, etc."),
  title: z.string()
    .min(1, "Título do requisito é obrigatório"),
  description: z.string()
    .min(10, "Descrição deve ter no mínimo 10 caracteres"),
  acceptanceCriteria: z.array(z.string().min(1))
    .min(1, "Pelo menos um critério de aceite é obrigatório"),
  priority: z.enum(["Must-have", "Should-have", "Nice-to-have"], {
    errorMap: () => ({ message: "Prioridade inválida" })
  }),
});

/**
 * Schema para Requisito Não Funcional
 */
export const NonFunctionalRequirementSchema = z.object({
  id: z.string()
    .min(1, "ID do requisito é obrigatório")
    .regex(/^RNF\d+$/, "ID deve seguir o padrão RNF1, RNF2, etc."),
  category: z.enum(["Performance", "Segurança", "Escalabilidade", "Usabilidade", "Manutenibilidade"]),
  description: z.string()
    .min(10, "Descrição deve ter no mínimo 10 caracteres"),
  metric: z.string()
    .min(1, "Métrica de validação é obrigatória"),
});

/**
 * Schema para Risco
 */
export const RiskSchema = z.object({
  id: z.string()
    .min(1, "ID do risco é obrigatório")
    .regex(/^R\d+$/, "ID deve seguir o padrão R1, R2, etc."),
  description: z.string()
    .min(10, "Descrição do risco deve ter no mínimo 10 caracteres"),
  impact: z.enum(["Alto", "Médio", "Baixo"]),
  probability: z.enum(["Alta", "Média", "Baixa"]),
  mitigation: z.string()
    .min(10, "Estratégia de mitigação deve ter no mínimo 10 caracteres"),
});

/**
 * Schema para KPI
 */
export const KPISchema = z.object({
  id: z.string()
    .min(1, "ID do KPI é obrigatório")
    .regex(/^KPI\d+$/, "ID deve seguir o padrão KPI1, KPI2, etc."),
  description: z.string()
    .min(10, "Descrição do KPI deve ter no mínimo 10 caracteres"),
  target: z.string()
    .min(1, "Meta do KPI é obrigatória")
    .regex(/\d+/, "Meta deve conter valores numéricos (ex: '15%', '200ms')"),
  measurement: z.string()
    .min(1, "Método de medição é obrigatório"),
  category: z.enum(["Primário", "Secundário"]),
});

/**
 * Schema completo para PRD (Product Requirements Document)
 */
export const PRDSchema = z.object({
  title: z.string()
    .min(5, "Título deve ter no mínimo 5 caracteres")
    .max(100, "Título deve ter no máximo 100 caracteres"),

  overview: z.object({
    objective: z.string()
      .min(20, "Objetivo deve ter no mínimo 20 caracteres"),
    problem: z.string()
      .min(20, "Descrição do problema deve ter no mínimo 20 caracteres"),
    solution: z.string()
      .min(20, "Descrição da solução deve ter no mínimo 20 caracteres")
      .optional(),
  }),

  functionalRequirements: z.array(FunctionalRequirementSchema)
    .min(1, "Pelo menos um requisito funcional é obrigatório")
    .max(50, "Máximo de 50 requisitos funcionais permitidos"),

  nonFunctionalRequirements: z.array(NonFunctionalRequirementSchema)
    .min(1, "Pelo menos um requisito não funcional é obrigatório")
    .max(20, "Máximo de 20 requisitos não funcionais permitidos"),

  scope: z.object({
    inScope: z.array(z.string().min(1))
      .min(1, "Pelo menos um item 'In Scope' é obrigatório"),
    outOfScope: z.array(z.string().min(1))
      .min(1, "Pelo menos um item 'Out of Scope' é obrigatório"),
  }),

  acceptanceCriteria: z.array(z.string().min(10))
    .min(1, "Pelo menos um critério de aceitação geral é obrigatório"),

  dependencies: z.object({
    internal: z.array(z.string().min(1))
      .optional(),
    external: z.array(z.string().min(1))
      .optional(),
  }),

  risks: z.array(RiskSchema)
    .min(1, "Pelo menos um risco deve ser identificado")
    .max(10, "Máximo de 10 riscos permitidos"),

  metrics: z.object({
    primary: z.array(KPISchema)
      .min(1, "Pelo menos um KPI primário é obrigatório"),
    secondary: z.array(KPISchema)
      .optional(),
  }),

  timeline: z.object({
    mvpDate: z.string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
    phases: z.array(z.object({
      name: z.string().min(1),
      duration: z.string().min(1),
      responsible: z.string().min(1),
    })).optional(),
  }),

  approvals: z.object({
    productManager: z.boolean().optional(),
    techLead: z.boolean().optional(),
    stakeholders: z.array(z.string()).optional(),
  }).optional(),

  version: z.string()
    .regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir o padrão semver (ex: 1.0.0)"),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Schema para Tarefa (Task)
 */
export const TaskSchema = z.object({
  id: z.string()
    .min(1, "ID da tarefa é obrigatório")
    .regex(/^T\d+$/, "ID deve seguir o padrão T1, T2, etc."),

  title: z.string()
    .min(5, "Título deve ter no mínimo 5 caracteres")
    .max(100, "Título deve ter no máximo 100 caracteres"),

  description: z.string()
    .min(20, "Descrição deve ter no mínimo 20 caracteres")
    .max(500, "Descrição deve ter no máximo 500 caracteres"),

  category: z.enum(["Backend", "Frontend", "Testes", "Documentação", "Infraestrutura", "Design"]),

  acceptanceCriteria: z.array(z.string().min(10))
    .min(1, "Pelo menos um critério de aceite é obrigatório"),

  responsible: z.string()
    .min(1, "Responsável é obrigatório")
    .regex(/^@[\w-]+$/, "Responsável deve seguir o padrão @nome-do-time ou @nome-pessoa"),

  priority: z.enum(["Alta", "Média", "Baixa"]),

  estimate: z.string()
    .regex(/^\d+\s?(SP|h|d)$/, "Estimativa deve seguir o padrão: '5 SP', '8h', '2d'"),

  dependencies: z.array(z.string().regex(/^T\d+$/))
    .optional(),

  linkedRequirements: z.array(z.string().regex(/^(RF|RNF)\d+$/))
    .min(1, "Tarefa deve estar vinculada a pelo menos um requisito do PRD"),

  status: z.enum(["Não Iniciado", "Em Progresso", "Bloqueado", "Concluído"])
    .default("Não Iniciado"),
});

/**
 * Schema completo para Tasks Document
 */
export const TasksDocumentSchema = z.object({
  title: z.string()
    .min(5, "Título deve ter no mínimo 5 caracteres"),

  metadata: z.object({
    priority: z.enum(["Alta", "Média", "Baixa"]),
    responsible: z.string()
      .min(1, "Responsável geral é obrigatório")
      .regex(/^@[\w-]+$/, "Responsável deve seguir o padrão @nome-do-time"),
    status: z.enum(["Não Iniciado", "Em Progresso", "Concluído"]),
    version: z.string()
      .regex(/^\d+\.\d+\.\d+$/, "Versão deve seguir o padrão semver (ex: 1.0.0)"),
  }),

  tasks: z.array(TaskSchema)
    .min(1, "Pelo menos uma tarefa é obrigatória")
    .max(100, "Máximo de 100 tarefas permitidas"),

  successMetrics: z.array(z.string().min(10))
    .min(1, "Pelo menos uma métrica de sucesso é obrigatória"),

  externalDependencies: z.array(z.string().min(10))
    .optional(),

  identifiedRisks: z.array(z.object({
    description: z.string().min(10),
    mitigation: z.string().min(10),
  })).optional(),

  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

/**
 * Tipos TypeScript inferidos dos schemas
 */
export type FunctionalRequirement = z.infer<typeof FunctionalRequirementSchema>;
export type NonFunctionalRequirement = z.infer<typeof NonFunctionalRequirementSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type KPI = z.infer<typeof KPISchema>;
export type PRD = z.infer<typeof PRDSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type TasksDocument = z.infer<typeof TasksDocumentSchema>;

/**
 * Função auxiliar para validar PRD
 */
export function validatePRD(data: unknown): { success: boolean; data?: PRD; errors?: z.ZodError } {
  const result = PRDSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Função auxiliar para validar Tasks Document
 */
export function validateTasksDocument(data: unknown): { success: boolean; data?: TasksDocument; errors?: z.ZodError } {
  const result = TasksDocumentSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error };
}

/**
 * Função para formatar erros de validação de forma legível
 */
export function formatValidationErrors(errors: z.ZodError): string[] {
  return errors.errors.map(error => {
    const path = error.path.join('.');
    return `[${path}] ${error.message}`;
  });
}

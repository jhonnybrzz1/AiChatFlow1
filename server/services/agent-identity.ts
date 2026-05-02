export const AGENT_KEY_ALIASES: Record<string, string> = {
  "anti_overengineering": "anti_overengineering",
  "anti-overengineering": "anti_overengineering",
  "anti overengineering": "anti_overengineering",
  "analista_de_dados": "analista_de_dados",
  "analista de dados": "analista_de_dados",
  "data_analyst": "analista_de_dados",
  "data analyst": "analista_de_dados",
  "pm": "product_manager",
  "product_manager": "product_manager",
  "product manager": "product_manager",
  "product_owner": "product_owner",
  "product owner": "product_owner",
  "qa": "qa",
  "refinador": "refinador",
  "scrum_master": "scrum_master",
  "scrum master": "scrum_master",
  "tech_lead": "tech_lead",
  "tech lead": "tech_lead",
  "ux": "ux",
  "ux_designer": "ux",
  "ux designer": "ux",
};

export function canonicalAgentKey(value: string): string {
  const withoutAgentSuffix = value.replace(/\s+agent$/i, "");
  const normalized = withoutAgentSuffix
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, " ")
    .replace(/\s+/g, " ");

  const alias = AGENT_KEY_ALIASES[normalized];
  if (alias) return alias;

  const snakeCase = normalized.replace(/\s+/g, "_");
  return AGENT_KEY_ALIASES[snakeCase] || snakeCase;
}

export function isProductManagerAgent(value: string): boolean {
  return canonicalAgentKey(value) === "product_manager";
}

export function canonicalizeAgentConfigMap<T>(
  configs: Record<string, T>
): Record<string, T> {
  const canonicalConfigs: Record<string, T> = {};

  for (const [agentName, config] of Object.entries(configs)) {
    canonicalConfigs[canonicalAgentKey(agentName)] = config;
  }

  return canonicalConfigs;
}

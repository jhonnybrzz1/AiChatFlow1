import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const AGENTS_DIR = path.join(process.cwd(), 'agents');

const LEGACY_PROMPT_KEYS = {
  'anti-overengineering-template': 'AntiOverengineering',
  data_analyst: 'DataAnalyst',
  product_manager: 'PM',
  product_owner: 'PO',
  qa: 'QA',
  refinador: 'Refinador',
  scrum_master: 'ScrumMaster',
  tech_lead: 'TechLead',
  ux_designer: 'UX'
};

function normalizeAgentPrompt(agentConfig) {
  return {
    systemPrompt: agentConfig.system_prompt || '',
    description: agentConfig.description || '',
    model: agentConfig.model,
    name: agentConfig.name
  };
}

export function loadPrompts(agentsDir = AGENTS_DIR) {
  if (!fs.existsSync(agentsDir)) {
    return {};
  }

  return fs.readdirSync(agentsDir)
    .filter((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
    .sort()
    .reduce((acc, file) => {
      const filePath = path.join(agentsDir, file);
      const parsed = yaml.load(fs.readFileSync(filePath, 'utf8'));

      if (!parsed || typeof parsed !== 'object') {
        return acc;
      }

      const baseName = path.basename(file, path.extname(file));
      const key = LEGACY_PROMPT_KEYS[baseName] || baseName;
      acc[key] = normalizeAgentPrompt(parsed);
      return acc;
    }, {});
}

export const prompts = loadPrompts();
export default prompts;

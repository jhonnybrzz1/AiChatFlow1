"""
AutoGen Integration with Existing AI Squad Agents
Enables debates between existing YAML-configured agents using AutoGen framework
"""

import os
import sys
import json
import yaml
import logging
from typing import List, Dict, Optional
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from autogen import AssistantAgent, GroupChat, GroupChatManager, UserProxyAgent
except ImportError:
    logger.error("AutoGen not installed. Run: pip install pyautogen")
    sys.exit(1)


class SquadAutoGenIntegration:
    """
    Integrates AutoGen with existing AI Squad agents from YAML configs
    """
    
    def __init__(self, agents_dir: str = "agents", use_ollama: bool = True):
        """
        Initialize integration with existing agents
        
        Args:
            agents_dir: Directory containing agent YAML configs
            use_ollama: Whether to use Ollama (True) or API (False)
        """
        self.agents_dir = Path(agents_dir)
        self.use_ollama = use_ollama
        self.config = self._get_mistral_config()
        self.agent_configs = self._load_agent_configs()
        self.autogen_agents: Dict[str, AssistantAgent] = {}
        
    def _get_mistral_config(self) -> Dict:
        """Get Mistral configuration"""
        if self.use_ollama:
            return {
                "config_list": [{
                    "model": os.getenv('OLLAMA_MODEL', 'mistral'),
                    "base_url": os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434/v1'),
                    "api_key": "ollama",
                }],
                "timeout": int(os.getenv('AUTOGEN_TIMEOUT', '300')),
                "temperature": 0.7,
            }
        else:
            return {
                "config_list": [{
                    "model": os.getenv('MISTRAL_MODEL', 'mistral-large-latest'),
                    "api_key": os.getenv('MISTRAL_API_KEY'),
                    "base_url": "https://api.mistral.ai/v1",
                }],
                "timeout": int(os.getenv('AUTOGEN_TIMEOUT', '300')),
                "temperature": 0.7,
            }
    
    def _load_agent_configs(self) -> Dict[str, Dict]:
        """Load agent configurations from YAML files"""
        configs = {}
        
        if not self.agents_dir.exists():
            logger.warning(f"Agents directory not found: {self.agents_dir}")
            return configs
        
        for yaml_file in self.agents_dir.glob("*.yaml"):
            try:
                with open(yaml_file, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)
                    agent_name = config.get('name', yaml_file.stem).lower().replace(' agent', '')
                    configs[agent_name] = config
                    logger.info(f"Loaded config for agent: {agent_name}")
            except Exception as e:
                logger.error(f"Error loading {yaml_file}: {e}")
        
        return configs
    
    def create_agent_from_config(self, agent_name: str) -> Optional[AssistantAgent]:
        """
        Create an AutoGen agent from YAML config
        
        Args:
            agent_name: Name of the agent (e.g., 'qa', 'tech_lead')
            
        Returns:
            AssistantAgent instance or None if config not found
        """
        config = self.agent_configs.get(agent_name)
        if not config:
            logger.warning(f"No config found for agent: {agent_name}")
            return None
        
        system_message = config.get('system_prompt', f"Você é um {agent_name} experiente.")
        
        # Add debate instructions to system message
        enhanced_message = f"""{system_message}

INSTRUÇÕES PARA DEBATE:
- Seja objetivo e focado no problema
- Questione pontos fracos de outras propostas
- Defenda suas ideias com argumentos sólidos
- Quando concordar com uma solução, diga "concordo"
- Busque consenso quando apropriado"""
        
        agent = AssistantAgent(
            name=agent_name,
            system_message=enhanced_message,
            llm_config=self.config,
        )
        
        self.autogen_agents[agent_name] = agent
        logger.info(f"Created AutoGen agent: {agent_name}")
        return agent
    
    def run_squad_debate(
        self,
        problem: str,
        agent_names: List[str],
        max_rounds: int = 5
    ) -> Dict:
        """
        Run a debate between specified squad agents
        
        Args:
            problem: Problem to debate
            agent_names: List of agent names to include (e.g., ['qa', 'tech_lead', 'ux'])
            max_rounds: Maximum number of rounds
            
        Returns:
            Dictionary with debate results
        """
        logger.info(f"Starting squad debate with agents: {agent_names}")
        
        # Create agents
        agents = []
        for agent_name in agent_names:
            agent = self.create_agent_from_config(agent_name)
            if agent:
                agents.append(agent)
        
        if len(agents) < 2:
            return {
                "error": "Need at least 2 agents for debate",
                "problem": problem,
                "agents": agent_names
            }
        
        # Create user proxy
        user_proxy = UserProxyAgent(
            name="user_proxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            code_execution_config=False,
        )
        
        # Create group chat
        groupchat = GroupChat(
            agents=[user_proxy] + agents,
            messages=[],
            max_round=max_rounds,
        )
        
        # Create manager
        manager = GroupChatManager(
            groupchat=groupchat,
            llm_config=self.config,
        )
        
        # Start debate
        initial_message = f"""Problema para debate entre a squad: {problem}

Cada agente deve analisar o problema de sua perspectiva e contribuir com insights.
Busquem consenso quando apropriado."""
        
        try:
            user_proxy.initiate_chat(manager, message=initial_message)
        except Exception as e:
            logger.error(f"Error during debate: {e}")
            return {
                "problem": problem,
                "agents": agent_names,
                "error": str(e),
                "messages": []
            }
        
        # Extract results
        messages = groupchat.messages
        
        return {
            "problem": problem,
            "agents": agent_names,
            "messages": messages,
            "rounds": len(messages) // len(agents),
            "consensus_reached": self._check_consensus(messages)
        }
    
    def _check_consensus(self, messages: List[Dict]) -> bool:
        """Check if consensus was reached"""
        if len(messages) < 2:
            return False
        
        recent_messages = messages[-2:]
        consensus_keywords = ['concordo', 'consenso', 'acordo', 'alinhado']
        
        consensus_count = sum(
            1 for msg in recent_messages
            if any(keyword in msg.get('content', '').lower() for keyword in consensus_keywords)
        )
        
        return consensus_count >= 2
    
    def get_available_agents(self) -> List[str]:
        """Get list of available agent names"""
        return list(self.agent_configs.keys())
    
    def export_debate_log(self, result: Dict, filename: str = "squad_debate_log.json"):
        """Export debate log to JSON"""
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"Debate log exported to {filename}")


def main():
    """CLI for squad debates"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Run debate with AI Squad agents')
    parser.add_argument('--problem', type=str, required=True, help='Problem to debate')
    parser.add_argument('--agents', type=str, nargs='+', required=True,
                       help='Agent names (e.g., qa tech_lead ux)')
    parser.add_argument('--max-rounds', type=int, default=5, help='Maximum rounds')
    parser.add_argument('--use-ollama', action='store_true', help='Use Ollama')
    parser.add_argument('--agents-dir', type=str, default='agents', help='Agents directory')
    parser.add_argument('--output', type=str, default='squad_debate_log.json', help='Output file')
    
    args = parser.parse_args()
    
    # Initialize integration
    integration = SquadAutoGenIntegration(
        agents_dir=args.agents_dir,
        use_ollama=args.use_ollama
    )
    
    # Show available agents
    available = integration.get_available_agents()
    print(f"\nAgentes disponíveis: {', '.join(available)}")
    
    # Validate requested agents
    invalid_agents = [a for a in args.agents if a not in available]
    if invalid_agents:
        print(f"\n❌ Agentes inválidos: {', '.join(invalid_agents)}")
        sys.exit(1)
    
    # Run debate
    print(f"\n🎯 Iniciando debate com: {', '.join(args.agents)}")
    print(f"📋 Problema: {args.problem}\n")
    
    result = integration.run_squad_debate(
        problem=args.problem,
        agent_names=args.agents,
        max_rounds=args.max_rounds
    )
    
    # Print results
    print(f"\n{'='*60}")
    print(f"Resultados do Debate")
    print(f"{'='*60}")
    print(f"Problema: {result['problem']}")
    print(f"Agentes: {', '.join(result['agents'])}")
    print(f"Rodadas: {result.get('rounds', 0)}")
    print(f"Consenso: {'✅ Sim' if result.get('consensus_reached') else '❌ Não'}")
    
    if result.get('error'):
        print(f"\n❌ Erro: {result['error']}")
    
    # Export log
    integration.export_debate_log(result, args.output)
    print(f"\n📄 Log exportado: {args.output}")
    
    # Output JSON for Node.js integration
    print(json.dumps(result))


if __name__ == "__main__":
    main()

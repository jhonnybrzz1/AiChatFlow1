"""
AutoGen Framework with Mistral AI
Enables autonomous collaboration between AI agents with termination conditions
"""

import os
import sys
import json
import logging
import argparse
from typing import List, Dict, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager
except ImportError:
    logger.error("AutoGen not installed. Run: pip install pyautogen")
    sys.exit(1)


class MistralAutoGenDebate:
    """
    Manages autonomous debates between AI agents using AutoGen and Mistral
    """
    
    def __init__(self, use_ollama: bool = False, api_key: Optional[str] = None):
        """
        Initialize the debate system
        
        Args:
            use_ollama: If True, use local Ollama. If False, use Mistral API
            api_key: Mistral API key (if using API)
        """
        self.use_ollama = use_ollama
        self.api_key = api_key or os.getenv('MISTRAL_API_KEY')
        self.config = self._get_mistral_config()
        self.agents: Dict[str, AssistantAgent] = {}
        self.max_rounds = int(os.getenv('AUTOGEN_MAX_ROUNDS', '5'))
        
    def _get_mistral_config(self) -> Dict:
        """Get Mistral configuration for AutoGen"""
        if self.use_ollama:
            logger.info("Using Ollama for local Mistral")
            return {
                "config_list": [{
                    "model": os.getenv('OLLAMA_MODEL', 'mistral'),
                    "base_url": os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434/v1'),
                    "api_key": "ollama",  # Ollama doesn't need real API key
                }],
                "timeout": int(os.getenv('AUTOGEN_TIMEOUT', '300')),
                "temperature": 0.7,
            }
        else:
            if not self.api_key:
                logger.warning("No Mistral API key provided")
            
            logger.info("Using Mistral API")
            return {
                "config_list": [{
                    "model": os.getenv('MISTRAL_MODEL', 'mistral-large-latest'),
                    "api_key": self.api_key,
                    "base_url": "https://api.mistral.ai/v1",
                }],
                "timeout": int(os.getenv('AUTOGEN_TIMEOUT', '300')),
                "temperature": 0.7,
            }
    
    def create_critic_agent(self) -> AssistantAgent:
        """
        Create a critic agent that questions solutions
        """
        critic = AssistantAgent(
            name="critic",
            system_message="""Você é um crítico técnico experiente.
Seu papel é:
- Questionar soluções com ceticismo saudável
- Identificar potenciais problemas e riscos
- Solicitar dados e evidências
- Propor cenários de edge cases
- Garantir qualidade e robustez

Seja direto e objetivo. Use dados para embasar suas críticas.
Quando concordar com uma solução, diga explicitamente "concordo com esta solução".""",
            llm_config=self.config,
        )
        self.agents['critic'] = critic
        logger.info("Critic agent created")
        return critic
    
    def create_resolver_agent(self) -> AssistantAgent:
        """
        Create a resolver agent that proposes solutions
        """
        resolver = AssistantAgent(
            name="resolver",
            system_message="""Você é um solucionador de problemas inovador.
Seu papel é:
- Propor soluções práticas e inovadoras
- Responder às críticas com argumentos sólidos
- Adaptar soluções baseado em feedback
- Fornecer exemplos concretos
- Buscar consenso quando apropriado

Seja pragmático e focado em resultados.
Quando chegar a uma solução final, diga "concordo com esta abordagem".""",
            llm_config=self.config,
        )
        self.agents['resolver'] = resolver
        logger.info("Resolver agent created")
        return resolver
    
    def create_moderator_agent(self) -> AssistantAgent:
        """
        Create a moderator agent to guide the debate
        """
        moderator = AssistantAgent(
            name="moderator",
            system_message="""Você é um moderador de debates técnicos.
Seu papel é:
- Resumir pontos principais
- Identificar quando há consenso
- Manter o foco no problema
- Encerrar quando objetivos forem atingidos

Quando identificar consenso, diga "consenso alcançado".""",
            llm_config=self.config,
        )
        self.agents['moderator'] = moderator
        logger.info("Moderator agent created")
        return moderator
    
    def check_consensus(self, messages: List[Dict]) -> bool:
        """
        Check if agents reached consensus
        
        Args:
            messages: List of conversation messages
            
        Returns:
            True if consensus is reached
        """
        if len(messages) < 2:
            return False
        
        # Check last 2 messages for consensus keywords
        recent_messages = messages[-2:]
        consensus_keywords = ['concordo', 'consenso', 'acordo', 'alinhado']
        
        consensus_count = sum(
            1 for msg in recent_messages
            if any(keyword in msg.get('content', '').lower() for keyword in consensus_keywords)
        )
        
        return consensus_count >= 2
    
    def check_max_rounds(self, messages: List[Dict]) -> bool:
        """
        Check if maximum rounds reached
        
        Args:
            messages: List of conversation messages
            
        Returns:
            True if max rounds exceeded
        """
        return len(messages) >= self.max_rounds * 2
    
    def is_termination_msg(self, message: Dict) -> bool:
        """
        Check if message indicates termination
        
        Args:
            message: Message to check
            
        Returns:
            True if should terminate
        """
        content = message.get('content', '').lower()
        
        # Terminate if consensus keywords found
        termination_keywords = [
            'consenso alcançado',
            'concordo com esta solução',
            'concordo com esta abordagem',
            'solução final',
            'decisão final'
        ]
        
        if any(keyword in content for keyword in termination_keywords):
            logger.info(f"Termination detected: {content[:100]}")
            return True
        
        return False
    
    def run_debate(
        self,
        problem: str,
        max_rounds: Optional[int] = None,
        use_moderator: bool = False
    ) -> Dict:
        """
        Run a debate between critic and resolver agents
        
        Args:
            problem: The problem to debate
            max_rounds: Maximum number of rounds (overrides default)
            use_moderator: Whether to include moderator agent
            
        Returns:
            Dictionary with debate results
        """
        logger.info(f"Starting debate on: {problem}")
        
        # Create agents
        critic = self.create_critic_agent()
        resolver = self.create_resolver_agent()
        
        agents = [critic, resolver]
        if use_moderator:
            moderator = self.create_moderator_agent()
            agents.append(moderator)
        
        # Create user proxy to initiate the debate
        user_proxy = UserProxyAgent(
            name="user_proxy",
            human_input_mode="NEVER",
            max_consecutive_auto_reply=0,
            is_termination_msg=self.is_termination_msg,
            code_execution_config=False,
        )
        
        # Create group chat
        groupchat = GroupChat(
            agents=[user_proxy] + agents,
            messages=[],
            max_round=max_rounds or self.max_rounds,
        )
        
        # Create group chat manager
        manager = GroupChatManager(
            groupchat=groupchat,
            llm_config=self.config,
        )
        
        # Start the debate
        initial_message = f"""Problema para debate: {problem}

Crítico, por favor analise este problema e identifique potenciais riscos.
Resolvedor, proponha uma solução.

Lembrem-se: quando chegarem a um consenso, digam explicitamente "concordo"."""
        
        try:
            user_proxy.initiate_chat(
                manager,
                message=initial_message
            )
        except Exception as e:
            logger.error(f"Error during debate: {e}")
            return {
                "problem": problem,
                "messages": [],
                "rounds": 0,
                "consensus_reached": False,
                "error": str(e)
            }
        
        # Extract results
        messages = groupchat.messages
        
        return {
            "problem": problem,
            "messages": messages,
            "rounds": len(messages) // 2,
            "consensus_reached": self.check_consensus(messages),
            "final_message": messages[-1] if messages else None
        }
    
    def export_debate_log(self, result: Dict, filename: str = "debate_log.json"):
        """
        Export debate log to JSON file
        
        Args:
            result: Debate result dictionary
            filename: Output filename
        """
        with open(filename, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        logger.info(f"Debate log exported to {filename}")


def main():
    """Main entry point for CLI usage"""
    parser = argparse.ArgumentParser(description='Run AutoGen debate with Mistral')
    parser.add_argument('--problem', type=str, required=True, help='Problem to debate')
    parser.add_argument('--max-rounds', type=int, default=5, help='Maximum rounds')
    parser.add_argument('--use-ollama', action='store_true', help='Use Ollama instead of API')
    parser.add_argument('--use-moderator', action='store_true', help='Include moderator agent')
    parser.add_argument('--output', type=str, default='debate_log.json', help='Output file')
    parser.add_argument('--api-key', type=str, help='Mistral API key')
    
    args = parser.parse_args()
    
    # Initialize debate system
    debate = MistralAutoGenDebate(
        use_ollama=args.use_ollama,
        api_key=args.api_key
    )
    
    # Run debate
    result = debate.run_debate(
        problem=args.problem,
        max_rounds=args.max_rounds,
        use_moderator=args.use_moderator
    )
    
    # Print results
    print(f"\n{'='*60}")
    print(f"Debate Results")
    print(f"{'='*60}")
    print(f"Problem: {result['problem']}")
    print(f"Rounds: {result['rounds']}")
    print(f"Consensus: {result['consensus_reached']}")
    
    if result.get('error'):
        print(f"Error: {result['error']}")
    elif result['final_message']:
        print(f"\nFinal Message:")
        print(f"From: {result['final_message'].get('name', 'Unknown')}")
        print(f"Content: {result['final_message'].get('content', '')[:200]}...")
    
    # Export log
    debate.export_debate_log(result, args.output)
    
    # Output JSON for Node.js integration
    print(json.dumps(result))


if __name__ == "__main__":
    main()

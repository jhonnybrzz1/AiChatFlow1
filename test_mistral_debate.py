"""
Test suite for AutoGen Mistral debates
"""

import unittest
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from autogen_mistral import MistralAutoGenDebate


class TestMistralDebate(unittest.TestCase):
    """Test cases for Mistral AutoGen debates"""
    
    def setUp(self):
        """Set up test fixtures"""
        # Use Ollama for testing (faster and doesn't require API key)
        self.debate = MistralAutoGenDebate(use_ollama=True)
    
    def test_agent_creation(self):
        """Test that agents are created correctly"""
        critic = self.debate.create_critic_agent()
        resolver = self.debate.create_resolver_agent()
        
        self.assertIsNotNone(critic)
        self.assertIsNotNone(resolver)
        self.assertEqual(critic.name, "critic")
        self.assertEqual(resolver.name, "resolver")
        
        print("✅ Agent creation test passed")
    
    def test_moderator_creation(self):
        """Test moderator agent creation"""
        moderator = self.debate.create_moderator_agent()
        
        self.assertIsNotNone(moderator)
        self.assertEqual(moderator.name, "moderator")
        
        print("✅ Moderator creation test passed")
    
    def test_consensus_detection(self):
        """Test consensus detection logic"""
        # Test with consensus
        messages_with_consensus = [
            {"content": "Eu discordo desta abordagem"},
            {"content": "Concordo com esta solução"}
        ]
        self.assertTrue(self.debate.check_consensus(messages_with_consensus))
        
        # Test without consensus
        messages_without_consensus = [
            {"content": "Eu discordo desta abordagem"},
            {"content": "Não acho que isso funcione"}
        ]
        self.assertFalse(self.debate.check_consensus(messages_without_consensus))
        
        print("✅ Consensus detection test passed")
    
    def test_max_rounds(self):
        """Test max rounds detection"""
        # Create messages exceeding max rounds
        messages = [{"content": f"Message {i}"} for i in range(12)]
        
        self.assertTrue(self.debate.check_max_rounds(messages))
        
        # Test with fewer messages
        few_messages = [{"content": f"Message {i}"} for i in range(3)]
        self.assertFalse(self.debate.check_max_rounds(few_messages))
        
        print("✅ Max rounds test passed")
    
    def test_termination_message(self):
        """Test termination message detection"""
        # Test termination keywords
        termination_msg = {"content": "Consenso alcançado sobre esta solução"}
        self.assertTrue(self.debate.is_termination_msg(termination_msg))
        
        # Test non-termination message
        normal_msg = {"content": "Vamos continuar discutindo"}
        self.assertFalse(self.debate.is_termination_msg(normal_msg))
        
        print("✅ Termination message test passed")
    
    def test_config_ollama(self):
        """Test Ollama configuration"""
        debate_ollama = MistralAutoGenDebate(use_ollama=True)
        config = debate_ollama.config
        
        self.assertIn('config_list', config)
        self.assertEqual(config['config_list'][0]['model'], 'mistral')
        
        print("✅ Ollama config test passed")
    
    def test_config_api(self):
        """Test API configuration"""
        debate_api = MistralAutoGenDebate(use_ollama=False, api_key="test_key")
        config = debate_api.config
        
        self.assertIn('config_list', config)
        self.assertEqual(config['config_list'][0]['api_key'], "test_key")
        
        print("✅ API config test passed")


class TestDebateIntegration(unittest.TestCase):
    """Integration tests for full debate scenarios"""
    
    @unittest.skipIf(
        not os.getenv('RUN_INTEGRATION_TESTS'),
        "Integration tests disabled. Set RUN_INTEGRATION_TESTS=1 to run"
    )
    def test_simple_debate(self):
        """Test a simple debate scenario (requires Ollama running)"""
        debate = MistralAutoGenDebate(use_ollama=True)
        
        problem = "Qual a melhor estrutura de dados para cache distribuído?"
        
        result = debate.run_debate(problem, max_rounds=3)
        
        self.assertIsNotNone(result)
        self.assertEqual(result['problem'], problem)
        self.assertGreater(len(result.get('messages', [])), 0)
        
        print(f"✅ Simple debate test passed")
        print(f"   Rounds: {result['rounds']}")
        print(f"   Consensus: {result['consensus_reached']}")


def run_tests():
    """Run all tests"""
    print("\n" + "="*60)
    print("Running AutoGen Mistral Tests")
    print("="*60 + "\n")
    
    # Create test suite
    loader = unittest.TestLoader()
    suite = unittest.TestSuite()
    
    # Add test cases
    suite.addTests(loader.loadTestsFromTestCase(TestMistralDebate))
    suite.addTests(loader.loadTestsFromTestCase(TestDebateIntegration))
    
    # Run tests
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    
    # Print summary
    print("\n" + "="*60)
    print(f"Tests run: {result.testsRun}")
    print(f"Failures: {len(result.failures)}")
    print(f"Errors: {len(result.errors)}")
    print(f"Success rate: {((result.testsRun - len(result.failures) - len(result.errors)) / result.testsRun * 100):.1f}%")
    print("="*60)
    
    return result.wasSuccessful()


if __name__ == '__main__':
    success = run_tests()
    sys.exit(0 if success else 1)

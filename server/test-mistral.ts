import { mistralAIService } from './services/mistral-ai';

// This script tests the Mistral AI integration
async function testMistralAI() {
  console.log('Testing Mistral AI integration...');
  
  try {
    // Test basic chat completion
    console.log('Testing basic chat completion...');
    const response = await mistralAIService.generateChatCompletion(
      'You are a helpful assistant.',
      'What is the capital of France?',
      { temperature: 0.7 }
    );
    console.log('Response:', response);
    console.log('Basic chat completion test passed!');
    
    // Test multiple chat completions
    console.log('\nTesting multiple chat completions...');
    const responses = await mistralAIService.generateMultipleChatCompletions(
      [
        { 
          systemPrompt: 'You are a helpful assistant.', 
          userPrompt: 'What is the capital of Italy?' 
        },
        { 
          systemPrompt: 'You are a helpful assistant.', 
          userPrompt: 'What is the capital of Germany?' 
        }
      ],
      { temperature: 0.7 }
    );
    console.log('Responses:');
    responses.forEach((resp, i) => {
      console.log(`Response ${i + 1}:`, resp);
    });
    console.log('Multiple chat completions test passed!');
    
    // Test JSON response
    console.log('\nTesting JSON response...');
    const jsonResponse = await mistralAIService.generateJSONResponse(
      'You are a helpful assistant that provides information in JSON format.',
      'Provide information about France, including capital, population, and language.',
      { temperature: 0.3 }
    );
    console.log('JSON Response:', JSON.stringify(jsonResponse, null, 2));
    console.log('JSON response test passed!');
    
    console.log('\nAll tests passed! Mistral AI integration is working correctly.');
  } catch (error) {
    console.error('Error testing Mistral AI integration:', error);
    process.exit(1);
  }
}

// Run the test
testMistralAI();




import { aiSquadService } from './server/services/ai-squad.js';
import { storage } from './server/storage.js';

async function testAISquad() {
  try {
    // Create a test demand
    const demand = {
      id: 999,
      title: "Test Demand for PDF Generation",
      description: "This is a test demand to verify the AI squad and PDF generation work correctly",
      type: "nova_funcionalidade",
      priority: "alta",
      status: "processing",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      chatMessages: [],
      prdUrl: null,
      tasksUrl: null
    };

    // Insert into storage
    await storage.createDemand(demand);

    // Process the demand
    console.log("Starting AI squad processing...");
    await aiSquadService.processDemand(999, (message) => {
      console.log(`Progress: ${message.agent} - ${message.message}`);
    });

    // Get the updated demand
    const updatedDemand = await storage.getDemand(999);
    console.log("Demand processing completed!");
    console.log("PRD URL:", updatedDemand?.prdUrl);
    console.log("Tasks URL:", updatedDemand?.tasksUrl);

    // Check if documents were created
    if (updatedDemand?.prdUrl) {
      console.log("Documents generated successfully!");
    } else {
      console.log("No documents were generated.");
    }
  } catch (error) {
    console.error("Error during test:", error);
  }
}

testAISquad().then(() => {
  console.log("Test completed!");
}).catch(error => {
  console.error("Test failed:", error);
});



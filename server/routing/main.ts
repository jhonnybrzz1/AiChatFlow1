// server/routing/main.ts - Main entry point for the routing system

import { demandRoutingOrchestrator } from './orchestrator';
import { DiscoveryPlugin } from '../plugins/discovery-plugin';
import { BugPlugin } from '../plugins/bug-plugin';
import { ImprovementPlugin } from '../plugins/improvement-plugin';
import { FeaturePlugin } from '../plugins/feature-plugin';

/**
 * Initializes the demand routing system
 */
export async function initializeRoutingSystem(): Promise<void> {
  console.log('Initializing demand routing system...');

  try {
    // Initialize the routing orchestrator
    await demandRoutingOrchestrator.initialize();

    // Register plugins
    demandRoutingOrchestrator.registerPlugin(new FeaturePlugin());
    demandRoutingOrchestrator.registerPlugin(new DiscoveryPlugin());
    demandRoutingOrchestrator.registerPlugin(new BugPlugin());
    demandRoutingOrchestrator.registerPlugin(new ImprovementPlugin());

    console.log('Demand routing system initialized successfully');
  } catch (error) {
    console.error('Error initializing routing system:', error);
    throw error;
  }
}

export { demandRoutingOrchestrator } from './orchestrator';
export { metricsCollector } from './metrics-collector';

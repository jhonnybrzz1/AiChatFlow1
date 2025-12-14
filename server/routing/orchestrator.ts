import { DataCollector } from './data-collector';
import { MLRouter, RoutingPrediction } from './ml-router';
import { BasePlugin, DemandContext } from '../plugins/base-plugin';
import { storage } from '../storage';
import { Demand } from '@shared/schema';
import { metricsCollector, PluginExecutionMetrics } from './metrics-collector';

export class DemandRoutingOrchestrator {
  private dataCollector: DataCollector;
  private mlRouter: MLRouter;
  private plugins: BasePlugin[] = [];
  
  constructor() {
    this.dataCollector = new DataCollector();
    this.mlRouter = new MLRouter();
  }

  /**
   * Initializes the routing system by loading/training the ML model and plugins
   */
  async initialize(): Promise<void> {
    console.log('Initializing demand routing system...');
    
    // Load or train the ML model
    const loaded = await this.mlRouter.loadModel();
    if (!loaded) {
      console.log('Training ML model with historical data...');
      const historicalData = await this.dataCollector.getOrCreateDataset();
      await this.mlRouter.train(historicalData);
    }
    
    console.log('Demand routing system initialized successfully');
  }

  /**
   * Registers a plugin to be used in the routing system
   * @param plugin - The plugin to register
   */
  registerPlugin(plugin: BasePlugin): void {
    this.plugins.push(plugin);
    // Sort plugins by priority
    this.plugins.sort((a, b) => a.getPriority() - b.getPriority());
    console.log(`Registered plugin: ${plugin.name} with priority: ${plugin.getPriority()}`);
  }

  /**
   * Routes a demand using ML prediction and applicable plugins
   * @param demandId - The ID of the demand to route
   */
  async routeDemand(demandId: number): Promise<RoutingPrediction> {
    // Get the demand from storage
    const demand = await storage.getDemand(demandId);
    if (!demand) {
      throw new Error(`Demand with ID ${demandId} not found`);
    }

    // Get ML prediction for routing
    const startTime = Date.now();
    const prediction = await this.mlRouter.predictRoute(
      demand.type,
      demand.title,
      demand.description,
      demand.priority
    );
    const routingTime = Date.now() - startTime;

    // Create demand context
    const context: DemandContext = {
      demand,
      routingPrediction: prediction
    };

    // Find and execute applicable plugins
    const applicablePlugins = this.plugins.filter(plugin =>
      plugin.isEnabled() && plugin.canProcess(context)
    );

    console.log(`Found ${applicablePlugins.length} applicable plugins for demand ${demandId}`);

    const pluginMetrics: PluginExecutionMetrics[] = [];

    for (const plugin of applicablePlugins) {
      const pluginStartTime = Date.now();
      console.log(`Executing plugin: ${plugin.name} for demand ${demandId}`);
      const result = await plugin.process(context);
      const pluginExecutionTime = Date.now() - pluginStartTime;

      pluginMetrics.push({
        pluginName: plugin.name,
        executionTime: pluginExecutionTime,
        success: result.success,
        resultSize: result.data ? JSON.stringify(result.data).length : 0
      });

      if (!result.success) {
        console.warn(`Plugin ${plugin.name} failed for demand ${demandId}: ${result.message}`);
      } else {
        // Update context with plugin results if needed
        context.additionalData = {
          ...context.additionalData,
          [plugin.name]: result.data
        };
      }
    }

    // Update demand with routing information
    await storage.updateDemand(demandId, {
      ...demand,
      status: 'routed', // Update status to indicate it's been through routing
    });

    // Record metrics for this demand
    await metricsCollector.recordDemandMetrics(
      demand,
      prediction.team,
      prediction.confidence,
      prediction.estimated_resolution_time,
      prediction.estimated_success_rate,
      pluginMetrics
    );

    return prediction;
  }

  /**
   * Gets all registered plugins
   */
  getPlugins(): BasePlugin[] {
    return [...this.plugins];
  }

  /**
   * Gets the ML router instance
   */
  getMLRouter(): MLRouter {
    return this.mlRouter;
  }

  /**
   * Gets the data collector instance
   */
  getDataCollector(): DataCollector {
    return this.dataCollector;
  }
}

// Create a singleton instance
export const demandRoutingOrchestrator = new DemandRoutingOrchestrator();
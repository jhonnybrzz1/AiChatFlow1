// Export all routing-related modules

// Core routing components
export { DataCollector, type HistoricalDemandData } from './data-collector';
export { MLRouter, type RoutingPrediction } from './ml-router';
export { DemandRoutingOrchestrator, demandRoutingOrchestrator } from './orchestrator';

// Plugin system
export { BasePlugin, type PluginResult, type PluginConfig, type DemandContext } from '../plugins/base-plugin';
export { DiscoveryPlugin } from '../plugins/discovery-plugin';
export { BugPlugin } from '../plugins/bug-plugin';
export { ImprovementPlugin } from '../plugins/improvement-plugin';

// Metrics
export { metricsCollector, type DemandMetrics, type SystemMetrics } from './metrics-collector';
import { Demand } from '@shared/schema';
import { storage } from '../storage';
import fs from 'fs';
import path from 'path';

export interface DemandMetrics {
  demandId: number;
  type: string;
  priority: string;
  routingTeam: string;
  routingConfidence: number;
  estimatedResolutionTime: number;
  estimatedSuccessRate: number;
  actualResolutionTime: number;
  actualSuccess: boolean;
  createdAt: string;
  completedAt: string | null;
  processingTime: number;
  pluginExecutions: PluginExecutionMetrics[];
}

export interface PluginExecutionMetrics {
  pluginName: string;
  executionTime: number;
  success: boolean;
  resultSize: number;
}

export interface SystemMetrics {
  totalDemandsProcessed: number;
  averageRoutingConfidence: number;
  successRate: number;
  averageResolutionTime: number;
  pluginEffectiveness: Record<string, PluginEffectiveness>;
}

export interface PluginEffectiveness {
  name: string;
  totalExecutions: number;
  successfulExecutions: number;
  averageExecutionTime: number;
  usefulnessScore: number; // 0-100 based on impact on success
}

export class MetricsCollector {
  private static readonly METRICS_PATH = path.join(process.cwd(), 'data', 'demand_metrics.json');
  private static readonly SYSTEM_METRICS_PATH = path.join(process.cwd(), 'data', 'system_metrics.json');

  private metrics: DemandMetrics[] = [];
  private systemMetrics: SystemMetrics | null = null;

  constructor() {
    this.loadMetricsFromStorage();
  }

  /**
   * Records metrics for a completed demand
   * @param demand - The demand that was processed
   * @param routingTeam - The team the demand was routed to
   * @param routingConfidence - The confidence in the routing decision
   * @param estimatedResolutionTime - Estimated resolution time
   * @param estimatedSuccessRate - Estimated success rate
   * @param pluginMetrics - Metrics from plugin executions
   */
  async recordDemandMetrics(
    demand: Demand,
    routingTeam: string,
    routingConfidence: number,
    estimatedResolutionTime: number,
    estimatedSuccessRate: number,
    pluginMetrics: PluginExecutionMetrics[] = []
  ): Promise<void> {
    try {
      // Calculate actual metrics
      const createdAt = demand.createdAt ? new Date(demand.createdAt) : new Date();
      const completedAt = demand.updatedAt ? new Date(demand.updatedAt) : new Date();
      const actualResolutionTime = Math.floor((completedAt.getTime() - createdAt.getTime()) / (1000 * 60)); // in minutes
      const actualSuccess = demand.status === 'completed';

      const processingTime = actualResolutionTime; // In minutes

      // Create metrics record
      const metrics: DemandMetrics = {
        demandId: demand.id || 0,
        type: demand.type,
        priority: demand.priority,
        routingTeam,
        routingConfidence,
        estimatedResolutionTime,
        estimatedSuccessRate,
        actualResolutionTime,
        actualSuccess,
        createdAt: createdAt.toISOString(),
        completedAt: completedAt.toISOString(),
        processingTime,
        pluginExecutions: pluginMetrics
      };

      // Add to in-memory collection
      this.metrics.push(metrics);

      // Save metrics to file
      this.saveMetricsToFile();

      // Update system metrics
      await this.updateSystemMetrics();

      console.log(`Metrics recorded for demand ${demand.id}`);
    } catch (error) {
      console.error('Error recording demand metrics:', error);
    }
  }

  /**
   * Loads metrics from storage
   */
  private loadMetricsFromStorage(): void {
    try {
      if (fs.existsSync(MetricsCollector.METRICS_PATH)) {
        const data = fs.readFileSync(MetricsCollector.METRICS_PATH, 'utf-8');
        this.metrics = JSON.parse(data) as DemandMetrics[];
      } else {
        this.metrics = [];
      }
    } catch (error) {
      console.error('Error loading metrics from storage:', error);
      this.metrics = [];
    }
  }

  /**
   * Saves metrics to file
   */
  private saveMetricsToFile(): void {
    try {
      const dir = path.dirname(MetricsCollector.METRICS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(MetricsCollector.METRICS_PATH, JSON.stringify(this.metrics, null, 2));
    } catch (error) {
      console.error('Error saving metrics to file:', error);
    }
  }

  /**
   * Updates system-level metrics based on demand metrics
   */
  private async updateSystemMetrics(): Promise<void> {
    if (this.metrics.length === 0) {
      this.systemMetrics = {
        totalDemandsProcessed: 0,
        averageRoutingConfidence: 0,
        successRate: 0,
        averageResolutionTime: 0,
        pluginEffectiveness: {}
      };
      return;
    }

    const completedDemands = this.metrics.filter(m => m.actualSuccess);
    const totalDemands = this.metrics.length;
    
    const totalConfidence = this.metrics.reduce((sum, metric) => sum + metric.routingConfidence, 0);
    const averageRoutingConfidence = totalConfidence / totalDemands;
    
    const totalSuccessRate = completedDemands.length / totalDemands * 100;
    
    const totalResolutionTime = this.metrics.reduce((sum, metric) => sum + metric.actualResolutionTime, 0);
    const averageResolutionTime = totalResolutionTime / totalDemands;

    // Calculate plugin effectiveness
    const pluginEffectiveness: Record<string, PluginEffectiveness> = {};
    
    for (const metric of this.metrics) {
      for (const pluginMetric of metric.pluginExecutions) {
        if (!pluginEffectiveness[pluginMetric.pluginName]) {
          pluginEffectiveness[pluginMetric.pluginName] = {
            name: pluginMetric.pluginName,
            totalExecutions: 0,
            successfulExecutions: 0,
            averageExecutionTime: 0,
            usefulnessScore: 0
          };
        }
        
        const pe = pluginEffectiveness[pluginMetric.pluginName];
        pe.totalExecutions++;
        pe.averageExecutionTime = ((pe.averageExecutionTime * (pe.totalExecutions - 1)) + pluginMetric.executionTime) / pe.totalExecutions;
        
        if (pluginMetric.success) {
          pe.successfulExecutions++;
        }
      }
    }

    // Calculate usefulness scores based on correlation with success
    for (const pluginName in pluginEffectiveness) {
      const pe = pluginEffectiveness[pluginName];
      pe.usefulnessScore = (pe.successfulExecutions / pe.totalExecutions) * 100;
    }

    this.systemMetrics = {
      totalDemandsProcessed: totalDemands,
      averageRoutingConfidence,
      successRate: totalSuccessRate,
      averageResolutionTime,
      pluginEffectiveness
    };

    // Save system metrics to file
    this.saveSystemMetricsToFile();
  }

  /**
   * Saves system metrics to file
   */
  private saveSystemMetricsToFile(): void {
    try {
      if (this.systemMetrics) {
        const dir = path.dirname(MetricsCollector.SYSTEM_METRICS_PATH);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(MetricsCollector.SYSTEM_METRICS_PATH, JSON.stringify(this.systemMetrics, null, 2));
      }
    } catch (error) {
      console.error('Error saving system metrics to file:', error);
    }
  }

  /**
   * Gets all recorded demand metrics
   */
  getDemandMetrics(): DemandMetrics[] {
    return [...this.metrics];
  }

  /**
   * Gets system-level metrics
   */
  getSystemMetrics(): SystemMetrics | null {
    return this.systemMetrics;
  }

  /**
   * Gets metrics for a specific demand
   * @param demandId - The ID of the demand
   */
  getDemandMetricsById(demandId: number): DemandMetrics | undefined {
    return this.metrics.find(m => m.demandId === demandId);
  }

  /**
   * Gets metrics summary for a specific demand type
   * @param type - The demand type
   */
  getMetricsByType(type: string): DemandMetrics[] {
    return this.metrics.filter(m => m.type === type);
  }

  /**
   * Gets recent metrics (last N demands)
   * @param count - Number of recent demands to return
   */
  getRecentMetrics(count: number): DemandMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Calculates improvement metrics compared to baseline
   */
  calculateImprovementMetrics(baselineMetrics?: SystemMetrics): any {
    if (!baselineMetrics && this.systemMetrics) {
      // If no baseline provided, we'll compare to a theoretical baseline
      // For example, if we know the previous success rate was 50% and current is 75%
      return {
        successRateImprovement: this.systemMetrics.successRate - 50, // Assuming 50% baseline
        resolutionTimeImprovement: (this.systemMetrics.averageResolutionTime - 240) * -1, // Assuming 4h baseline
        routingConfidenceImprovement: this.systemMetrics.averageRoutingConfidence - 60 // Assuming 60% baseline
      };
    }
    
    if (baselineMetrics && this.systemMetrics) {
      return {
        successRateImprovement: this.systemMetrics.successRate - baselineMetrics.successRate,
        resolutionTimeImprovement: baselineMetrics.averageResolutionTime - this.systemMetrics.averageResolutionTime,
        routingConfidenceImprovement: this.systemMetrics.averageRoutingConfidence - baselineMetrics.averageRoutingConfidence
      };
    }
    
    return {
      successRateImprovement: 0,
      resolutionTimeImprovement: 0,
      routingConfidenceImprovement: 0
    };
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();
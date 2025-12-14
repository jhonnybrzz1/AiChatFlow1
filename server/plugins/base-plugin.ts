import { Demand } from '@shared/schema';

export interface PluginResult {
  success: boolean;
  message: string;
  data?: any;
  metadata?: Record<string, any>;
}

export interface PluginConfig {
  enabled: boolean;
  priority: number; // Lower numbers go first
  settings: Record<string, any>;
}

export interface DemandContext {
  demand: Demand;
  routingPrediction?: any;
  additionalData?: Record<string, any>;
}

export abstract class BasePlugin {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly type: string[]; // Types of demands this plugin supports (e.g., ['discovery', 'bug'])
  
  protected config: PluginConfig;
  
  constructor(config?: Partial<PluginConfig>) {
    this.config = {
      enabled: config?.enabled ?? true,
      priority: config?.priority ?? 10,
      settings: config?.settings ?? {}
    };
  }
  
  /**
   * Validates if this plugin can process the given demand
   * @param context - The demand context
   * @returns True if plugin can process this demand
   */
  abstract canProcess(context: DemandContext): boolean;
  
  /**
   * Processes the demand and returns a result
   * @param context - The demand context
   * @returns Plugin result
   */
  abstract process(context: DemandContext): Promise<PluginResult>;
  
  /**
   * Gets the plugin configuration
   */
  getConfig(): PluginConfig {
    return this.config;
  }
  
  /**
   * Updates the plugin configuration
   * @param newConfig - New configuration
   */
  updateConfig(newConfig: Partial<PluginConfig>): void {
    this.config = {
      ...this.config,
      ...newConfig
    };
  }
  
  /**
   * Checks if the plugin is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Gets the priority of the plugin
   */
  getPriority(): number {
    return this.config.priority;
  }
  
  /**
   * Gets the supported demand types
   */
  getSupportedTypes(): string[] {
    return this.type;
  }
}
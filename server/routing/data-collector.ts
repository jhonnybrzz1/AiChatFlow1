import { storage } from '../storage';
import { Demand } from '@shared/schema';
import { getDemandTypeConfig } from '@shared/demand-types';
import fs from 'fs';
import path from 'path';

export interface HistoricalDemandData {
  demand_id: number;
  title: string;
  description: string;
  type: string;
  priority: string;
  complexity: number;
  resolution_time: number;
  team: string;
  success_rate: number;
  created_at: string;
  updated_at: string;
}

export class DataCollector {
  private static readonly DATASET_PATH = path.join(process.cwd(), 'data', 'historical_demands.csv');

  /**
   * Collects historical demand data from storage
   * @returns Promise<HistoricalDemandData[]>
   */
  async collectHistoricalData(): Promise<HistoricalDemandData[]> {
    try {
      // Get all demands from storage
      const demands: Demand[] = await storage.getAllDemands();

      // Calculate complexity score based on various factors
      const historicalData: HistoricalDemandData[] = demands.map(demand => ({
        demand_id: demand.id!,
        title: demand.title,
        description: demand.description,
        type: demand.type,
        priority: demand.priority,
        complexity: this.calculateComplexityScore(demand),
        resolution_time: this.calculateResolutionTime(demand),
        team: this.estimateTeamBasedOnType(demand.type), // For now, estimate team based on type
        success_rate: this.calculateSuccessRate(demand),
        created_at: demand.createdAt!.toISOString(),
        updated_at: demand.updatedAt!.toISOString()
      }));

      return historicalData;
    } catch (error) {
      console.error('Error collecting historical data:', error);
      throw new Error('Failed to collect historical demand data');
    }
  }

  /**
   * Calculates complexity score based on demand characteristics
   * @param demand - The demand object
   * @returns Complexity score (0-100)
   */
  private calculateComplexityScore(demand: Demand): number {
    let score = 50; // Base score

    score += getDemandTypeConfig(demand.type).complexityAdjustment;

    // Priority-based adjustment
    switch (demand.priority) {
      case 'critica':
        score += 10; // Critical demands might be complex
        break;
      case 'alta':
        score += 5; // High priority might indicate complexity
        break;
    }

    // Description length as complexity indicator
    const descriptionLength = demand.description.length;
    if (descriptionLength > 500) score += 15;
    else if (descriptionLength > 250) score += 10;
    else if (descriptionLength > 100) score += 5;

    // Cap the score between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Estimates resolution time based on demand characteristics
   * @param demand - The demand object
   * @returns Estimated resolution time in minutes
   */
  private calculateResolutionTime(demand: Demand): number {
    // For now, this is an estimation since we don't have actual resolution times
    // In a real scenario, this would come from actual data
    let time = 120; // Base time in minutes

    // Adjust based on complexity score
    const complexity = this.calculateComplexityScore(demand);
    time = time * (complexity / 50); // Scale with complexity

    time *= getDemandTypeConfig(demand.type).resolutionMultiplier;

    return Math.round(time);
  }

  /**
   * Estimates team based on demand type
   * @param type - Demand type
   * @returns Estimated team name
   */
  private estimateTeamBasedOnType(type: string): string {
    return getDemandTypeConfig(type).defaultTeam;
  }

  /**
   * Calculates success rate based on demand status
   * @param demand - The demand object
   * @returns Success rate (0-100)
   */
  private calculateSuccessRate(demand: Demand): number {
    // For now, just return 75% as base success rate
    // In a real system, this would come from historical outcomes
    if (demand.status === 'completed') return 85;
    else if (demand.status === 'error') return 20;
    else if (demand.status === 'stopped') return 30;
    return 75;
  }

  /**
   * Saves collected data to CSV file
   * @param data - Historical demand data
   */
  async saveDataset(data: HistoricalDemandData[]): Promise<void> {
    const csvHeader = 'demand_id,title,description,type,priority,complexity,resolution_time,team,success_rate,created_at,updated_at\n';
    const csvRows = data.map(row => {
      // Escape commas and quotes in text fields
      const escapedRow = {
        demand_id: row.demand_id,
        title: `"${row.title.replace(/"/g, '""')}"`,
        description: `"${row.description.replace(/"/g, '""')}"`,
        type: row.type,
        priority: row.priority,
        complexity: row.complexity,
        resolution_time: row.resolution_time,
        team: row.team,
        success_rate: row.success_rate,
        created_at: row.created_at,
        updated_at: row.updated_at
      };
      return Object.values(escapedRow).join(',');
    }).join('\n');

    // Ensure data directory exists
    const dataDir = path.dirname(DataCollector.DATASET_PATH);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // Write to CSV file
    fs.writeFileSync(DataCollector.DATASET_PATH, csvHeader + csvRows);
    console.log(`Dataset saved to ${DataCollector.DATASET_PATH}`);
  }

  /**
   * Loads dataset from CSV file
   * @returns Historical demand data
   */
  async loadDataset(): Promise<HistoricalDemandData[]> {
    if (!fs.existsSync(DataCollector.DATASET_PATH)) {
      throw new Error(`Dataset file does not exist: ${DataCollector.DATASET_PATH}`);
    }

    const fileContent = fs.readFileSync(DataCollector.DATASET_PATH, 'utf-8');
    const lines = fileContent.split('\n');
    const headers = lines[0].split(',');

    const data: HistoricalDemandData[] = [];
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;

      const values = lines[i].replace(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/g, '\t').split('\t');
      const row: any = {};

      for (let j = 0; j < headers.length; j++) {
        let value = values[j]?.trim();

        // Remove quotes from quoted strings
        if (value && value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1).replace(/""/g, '"');
        }

        row[headers[j]] = value;
      }

      data.push({
        demand_id: parseInt(row['demand_id']),
        title: row['title'],
        description: row['description'],
        type: row['type'],
        priority: row['priority'],
        complexity: parseFloat(row['complexity']),
        resolution_time: parseInt(row['resolution_time']),
        team: row['team'],
        success_rate: parseFloat(row['success_rate']),
        created_at: row['created_at'],
        updated_at: row['updated_at']
      });
    }

    return data;
  }

  /**
   * Gets or creates dataset, collecting fresh data if it doesn't exist
   * @returns Historical demand data
   */
  async getOrCreateDataset(): Promise<HistoricalDemandData[]> {
    try {
      return await this.loadDataset();
    } catch (error) {
      console.log('Dataset not found, collecting fresh data...');
      const data = await this.collectHistoricalData();
      await this.saveDataset(data);
      return data;
    }
  }
}

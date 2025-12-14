import { HistoricalDemandData } from './data-collector';
import fs from 'fs';
import path from 'path';

export interface RoutingPrediction {
  team: string;
  confidence: number; // 0-100
  estimated_resolution_time: number; // in minutes
  estimated_success_rate: number; // 0-100
}

export class MLRouter {
  private modelPath: string;
  private modelTrained: boolean = false;
  private modelData: HistoricalDemandData[] = [];

  constructor() {
    this.modelPath = path.join(process.cwd(), 'server', 'ml_models', 'routing_model.json');
  }

  /**
   * Trains the ML model using historical data
   * @param data - Historical demand data
   */
  async train(data: HistoricalDemandData[]): Promise<void> {
    console.log('Training ML model with', data.length, 'historical records');

    // In a real scenario, this would train a machine learning model
    // For this implementation, we'll use statistical analysis of the data
    this.modelData = data;
    
    // Calculate statistics for different demand types and teams
    const statsByTypeAndTeam: Record<string, Record<string, {
      count: number;
      avg_success_rate: number;
      avg_resolution_time: number;
    }>> = {};

    for (const record of data) {
      const type = record.type;
      const team = record.team;
      
      if (!statsByTypeAndTeam[type]) {
        statsByTypeAndTeam[type] = {};
      }
      
      if (!statsByTypeAndTeam[type][team]) {
        statsByTypeAndTeam[type][team] = {
          count: 0,
          avg_success_rate: 0,
          avg_resolution_time: 0
        };
      }
      
      statsByTypeAndTeam[type][team].count++;
      statsByTypeAndTeam[type][team].avg_success_rate += record.success_rate;
      statsByTypeAndTeam[type][team].avg_resolution_time += record.resolution_time;
    }

    // Calculate averages
    for (const type in statsByTypeAndTeam) {
      for (const team in statsByTypeAndTeam[type]) {
        const stat = statsByTypeAndTeam[type][team];
        stat.avg_success_rate /= stat.count;
        stat.avg_resolution_time /= stat.count;
      }
    }

    // Store the calculated statistics in the model
    const model = {
      statsByTypeAndTeam,
      modelData: data, // Store the model data for reference
      trainedAt: new Date().toISOString()
    };

    // Create directory if it doesn't exist
    const dir = path.dirname(this.modelPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save the trained model
    fs.writeFileSync(this.modelPath, JSON.stringify(model, null, 2));
    this.modelTrained = true;

    console.log('ML model trained successfully');
  }

  /**
   * Loads the trained model from file
   */
  async loadModel(): Promise<boolean> {
    try {
      if (fs.existsSync(this.modelPath)) {
        const modelStr = fs.readFileSync(this.modelPath, 'utf-8');
        const model = JSON.parse(modelStr);
        this.modelData = model.modelData || [];
        this.modelTrained = true;
        console.log('Trained ML model loaded successfully');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error loading trained model:', error);
      return false;
    }
  }

  /**
   * Predicts the best team for a new demand
   * @param demandType - Type of the demand
   * @param demandTitle - Title of the demand
   * @param demandDescription - Description of the demand
   * @param priority - Priority of the demand
   * @returns Prediction including team, confidence, etc.
   */
  async predictRoute(
    demandType: string,
    demandTitle: string,
    demandDescription: string,
    priority: string
  ): Promise<RoutingPrediction> {
    // If model isn't trained yet, return a default prediction
    if (!this.modelTrained) {
      const defaultPrediction: RoutingPrediction = {
        team: this.getDefaultTeam(demandType),
        confidence: 60, // Default confidence
        estimated_resolution_time: this.getDefaultResolutionTime(demandType),
        estimated_success_rate: 65 // Default success rate
      };
      return defaultPrediction;
    }

    // Calculate complexity based on demand features
    const complexity = this.calculateFeatureScore(demandDescription, demandType, priority);

    // Find the best team based on historical data for this type of demand
    const bestTeam = this.findBestTeamForType(demandType, complexity);

    // Calculate confidence based on available data
    const confidence = this.calculateConfidence(demandType, bestTeam);

    // Get estimated resolution time and success rate
    const est_resolution_time = this.estimateResolutionTime(demandType, priority, complexity);
    const est_success_rate = this.estimateSuccessRate(demandType, priority, complexity);

    return {
      team: bestTeam,
      confidence,
      estimated_resolution_time: Math.round(est_resolution_time),
      estimated_success_rate: Math.round(est_success_rate)
    };
  }

  /**
   * Gets the default team for a demand type
   * @param demandType - Type of the demand
   * @returns Default team name
   */
  private getDefaultTeam(demandType: string): string {
    switch (demandType) {
      case 'nova_funcionalidade':
        return 'backend-frontend';
      case 'melhoria':
        return 'fullstack';
      case 'bug':
        return 'support';
      case 'discovery':
        return 'research';
      case 'analise_exploratoria':
        return 'analytics';
      default:
        return 'general';
    }
  }

  /**
   * Gets default resolution time for a demand type
   * @param demandType - Type of the demand
   * @returns Default resolution time in minutes
   */
  private getDefaultResolutionTime(demandType: string): number {
    switch (demandType) {
      case 'nova_funcionalidade':
        return 480; // 8 hours
      case 'melhoria':
        return 240; // 4 hours
      case 'bug':
        return 120; // 2 hours
      case 'discovery':
        return 360; // 6 hours
      case 'analise_exploratoria':
        return 720; // 12 hours
      default:
        return 240; // 4 hours
    }
  }

  /**
   * Calculates a score based on features of the demand
   * @param description - Demand description
   * @param type - Demand type
   * @param priority - Demand priority
   * @returns Complexity score
   */
  private calculateFeatureScore(description: string, type: string, priority: string): number {
    let score = 50; // Base score
    
    // Type-based adjustment
    switch (type) {
      case 'nova_funcionalidade':
        score += 20;
        break;
      case 'melhoria':
        score += 10;
        break;
      case 'bug':
        score -= 5;
        break;
      case 'discovery':
        score += 15;
        break;
      case 'analise_exploratoria':
        score += 25;
        break;
    }
    
    // Priority-based adjustment
    switch (priority) {
      case 'critica':
        score += 15;
        break;
      case 'alta':
        score += 10;
        break;
      case 'media':
        score += 5;
        break;
    }
    
    // Description length as complexity indicator
    if (description.length > 500) score += 15;
    else if (description.length > 250) score += 10;
    else if (description.length > 100) score += 5;
    
    // Keywords that indicate complexity
    const complexityKeywords = ['database', 'integration', 'security', 'authentication', 'scalability', 'performance'];
    for (const keyword of complexityKeywords) {
      if (description.toLowerCase().includes(keyword.toLowerCase())) {
        score += 10;
      }
    }
    
    return Math.max(10, Math.min(100, score));
  }

  /**
   * Finds the best team for a specific demand type based on historical performance
   * @param demandType - Type of the demand
   * @param complexity - Complexity score
   * @returns Best team name
   */
  private findBestTeamForType(demandType: string, complexity: number): string {
    // For this mock implementation, find the team with highest average success rate for this type
    const filteredData = this.modelData.filter(record => record.type === demandType);
    
    if (filteredData.length === 0) {
      return this.getDefaultTeam(demandType);
    }
    
    // Group by team and calculate average success rates
    const teamStats: Record<string, { totalSuccess: number; count: number }> = {};
    
    for (const record of filteredData) {
      if (!teamStats[record.team]) {
        teamStats[record.team] = { totalSuccess: 0, count: 0 };
      }
      teamStats[record.team].totalSuccess += record.success_rate;
      teamStats[record.team].count++;
    }
    
    // Find the team with the highest average success rate
    let bestTeam = '';
    let bestAverage = 0;
    
    for (const team in teamStats) {
      const avgSuccess = teamStats[team].totalSuccess / teamStats[team].count;
      if (avgSuccess > bestAverage) {
        bestAverage = avgSuccess;
        bestTeam = team;
      }
    }
    
    return bestTeam || this.getDefaultTeam(demandType);
  }

  /**
   * Calculates confidence in the prediction
   * @param demandType - Type of the demand
   * @param team - Team assigned to the demand
   * @returns Confidence score (0-100)
   */
  private calculateConfidence(demandType: string, team: string): number {
    // Find similar demands and see how many examples we have
    const similarDemands = this.modelData.filter(
      record => record.type === demandType && record.team === team
    );
    
    // Confidence increases with more historical examples
    const baseConfidence = 60;
    const confidenceIncrease = Math.min(40, similarDemands.length * 2); // Max 40 points from historical data
    
    return baseConfidence + confidenceIncrease;
  }

  /**
   * Estimates resolution time based on demand features
   * @param type - Demand type
   * @param priority - Demand priority
   * @param complexity - Complexity score
   * @returns Estimated resolution time in minutes
   */
  private estimateResolutionTime(type: string, priority: string, complexity: number): number {
    // Base time by type
    let baseTime = 240; // 4 hours
    
    switch (type) {
      case 'nova_funcionalidade':
        baseTime = 480; // 8 hours
        break;
      case 'melhoria':
        baseTime = 240; // 4 hours
        break;
      case 'bug':
        baseTime = 120; // 2 hours
        break;
      case 'discovery':
        baseTime = 360; // 6 hours
        break;
      case 'analise_exploratoria':
        baseTime = 720; // 12 hours
        break;
    }
    
    // Adjust by priority
    let priorityMultiplier = 1.0;
    switch (priority) {
      case 'critica':
        priorityMultiplier = 0.8; // Critical issues might be rushed, but could also be complex
        break;
      case 'alta':
        priorityMultiplier = 0.9;
        break;
      case 'baixa':
        priorityMultiplier = 1.2; // Low priority might take longer due to scheduling
        break;
    }
    
    // Adjust by complexity (higher complexity takes more time)
    const complexityMultiplier = complexity / 50; // Normalize complexity score
    
    return baseTime * priorityMultiplier * complexityMultiplier;
  }

  /**
   * Estimates success rate based on demand features
   * @param type - Demand type
   * @param priority - Demand priority
   * @param complexity - Complexity score
   * @returns Estimated success rate (0-100)
   */
  private estimateSuccessRate(type: string, priority: string, complexity: number): number {
    // Base success rate
    let baseRate = 75;
    
    // Adjust by type
    switch (type) {
      case 'nova_funcionalidade':
        baseRate = 70; // New features can have unexpected issues
        break;
      case 'melhoria':
        baseRate = 80; // Improvements often build on existing functionality
        break;
      case 'bug':
        baseRate = 85; // Bugs usually have clearer solutions
        break;
      case 'discovery':
        baseRate = 65; // Discoveries have more unknowns
        break;
      case 'analise_exploratoria':
        baseRate = 60; // Analysis often has uncertain outcomes
        break;
    }
    
    // Adjust by priority (high priority might lead to rushed work, low priority might be forgotten)
    switch (priority) {
      case 'critica':
        baseRate -= 5; // High pressure can lead to mistakes
        break;
      case 'baixa':
        baseRate -= 10; // Low priority items might have less attention
        break;
    }
    
    // Adjust by complexity (more complex = lower success rate)
    // Higher complexity slightly decreases success rate
    const complexityAdjustment = (50 - complexity) * 0.3;
    return Math.max(30, Math.min(95, baseRate + complexityAdjustment)); // Clamp between 30-95%
  }
}
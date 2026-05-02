import { ProjectReality } from './project-reality-reader';
import { getDemandTypeConfig } from '@shared/demand-types';

interface DemandTypeConstraints {
    bug: {
        maxTechnicalDepth: number;
        canAssumeNewTech: boolean;
        maxArchitectureChanges: number;
    };
    discovery: {
        maxHypotheses: number;
        canExploreFutureTech: boolean;
        mustUseCurrentStack: boolean;
    };
    newFeature: {
        maxScope: 'incremental' | 'moderate' | 'large';
        canIntroduceNewTech: boolean;
        maxNewDependencies: number;
    };
    improvement: {
        maxOptimizationLevel: 'minor' | 'moderate' | 'major';
        canRefactorArchitecture: boolean;
        mustMaintainCompatibility: boolean;
    };
    exploratoryAnalysis: {
        maxExplorationScope: 'current' | 'adjacent' | 'future';
        canProposeFutureTech: boolean;
        mustGroundInReality: boolean;
    };
}

type CanonicalDemandType = keyof DemandTypeConstraints;

export class RealityConstraints {
    private projectReality: ProjectReality;

    constructor(projectReality: ProjectReality) {
        this.projectReality = projectReality;
    }

    public getConstraintsForDemandType(demandType: string): any {
        const baseConstraints = this.getBaseConstraints();
        const config = getDemandTypeConfig(demandType);
        const canonicalDemandType = config.canonicalDemandType as CanonicalDemandType;
        const specificConstraints = this.getSpecificConstraints(canonicalDemandType);
        const executionConstraints = this.getExecutionConstraints(demandType);

        return {
            ...baseConstraints,
            ...specificConstraints,
            ...executionConstraints,
            demandType,
            canonicalDemandType
        };
    }

    private getBaseConstraints(): {
        maturityLevel: ProjectReality['maturityLevel'];
        capabilities: ProjectReality['capabilities'];
        stack: ProjectReality['stack'];
        allowedTechnologies: string[];
        forbiddenTechnologies: string[];
    } {
        const allowedTechnologies = [
            ...this.projectReality.stack.frontend,
            ...this.projectReality.stack.backend,
            ...this.projectReality.stack.database,
            ...this.projectReality.stack.infrastructure,
            ...this.projectReality.stack.ai
        ];

        const forbiddenTechnologies = this.getForbiddenTechnologies();

        return {
            maturityLevel: this.projectReality.maturityLevel,
            capabilities: this.projectReality.capabilities,
            stack: this.projectReality.stack,
            allowedTechnologies,
            forbiddenTechnologies
        };
    }

    private getForbiddenTechnologies(): string[] {
        const forbidden: string[] = [];

        // Based on maturity level
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                forbidden.push(
                    'Edge Computing',
                    'WASM',
                    'Advanced AI',
                    'Microservices',
                    'Kubernetes',
                    'Serverless Architecture'
                );
                break;

            case 'Initial Product':
                forbidden.push(
                    'Edge Computing',
                    'WASM',
                    'Advanced AI',
                    'Kubernetes'
                );
                break;

            case 'Scaling Product':
                forbidden.push(
                    'Edge Computing',
                    'WASM'
                );
                break;
        }

        // Based on capabilities
        if (!this.projectReality.capabilities.stableBackend) {
            forbidden.push('Complex Backend Architecture', 'Real-time Processing');
        }

        if (!this.projectReality.capabilities.structuredAI) {
            forbidden.push('Advanced AI Models', 'Custom ML Training');
        }

        if (!this.projectReality.capabilities.advancedFrontend) {
            forbidden.push('Complex UI Frameworks', 'WebAssembly', 'Advanced Animations');
        }

        return forbidden;
    }

    private getSpecificConstraints(demandType: CanonicalDemandType): any {
        switch (demandType) {
            case 'bug':
                return this.getBugConstraints();
            case 'discovery':
                return this.getDiscoveryConstraints();
            case 'newFeature':
                return this.getNewFeatureConstraints();
            case 'improvement':
                return this.getImprovementConstraints();
            case 'exploratoryAnalysis':
                return this.getExploratoryAnalysisConstraints();
            default:
                return {};
        }
    }

    private getExecutionConstraints(demandType: string): any {
        const config = getDemandTypeConfig(demandType);
        return {
            maxEffortDays: config.maxEffortDays,
            minROI: config.minROI,
            outputType: config.outputType,
            typeRequirements: config.typeRequirements
        };
    }

    private getBugConstraints(): DemandTypeConstraints['bug'] {
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                return {
                    maxTechnicalDepth: 2,
                    canAssumeNewTech: false,
                    maxArchitectureChanges: 0
                };
            case 'Initial Product':
                return {
                    maxTechnicalDepth: 3,
                    canAssumeNewTech: false,
                    maxArchitectureChanges: 1
                };
            case 'Scaling Product':
                return {
                    maxTechnicalDepth: 4,
                    canAssumeNewTech: true,
                    maxArchitectureChanges: 2
                };
            default:
                return {
                    maxTechnicalDepth: 2,
                    canAssumeNewTech: false,
                    maxArchitectureChanges: 0
                };
        }
    }

    private getDiscoveryConstraints(): DemandTypeConstraints['discovery'] {
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                return {
                    maxHypotheses: 3,
                    canExploreFutureTech: false,
                    mustUseCurrentStack: true
                };
            case 'Initial Product':
                return {
                    maxHypotheses: 5,
                    canExploreFutureTech: false,
                    mustUseCurrentStack: true
                };
            case 'Scaling Product':
                return {
                    maxHypotheses: 7,
                    canExploreFutureTech: true,
                    mustUseCurrentStack: false
                };
            default:
                return {
                    maxHypotheses: 3,
                    canExploreFutureTech: false,
                    mustUseCurrentStack: true
                };
        }
    }

    private getNewFeatureConstraints(): DemandTypeConstraints['newFeature'] {
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                return {
                    maxScope: 'incremental',
                    canIntroduceNewTech: false,
                    maxNewDependencies: 1
                };
            case 'Initial Product':
                return {
                    maxScope: 'moderate',
                    canIntroduceNewTech: true,
                    maxNewDependencies: 2
                };
            case 'Scaling Product':
                return {
                    maxScope: 'large',
                    canIntroduceNewTech: true,
                    maxNewDependencies: 3
                };
            default:
                return {
                    maxScope: 'incremental',
                    canIntroduceNewTech: false,
                    maxNewDependencies: 1
                };
        }
    }

    private getImprovementConstraints(): DemandTypeConstraints['improvement'] {
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                return {
                    maxOptimizationLevel: 'minor',
                    canRefactorArchitecture: false,
                    mustMaintainCompatibility: true
                };
            case 'Initial Product':
                return {
                    maxOptimizationLevel: 'moderate',
                    canRefactorArchitecture: true,
                    mustMaintainCompatibility: true
                };
            case 'Scaling Product':
                return {
                    maxOptimizationLevel: 'major',
                    canRefactorArchitecture: true,
                    mustMaintainCompatibility: false
                };
            default:
                return {
                    maxOptimizationLevel: 'minor',
                    canRefactorArchitecture: false,
                    mustMaintainCompatibility: true
                };
        }
    }

    private getExploratoryAnalysisConstraints(): DemandTypeConstraints['exploratoryAnalysis'] {
        switch (this.projectReality.maturityLevel) {
            case 'MVP':
                return {
                    maxExplorationScope: 'current',
                    canProposeFutureTech: false,
                    mustGroundInReality: true
                };
            case 'Initial Product':
                return {
                    maxExplorationScope: 'adjacent',
                    canProposeFutureTech: false,
                    mustGroundInReality: true
                };
            case 'Scaling Product':
                return {
                    maxExplorationScope: 'future',
                    canProposeFutureTech: true,
                    mustGroundInReality: false
                };
            default:
                return {
                    maxExplorationScope: 'current',
                    canProposeFutureTech: false,
                    mustGroundInReality: true
                };
        }
    }

    public checkAdherence(demandAnalysis: any, demandType: string): {
        isAdherent: boolean;
        issues: string[];
        adherenceScore: number;
    } {
        const config = getDemandTypeConfig(demandType);
        const canonicalDemandType = config.canonicalDemandType as CanonicalDemandType;
        const constraints = this.getConstraintsForDemandType(demandType);
        const issues: string[] = [];

        // Check for forbidden technologies
        if (demandAnalysis.technologies) {
            const forbiddenTechUsed = demandAnalysis.technologies.filter((tech: string) =>
                constraints.forbiddenTechnologies.includes(tech)
            );

            if (forbiddenTechUsed.length > 0) {
                issues.push(`Forbidden technologies used: ${forbiddenTechUsed.join(', ')}`);
            }
        }

        // Check specific constraints based on demand type
        switch (canonicalDemandType) {
            case 'bug':
                if (demandAnalysis.technicalDepth > constraints.maxTechnicalDepth) {
                    issues.push(`Technical depth ${demandAnalysis.technicalDepth} exceeds maximum of ${constraints.maxTechnicalDepth}`);
                }
                if (demandAnalysis.architectureChanges > constraints.maxArchitectureChanges) {
                    issues.push(`Architecture changes ${demandAnalysis.architectureChanges} exceeds maximum of ${constraints.maxArchitectureChanges}`);
                }
                break;

            case 'newFeature':
                if (demandAnalysis.newDependencies > constraints.maxNewDependencies) {
                    issues.push(`New dependencies ${demandAnalysis.newDependencies} exceeds maximum of ${constraints.maxNewDependencies}`);
                }
                break;
        }

        const adherenceScore = Math.max(0, 100 - (issues.length * 20));

        return {
            isAdherent: issues.length === 0,
            issues,
            adherenceScore
        };
    }
}

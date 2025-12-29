# AICHATflow Cognitive Core Documentation

## Overview

The **AICHATflow Cognitive Core** is an intelligent system designed to automate and optimize the processing of demands within the AICHATflow platform. It consists of two main modules:

1. **Intelligent Demand Classifier** - Analyzes and categorizes incoming demands
2. **Agent Orchestrator** - Manages the execution order of specialized agents and performs cross-validation

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│                    AICHATflow Cognitive Core                    │
├───────────────────────┬───────────────────────────────────────┤
│  Demand Classifier    │         Agent Orchestrator            │
└───────────────────────┴───────────────────────────────────────┘
                               │
                               ▼
┌───────────────────────────────────────────────────────────────┐
│                     Specialized Agents                         │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────────┐  │
│  │ Refiner │  │  QA     │  │  UX     │  │  Data Analyst    │  │
│  └─────────┘  └─────────┘  └─────────┘  └───────────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐      │
│  │ Tech Lead   │  │ Scrum Master│  │ Product Manager  │      │
│  └─────────────┘  └─────────────┘  └───────────────────┘      │
└───────────────────────────────────────────────────────────────┘
```

## Modules

### 1. Demand Classifier

The **Intelligent Demand Classifier** analyzes incoming demands based on multiple criteria:

- **Ambiguity** - Measures how vague or unclear the demand is
- **Interpretation Risk** - Assesses the potential for misunderstanding
- **Depth Required** - Determines how thorough the analysis needs to be
- **Complexity** - Evaluates technical complexity and scope
- **Urgency** - Considers priority and time sensitivity

#### Classification Process

1. **Text Analysis** - Examines demand title and description
2. **Keyword Matching** - Identifies category-specific keywords
3. **Criteria Scoring** - Calculates scores for each criterion
4. **Category Determination** - Assigns the most appropriate category
5. **Confidence Calculation** - Determines confidence in the classification
6. **Agent Recommendation** - Suggests optimal agents for the demand

#### Supported Categories

- **Technical** - API, database, integration, backend, frontend, etc.
- **Legal** - Contracts, compliance, regulations, privacy, etc.
- **Creative** - Design, UX, UI, branding, visual elements
- **Business** - Market strategy, revenue, sales, marketing
- **Analytical** - Data analysis, metrics, statistics, insights
- **Support** - Help, issues, bugs, customer service
- **Research** - Studies, exploration, investigation, discovery

### 2. Agent Orchestrator

The **Agent Orchestrator** manages the execution flow of specialized agents:

- **Execution Order Determination** - Defines optimal agent sequence
- **Cross-Validation** - Performs validation in critical cases
- **Progress Tracking** - Monitors execution progress
- **Error Handling** - Manages failures and fallbacks

#### Orchestration Features

- **Intelligent Agent Sequencing** - Orders agents based on demand requirements
- **Cross-Validation** - Validates results for high-risk demands
- **Time Estimation** - Predicts completion time based on complexity
- **Real-time Monitoring** - Tracks progress and provides updates

## API Endpoints

### Demand Classification

**GET** `/api/demands/:id/classification`

Returns the classification of a specific demand:

```json
{
  "demandId": 123,
  "classification": {
    "category": "technical",
    "criteria": {
      "ambiguity": 45,
      "interpretationRisk": 30,
      "depthRequired": 75,
      "complexity": 85,
      "urgency": 60
    },
    "confidence": 88,
    "recommendedAgents": ["tech_lead", "qa", "analista_de_dados"],
    "notes": "Demand classified as: technical\nConfidence: 88%\n🔧 High complexity (85%) - consider breaking into smaller tasks"
  }
}
```

### Orchestration Plan

**GET** `/api/demands/:id/orchestration`

Returns the orchestration plan for a specific demand:

```json
{
  "demandId": 123,
  "orchestrationPlan": {
    "demandId": 123,
    "classification": {
      "category": "technical",
      "criteria": {
        "ambiguity": 45,
        "interpretationRisk": 30,
        "depthRequired": 75,
        "complexity": 85,
        "urgency": 60
      },
      "confidence": 88,
      "recommendedAgents": ["tech_lead", "qa", "analista_de_dados"],
      "notes": "Demand classified as: technical"
    },
    "agentExecutionOrder": ["refinador", "tech_lead", "qa", "analista_de_dados"],
    "crossValidationRequired": true,
    "validationAgents": ["qa", "tech_lead"],
    "estimatedCompletionTime": 180,
    "notes": "Orchestration plan created for technical demand\nExecution order: refinador → tech_lead → qa → analista_de_dados\nEstimated completion time: 180 minutes\n✅ Cross-validation required for this demand\nValidation agents: qa, tech_lead\n🔧 High complexity - consider breaking into smaller tasks"
  }
}
```

### Create Demand with Cognitive Core

**POST** `/api/demands/cognitive`

Creates a new demand and processes it using the cognitive core:

```json
{
  "title": "Implement new API endpoint",
  "description": "Create a REST API endpoint for user authentication with JWT tokens",
  "type": "nova_funcionalidade",
  "priority": "alta"
}
```

## Integration

### With Existing System

The cognitive core integrates seamlessly with the existing AICHATflow system:

1. **Demand Creation** - Can use traditional or cognitive core processing
2. **Fallback Mechanism** - If cognitive core fails, falls back to traditional processing
3. **Progress Tracking** - Provides real-time updates via SSE (Server-Sent Events)
4. **Document Generation** - Maintains existing PRD and Tasks document generation

### Processing Flow

```
1. Demand Created
   │
   ▼
2. Cognitive Core Classification
   │
   ▼
3. Orchestration Plan Created
   │
   ▼
4. Agents Executed in Order
   │
   ▼
5. Cross-Validation (if required)
   │
   ▼
6. Document Generation
   │
   ▼
7. Demand Completed
```

## Benefits

1. **Improved Accuracy** - Intelligent classification reduces misrouting
2. **Optimized Workflow** - Agents execute in optimal order
3. **Risk Reduction** - Cross-validation for critical demands
4. **Time Efficiency** - Better resource allocation and sequencing
5. **Adaptability** - Adjusts to different demand types and complexities
6. **Transparency** - Clear classification and orchestration notes

## Configuration

The cognitive core is automatically initialized with the AISquadService and requires no additional configuration. All settings are managed through the existing demand types and priorities.

## Monitoring and Logging

The system provides detailed logging for:

- Classification decisions
- Orchestration plans
- Agent execution results
- Cross-validation outcomes
- Performance metrics

## Future Enhancements

- Machine learning integration for improved classification
- Historical performance analysis
- Agent performance metrics
- Adaptive learning from past demands
- Integration with external knowledge bases

## Support

For issues or questions regarding the AICHATflow Cognitive Core, please refer to the main project documentation or contact the development team.

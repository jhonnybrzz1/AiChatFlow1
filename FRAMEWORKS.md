# AICHATflow Demand Management Frameworks

## Overview

The AICHATflow platform includes a comprehensive **Framework Manager** that supports 6 different demand management frameworks, each designed for specific types of demands and use cases. These frameworks provide structured approaches to managing different types of work, from new feature development to bug triage and data analysis.

## Framework Types

### 1. Jobs-to-be-Done (JTBD)

**Best for:** New features, customer-centric development

**Description:** JTBD focuses on understanding the "jobs" customers are trying to accomplish. It helps teams design solutions that address real customer needs rather than just building features.

**Key Components:**
- Job statement and steps
- Desired outcomes
- Constraints and requirements
- Customer validation

**Success Metrics:**
- Job completion rate
- Customer satisfaction
- Time to complete

**Integrations:**
- Survey tools (SurveyMonkey, Typeform)
- Customer interview platforms
- Analytics tools

**Use Case Example:**
```
"When a user wants to export their data, they need a simple way to select the format and destination, and they want confirmation that the export was successful."
```

### 2. HEART Framework

**Best for:** UX improvements, user experience metrics

**Description:** HEART is a UX metrics framework developed by Google that focuses on five key areas: Happiness, Engagement, Adoption, Retention, and Task Success.

**Key Components:**
- Happiness metrics (user satisfaction)
- Engagement metrics (usage frequency)
- Adoption metrics (new users)
- Retention metrics (returning users)
- Task Success metrics (completion rates)

**Success Metrics:**
- Usability scores
- Accessibility compliance
- User feedback sentiment

**Integrations:**
- Analytics platforms (Google Analytics, Mixpanel)
- Session recording tools (Hotjar)
- Heatmap tools (Crazy Egg)

**Use Case Example:**
```
"Improve the onboarding experience to increase user retention by 20% and task success rate by 15%."
```

### 3. Severity x Priority Matrix

**Best for:** Bug triage, issue prioritization

**Description:** This matrix helps teams prioritize bugs and issues based on their severity (impact) and priority (urgency). It provides clear guidelines for action and SLAs.

**Key Components:**
- Severity levels (Critical, High, Medium, Low)
- Priority levels (Immediate, Urgent, High, Medium, Low)
- Action matrix with SLAs
- Team allocation guidelines

**Success Metrics:**
- Resolution time
- Reopen rate
- Customer impact reduction

**Integrations:**
- Bug tracking systems (Jira, Bugzilla)
- Monitoring tools (Sentry, Datadog)
- Alerting systems (PagerDuty)

**Use Case Example:**
```
"Critical severity + Immediate priority = Fix within 2 hours by Critical Response Team"
```

### 4. Double Diamond

**Best for:** Discovery, design thinking, innovation

**Description:** The Double Diamond framework is a design thinking approach with four phases: Discover, Define, Develop, and Deliver. It's ideal for exploratory work and innovation projects.

**Key Components:**
- Discover: User research and insight gathering
- Define: Problem statements and user journeys
- Develop: Prototyping and testing
- Deliver: Implementation and rollout

**Success Metrics:**
- Insights generated
- User interviews conducted
- Research depth
- Prototype validation rate

**Integrations:**
- Research tools (UserTesting)
- Prototyping tools (Figma, Adobe XD)
- Collaboration platforms (Miro)

**Use Case Example:**
```
"Explore new ways to improve mobile app navigation through user research and iterative prototyping."
```

### 5. CRISP-DM

**Best for:** Data analysis, machine learning, exploratory analytics

**Description:** CRISP-DM (Cross-Industry Standard Process for Data Mining) is a proven methodology for data science projects with six phases: Business Understanding, Data Understanding, Data Preparation, Modeling, Evaluation, and Deployment.

**Key Components:**
- Business objectives and success criteria
- Data sources and quality assessment
- Data cleaning and feature engineering
- Model training and evaluation
- Deployment and monitoring

**Success Metrics:**
- Model accuracy
- Data coverage
- Insight value
- Business impact

**Integrations:**
- Data platforms (Snowflake, BigQuery)
- ML tools (TensorFlow, PyTorch)
- Visualization tools (Tableau, Power BI)

**Use Case Example:**
```
"Analyze customer churn patterns and develop predictive models to reduce churn by 15%."
```

### 6. AI Framework Suggestion (Transversal)

**Best for:** All demand types, intelligent recommendation

**Description:** This AI-powered framework analyzes demand characteristics and recommends the most appropriate framework. It uses machine learning to suggest the best approach based on historical data and success patterns.

**Key Components:**
- Demand analysis (type, complexity, impact)
- Criteria evaluation
- Framework recommendation with confidence scoring
- Alternative options with rationale

**Success Metrics:**
- Recommendation accuracy
- Adoption rate
- User satisfaction with suggestions

**Integrations:**
- AI models (Mistral AI)
- Knowledge bases
- Decision engines

**Use Case Example:**
```
"Analyze this new feature request and recommend the best framework approach with 85% confidence."
```

## Framework Selection Guide

| Demand Type | Primary Framework | Secondary Options | Rationale |
|-------------|------------------|-------------------|-----------|
| New Feature | JTBD | Double Diamond, HEART | Customer-centric approach for feature development |
| Improvement | HEART | JTBD, CRISP-DM | UX-focused metrics for enhancements |
| Bug | Severity-Priority | JTBD, HEART | Clear prioritization for issue resolution |
| Discovery | Double Diamond | JTBD, HEART | Exploratory research and innovation |
| Analysis | CRISP-DM | Double Diamond, JTBD | Data-driven approach for insights |

## API Endpoints

### Get All Frameworks

**GET** `/api/frameworks`

Returns all available frameworks:

```json
{
  "success": true,
  "count": 6,
  "frameworks": [
    {
      "id": "jtbd-default",
      "name": "Jobs-to-be-Done Framework",
      "type": "jtbd",
      "description": "Framework for understanding customer jobs..."
    },
    {
      "id": "heart-default",
      "name": "HEART Framework",
      "type": "heart",
      "description": "UX metrics framework..."
    }
    // ... other frameworks
  ]
}
```

### Get Framework by ID

**GET** `/api/frameworks/:id`

Returns detailed information about a specific framework:

```json
{
  "id": "jtbd-default",
  "name": "Jobs-to-be-Done Framework",
  "type": "jtbd",
  "version": "1.0",
  "description": "Framework for understanding customer jobs and desired outcomes",
  "jobStatement": "",
  "jobSteps": [],
  "desiredOutcomes": [],
  "constraints": [],
  "successMetrics": {
    "jobCompletionRate": 0,
    "customerSatisfaction": 0,
    "timeToComplete": 0
  },
  "integration": {
    "aiEnabled": true,
    "externalTools": ["SurveyMonkey", "Typeform"],
    "apiEndpoints": [],
    "dataSources": [],
    "customerInterviews": true,
    "surveyTools": ["SurveyMonkey", "Typeform", "Google Forms"]
  },
  "createdAt": "2023-11-15T10:00:00.000Z",
  "updatedAt": "2023-11-15T10:00:00.000Z"
}
```

### Get Framework Recommendation

**GET** `/api/demands/:id/framework-recommendation`

Returns AI-powered framework recommendation for a demand:

```json
{
  "demandId": 123,
  "recommendation": {
    "recommendedFramework": "jtbd",
    "confidence": 85,
    "rationale": "This new feature demand would benefit from a customer-centric approach...",
    "implementationSteps": [
      "Define the job to be done",
      "Identify job steps and desired outcomes",
      "Conduct customer interviews",
      "Analyze constraints and requirements",
      "Design solution based on job analysis",
      "Validate with customers",
      "Implement and measure success"
    ],
    "expectedOutcomes": [
      "Clear understanding of customer jobs",
      "Well-defined desired outcomes",
      "Customer-centric solution design",
      "Higher customer satisfaction",
      "Increased job completion rates",
      "Better alignment with user needs"
    ],
    "successMetrics": {
      "successRate": 85,
      "completionTime": 120,
      "stakeholderSatisfaction": 90,
      "costEfficiency": 80,
      "qualityScore": 85
    },
    "integrationRequirements": {
      "aiEnabled": true,
      "externalTools": ["SurveyMonkey", "Typeform", "UserTesting"],
      "apiEndpoints": ["/api/jtbd/surveys", "/api/jtbd/interviews"],
      "dataSources": ["Customer interviews", "Surveys", "Support tickets"]
    }
  }
}
```

### Execute Framework

**POST** `/api/demands/:id/frameworks/:frameworkId/execute`

Executes a specific framework for a demand:

```json
{
  "success": true,
  "executionResult": {
    "frameworkId": "jtbd-default",
    "frameworkType": "jtbd",
    "status": "completed",
    "progress": 100,
    "metrics": {
      "successRate": 85,
      "completionTime": 145,
      "stakeholderSatisfaction": 90,
      "costEfficiency": 80,
      "qualityScore": 85
    },
    "outputs": {
      "step1": "Analyzing job statement completed",
      "step2": "Identifying job steps completed",
      "step3": "Defining desired outcomes completed",
      "step4": "Analyzing constraints completed",
      "step5": "Designing solution completed",
      "step6": "Validating with customers completed",
      "step7": "Finalizing implementation completed"
    },
    "timeline": {
      "startedAt": "2023-11-15T10:00:00.000Z",
      "completedAt": "2023-11-15T10:14:55.000Z",
      "duration": 145
    },
    "teamMembers": [],
    "resourcesUsed": []
  }
}
```

### Get Framework Execution History

**GET** `/api/demands/:id/framework-executions`

Returns execution history for a demand:

```json
{
  "demandId": "123",
  "executionCount": 2,
  "executions": [
    {
      "frameworkId": "jtbd-default",
      "frameworkType": "jtbd",
      "status": "completed",
      "progress": 100,
      "metrics": {
        "successRate": 85,
        "completionTime": 145,
        "stakeholderSatisfaction": 90,
        "costEfficiency": 80,
        "qualityScore": 85
      },
      "timeline": {
        "startedAt": "2023-11-15T10:00:00.000Z",
        "completedAt": "2023-11-15T10:14:55.000Z",
        "duration": 145
      }
    },
    {
      "frameworkId": "heart-default",
      "frameworkType": "heart",
      "status": "completed",
      "progress": 100,
      "metrics": {
        "successRate": 80,
        "completionTime": 90,
        "stakeholderSatisfaction": 85,
        "costEfficiency": 75,
        "qualityScore": 80
      },
      "timeline": {
        "startedAt": "2023-11-16T09:00:00.000Z",
        "completedAt": "2023-11-16T09:15:00.000Z",
        "duration": 90
      }
    }
  ]
}
```

### Get Framework Metrics Summary

**GET** `/api/frameworks/metrics`

Returns performance metrics for all frameworks:

```json
{
  "success": true,
  "metrics": {
    "jtbd": {
      "successRate": 85,
      "completionTime": 120,
      "stakeholderSatisfaction": 90,
      "costEfficiency": 80,
      "qualityScore": 85
    },
    "heart": {
      "successRate": 80,
      "completionTime": 90,
      "stakeholderSatisfaction": 85,
      "costEfficiency": 75,
      "qualityScore": 80
    },
    "severity-priority": {
      "successRate": 90,
      "completionTime": 60,
      "stakeholderSatisfaction": 80,
      "costEfficiency": 90,
      "qualityScore": 85
    },
    "double-diamond": {
      "successRate": 75,
      "completionTime": 180,
      "stakeholderSatisfaction": 85,
      "costEfficiency": 70,
      "qualityScore": 80
    },
    "crisp-dm": {
      "successRate": 80,
      "completionTime": 240,
      "stakeholderSatisfaction": 75,
      "costEfficiency": 75,
      "qualityScore": 85
    }
  }
}
```

## Integration with Cognitive Core

The Framework Manager integrates seamlessly with the AICHATflow Cognitive Core:

1. **Automatic Framework Suggestion**: The AI Framework Suggestion analyzes demands and recommends the most appropriate framework
2. **Intelligent Agent Orchestration**: The Agent Orchestrator can incorporate framework-specific agents into the execution flow
3. **Enhanced Classification**: Framework recommendations are based on the cognitive core's demand classification
4. **Unified Processing**: Frameworks can be executed alongside or as part of the cognitive core processing pipeline

## Benefits

1. **Structured Approach**: Each framework provides a proven methodology for specific demand types
2. **Consistency**: Standardized processes across different types of work
3. **Best Practices**: Incorporates industry-standard methodologies
4. **Flexibility**: Choose the right framework for each demand
5. **AI-Powered Recommendations**: Intelligent suggestions based on demand characteristics
6. **Performance Tracking**: Comprehensive metrics for each framework execution
7. **Integration Ready**: Built-in support for external tools and platforms

## Implementation Examples

### Example 1: New Feature with JTBD

```bash
# Create a demand
POST /api/demands/cognitive
{
  "title": "Implement user profile customization",
  "description": "Allow users to customize their profile with themes, avatars, and layout preferences",
  "type": "nova_funcionalidade",
  "priority": "alta"
}

# Get framework recommendation
GET /api/demands/123/framework-recommendation
# Returns: JTBD framework with 85% confidence

# Execute JTBD framework
POST /api/demands/123/frameworks/jtbd-default/execute
```

### Example 2: Bug Triage with Severity-Priority Matrix

```bash
# Create a bug demand
POST /api/demands
{
  "title": "Login page crashes on mobile devices",
  "description": "Users report that the login page crashes when accessing from iOS Safari",
  "type": "bug",
  "priority": "critica"
}

# Get framework recommendation
GET /api/demands/124/framework-recommendation
# Returns: Severity-Priority Matrix with 90% confidence

# Execute framework
POST /api/demands/124/frameworks/severity-priority-default/execute
```

### Example 3: UX Improvement with HEART

```bash
# Create an improvement demand
POST /api/demands
{
  "title": "Improve checkout flow conversion",
  "description": "Reduce cart abandonment by simplifying the checkout process",
  "type": "melhoria",
  "priority": "alta"
}

# Get framework recommendation
GET /api/demands/125/framework-recommendation
# Returns: HEART framework with 80% confidence

# Execute framework
POST /api/demands/125/frameworks/heart-default/execute
```

## Future Enhancements

1. **Custom Framework Templates**: Allow teams to create and save custom framework templates
2. **Framework Performance Analytics**: Advanced analytics and reporting on framework effectiveness
3. **Team-Specific Frameworks**: Custom frameworks tailored to specific teams or departments
4. **Integration with External Systems**: Deeper integration with Jira, Trello, Asana, etc.
5. **Machine Learning Improvements**: Enhanced AI recommendations based on historical performance
6. **Collaborative Framework Editing**: Real-time collaboration on framework execution

## Support

For questions or issues related to the AICHATflow Frameworks, please refer to the main project documentation or contact the development team.
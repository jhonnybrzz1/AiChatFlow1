# replit.md

## Overview

This is a full-stack web application built with React frontend and Express backend, featuring an AI-powered squad system for demand refinement. The application allows users to submit product demands/requirements which are then processed by a team of AI agents representing different roles (QA, UX, Tech Lead, etc.) to generate comprehensive Product Requirements Documents (PRDs) and task breakdowns.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Styling**: Tailwind CSS with shadcn/ui component library
- **State Management**: TanStack Query for server state management
- **Routing**: Wouter for client-side routing
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **File Storage**: Local file system with Multer for uploads
- **AI Integration**: OpenAI API for AI agent responses
- **Session Management**: In-memory storage (development setup)

### Development Environment
- **Language**: TypeScript throughout the stack
- **Package Manager**: npm
- **Development Server**: Vite dev server with Express backend
- **Database Migrations**: Drizzle Kit for schema management

## Key Components

### AI Squad System
The core feature is an AI-powered squad of agents that collaborate to refine product demands:
- **Refinador**: Orchestrates the refinement process
- **Scrum Master**: Analyzes process impact and defines increments
- **QA**: Identifies acceptance criteria and test scenarios
- **UX Designer**: Evaluates user experience and interaction flows
- **Data Analyst**: Verifies data structures and integrations
- **Tech Lead**: Assesses technical feasibility and architecture
- **Product Manager**: Generates final PRD and task breakdown

### Core Features
- **Demand Submission**: Users can submit product demands with file attachments
- **Real-time Processing**: Live chat interface showing AI agent progress
- **Document Generation**: Automatic PRD and task document creation
- **History Tracking**: Complete audit trail of all processed demands
- **File Management**: Support for document attachments and downloads

### UI Components
- Modern, responsive design using shadcn/ui components
- Real-time chat interface with agent status indicators
- Form-based demand submission with validation
- Progress tracking and status updates
- Document download functionality

## Data Flow

1. **Demand Submission**: User submits demand through form interface
2. **File Processing**: Attached files are stored locally and linked to demand
3. **AI Processing**: Sequential processing by AI agents with real-time updates
4. **Document Generation**: Final PRD and task documents are created
5. **Status Updates**: Real-time chat updates show progress to user
6. **History Storage**: All interactions stored for future reference

## External Dependencies

### AI Services
- **OpenAI API**: Powers all AI agent interactions using GPT-4o model
- **Authentication**: API key-based authentication

### Database
- **Neon Database**: PostgreSQL hosting service
- **Connection**: Via DATABASE_URL environment variable

### UI Framework
- **Radix UI**: Headless UI components for accessibility
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: Icon library

### Development Tools
- **Replit Integration**: Built-in support for Replit development environment
- **Error Handling**: Runtime error overlay for development
- **Hot Reload**: Fast refresh during development

## Deployment Strategy

### Development
- Local development using Vite dev server
- Hot module replacement for fast iteration
- Environment-based configuration

### Production Build
- Frontend: Vite build process generates static assets
- Backend: esbuild bundles Express server
- Database: Drizzle migrations applied via `db:push`

### Environment Variables
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- `NODE_ENV`: Environment configuration

### File Structure
```
/client          # React frontend
/server          # Express backend
/shared          # Shared TypeScript types and schemas
/attached_assets # File uploads and attachments
/migrations      # Database migration files
```

The application follows a monorepo structure with clear separation between frontend, backend, and shared code, making it easy to maintain and scale.
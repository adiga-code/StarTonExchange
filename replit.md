# Overview

This is a Telegram Mini App for a cryptocurrency exchange platform that allows users to buy and exchange Telegram Stars and TON coins. The application features a modern React frontend with a Node.js/Express backend, using PostgreSQL for data persistence and Drizzle ORM for database operations. The app integrates with Telegram's WebApp API to provide a seamless in-app experience for users to manage their crypto balances, complete tasks, and participate in a referral system.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
The client-side application is built with React 18 and TypeScript, utilizing modern UI patterns and state management:

- **Framework**: React with TypeScript for type safety and developer experience
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management and caching
- **UI Components**: Radix UI primitives with custom Tailwind CSS styling following the shadcn/ui design system
- **Animations**: Framer Motion for smooth transitions and micro-interactions
- **Build Tool**: Vite for fast development and optimized production builds
- **Styling**: Tailwind CSS with CSS custom properties for theming support

The application follows a component-based architecture with reusable UI components and custom hooks for business logic. The main application structure includes a tabbed interface for buying crypto, completing tasks, and managing user profiles.

## Backend Architecture
The server-side implementation uses Node.js with Express for API endpoints and business logic:

- **Runtime**: Node.js with ES modules for modern JavaScript features
- **Framework**: Express.js for HTTP server and API routing
- **Database ORM**: Drizzle ORM for type-safe database operations
- **Session Management**: Connect-pg-simple for PostgreSQL-backed session storage
- **Development**: TSX for TypeScript execution and hot reloading

The backend follows a RESTful API design with separate modules for different concerns (routes, storage, database schema). It includes middleware for request logging and error handling, with a clean separation between API routes and business logic.

## Data Storage Solutions
The application uses PostgreSQL as the primary database with Drizzle ORM for schema definition and queries:

- **Database**: PostgreSQL with Neon serverless hosting
- **ORM**: Drizzle ORM with Zod schema validation
- **Schema Design**: Normalized tables for users, transactions, tasks, user tasks, and settings
- **Migration System**: Drizzle Kit for database schema migrations
- **Connection**: Neon serverless driver for PostgreSQL connections

The database schema supports user management, transaction history, task completion tracking, referral systems, and application settings. It includes proper foreign key relationships and indexing for performance.

## Authentication and Authorization
User authentication is simplified for the Telegram ecosystem:

- **Telegram Integration**: Uses Telegram WebApp user data for authentication
- **Session Management**: Telegram user ID as the primary identifier
- **Development Mode**: Mock user data for testing outside Telegram environment
- **Authorization**: Simple middleware to extract current user from Telegram headers

The system assumes users are authenticated through Telegram's WebApp interface, eliminating the need for traditional login/logout flows.

# External Dependencies

## Telegram Integration
- **Telegram WebApp API**: Core integration for user authentication, haptic feedback, UI theming, and in-app sharing
- **Bot Integration**: Designed to work with a Telegram bot for user onboarding and notifications

## Database Services
- **Neon Database**: Serverless PostgreSQL hosting for production data storage
- **Drizzle ORM**: Type-safe database operations and schema management
- **Connect-pg-simple**: PostgreSQL session store for Express sessions

## UI and Styling
- **Radix UI**: Accessible component primitives for complex UI elements
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Framer Motion**: Animation library for smooth transitions and interactions
- **Lucide React**: Icon library for consistent iconography

## Development Tools
- **Vite**: Build tool with hot module replacement and optimized bundling
- **TypeScript**: Static type checking for both frontend and backend code
- **ESBuild**: Fast JavaScript bundler for production builds
- **Replit Integration**: Development environment with runtime error overlays and cartographer plugin

## Payment Processing
The application is structured to handle cryptocurrency transactions but specific payment processor integrations are not implemented in the current codebase. The system includes transaction tracking and balance management for future payment integration.
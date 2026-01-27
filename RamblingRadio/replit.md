# Rabbit Hole Radio

## Overview

Rabbit Hole Radio is an AI-powered personalized audio streaming application. Users provide seed interests, and the system generates an endless, adaptive spoken-word radio stream using AI-generated content and text-to-speech. The app features real-time feedback mechanisms (thumbs up/down) that influence future content generation, creating a continuously evolving listening experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight alternative to React Router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Animations**: Framer Motion for smooth UI transitions
- **Build Tool**: Vite with custom Replit plugins for development

The frontend follows a page-based structure with shared components. Key pages include a Landing page for session creation and a Radio page for the listening experience.

### Backend Architecture
- **Runtime**: Node.js with Express
- **Language**: TypeScript compiled with tsx
- **API Design**: RESTful endpoints defined in shared route definitions with Zod validation
- **Build Process**: esbuild for production bundling, Vite dev server proxied through Express in development

The server handles session management, AI content generation, and text-to-speech conversion. Routes are defined with shared type definitions between frontend and backend.

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts`
- **Migration Tool**: Drizzle Kit with `db:push` command
- **Key Tables**:
  - `sessions`: Stores user session data including seed interests and evolving context
  - `logs`: Stores generated content segments with optional feedback

### AI Integration
- **Content Generation**: Google Gemini via Replit AI Integrations (gemini-2.5-flash model)
- **Text-to-Speech**: OpenAI TTS via Replit AI Integrations
- **Configuration**: Uses environment variables for API keys and base URLs provided by Replit

### Audio Handling
- **Client-side**: AudioWorklet-based playback system for streaming PCM16 audio
- **Server-side**: Audio format detection and conversion utilities using ffmpeg
- **Supported Formats**: WAV, MP3, WebM, MP4, OGG with automatic conversion

## External Dependencies

### AI Services (via Replit AI Integrations)
- **Gemini API**: Content generation
  - `AI_INTEGRATIONS_GEMINI_API_KEY`
  - `AI_INTEGRATIONS_GEMINI_BASE_URL`
- **OpenAI API**: Text-to-speech
  - `AI_INTEGRATIONS_OPENAI_API_KEY`
  - `AI_INTEGRATIONS_OPENAI_BASE_URL`

### Database
- **PostgreSQL**: Primary data store
  - `DATABASE_URL` environment variable required

### Key NPM Packages
- `@google/genai`: Gemini AI SDK
- `drizzle-orm` / `drizzle-kit`: Database ORM and migrations
- `express`: HTTP server
- `@tanstack/react-query`: Client-side data fetching
- `framer-motion`: Animations
- `zod`: Runtime validation for API contracts
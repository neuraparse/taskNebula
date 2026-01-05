# TaskNebula Architecture

This document provides an overview of TaskNebula's architecture, design decisions, and technical implementation.

## 🏗️ High-Level Architecture

TaskNebula follows a **modular monolith** architecture with the potential to extract services as needed.

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  Next.js 15 (App Router) + React 19 + TypeScript            │
│  - Server Components for data fetching                       │
│  - Client Components for interactivity                       │
│  - TanStack Query for client-side state                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      API Layer                               │
│  Next.js API Routes / tRPC (future)                          │
│  - RESTful endpoints                                         │
│  - Type-safe with Zod validation                             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic                            │
│  Domain Services & Use Cases                                 │
│  - Organization management                                   │
│  - Project & Issue management                                │
│  - Workflow engine                                           │
│  - AI integration                                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                                │
│  Drizzle ORM + PostgreSQL 16                                 │
│  - Type-safe database access                                 │
│  - Multi-tenancy with RLS                                    │
│  - Migrations with Drizzle Kit                               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Monorepo Structure

We use **Turborepo** for monorepo management with **pnpm workspaces**.

### Apps

- **`apps/web`**: Main Next.js application
  - User-facing UI
  - API routes
  - Server-side rendering

### Packages

- **`packages/config`**: Shared configurations
  - TypeScript configs
  - ESLint configs
  - Tailwind configs

- **`packages/types`**: Shared TypeScript types
  - Domain models
  - API contracts
  - Utility types

- **`packages/db`**: Database layer
  - Drizzle ORM schema
  - Database client
  - Migrations

- **`packages/llm`**: LLM integration
  - Provider abstraction
  - Prompt templates
  - AI utilities

## 🗄️ Database Design

### Multi-Tenancy Strategy

We use **organization-scoped multi-tenancy** with Row-Level Security (RLS).

- Each table has an `organization_id` column
- PostgreSQL RLS policies enforce data isolation
- Application-level checks as additional security layer

### Key Entities

```
Organizations (root tenant)
  ├── Teams
  ├── Projects
  │   ├── Issues
  │   ├── Sprints
  │   └── Workflows
  └── Members
```

### Schema Highlights

- **CUID2** for primary keys (sortable, URL-safe)
- **JSONB** for flexible metadata and custom fields
- **Enums** for type safety (status, priority, etc.)
- **Indexes** on frequently queried columns
- **Foreign keys** with cascade deletes where appropriate

## 🎨 Frontend Architecture

### App Router Structure

```
app/
├── (marketing)/          # Public pages (landing, pricing)
│   ├── page.tsx
│   └── layout.tsx
├── (app)/                # Authenticated app
│   ├── dashboard/
│   ├── projects/
│   ├── issues/
│   └── ai/
└── api/                  # API routes
```

### Component Organization

```
components/
├── ui/                   # Base UI components (shadcn/ui)
├── layout/               # Layout components (sidebar, header)
├── kanban/               # Kanban-specific components
├── forms/                # Form components
└── providers/            # Context providers
```

### State Management

- **Server State**: TanStack Query (React Query)
- **UI State**: Zustand (lightweight stores)
- **Form State**: React Hook Form + Zod
- **URL State**: Next.js router (searchParams)

## 🔐 Authentication & Authorization

### Authentication

- **Auth.js (NextAuth v5)** for authentication
- Support for OAuth providers (Google, GitHub)
- JWT-based sessions
- Refresh token rotation

### Authorization

- **Role-Based Access Control (RBAC)**
  - Organization roles: Owner, Admin, Member, Viewer, Guest
  - Team roles: Lead, Member
- **Permission checks** at API and UI level
- **Row-Level Security** in PostgreSQL

## 🤖 AI Integration

### LLM Client Abstraction

```typescript
interface LLMClient {
  chat(messages: LLMMessage[]): Promise<LLMResponse>;
  complete(prompt: string): Promise<LLMResponse>;
}
```

### Supported Providers

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Azure OpenAI
- Local models (future)

### AI Features

1. **Issue Generation**: Natural language → structured ticket
2. **Thread Summarization**: Long discussions → concise summary
3. **Sprint Planning**: Backlog + capacity → sprint proposal
4. **Health Analysis**: Metrics → insights and recommendations

## 🚀 Performance Optimizations

### Frontend

- **React Server Components** for reduced client bundle
- **Streaming SSR** for faster initial load
- **Optimistic UI updates** for perceived performance
- **Code splitting** with dynamic imports
- **Image optimization** with Next.js Image

### Backend

- **Database connection pooling**
- **Query optimization** with proper indexes
- **Caching** with Redis (future)
- **Rate limiting** on API endpoints

### Real-time Features

- **WebSocket** for live updates (future)
- **Server-Sent Events** for notifications
- **Optimistic updates** with rollback on error

## 📊 Observability

### Logging

- Structured logging with context
- Log levels: error, warn, info, debug
- Request ID tracking

### Monitoring (Future)

- Application metrics (response time, error rate)
- Database metrics (query performance, connection pool)
- User analytics (feature usage, engagement)

### Error Tracking (Future)

- Sentry for error tracking
- User feedback integration
- Source map support

## 🔄 CI/CD Pipeline (Future)

```
GitHub Actions
  ├── Lint & Type Check
  ├── Run Tests
  ├── Build
  ├── Deploy to Staging
  └── Deploy to Production (on release)
```

## 🌐 Deployment

### Recommended Platforms

- **Vercel**: Next.js optimized, edge functions
- **Railway**: Full-stack with PostgreSQL
- **Fly.io**: Global edge deployment
- **Self-hosted**: Docker + Kubernetes

### Environment Variables

See `.env.example` files in each package for required configuration.

## 📈 Scalability Considerations

### Current (Monolith)

- Single deployment
- Shared database
- Vertical scaling

### Future (Microservices)

Potential service extraction:
- **Core API**: Project & issue management
- **AI Worker**: LLM processing (async)
- **Notification Service**: Email, Slack, webhooks
- **Analytics Service**: Metrics and reporting

## 🔒 Security

- **Input validation** with Zod schemas
- **SQL injection prevention** with parameterized queries
- **XSS protection** with React's built-in escaping
- **CSRF protection** with SameSite cookies
- **Rate limiting** on sensitive endpoints
- **Audit logging** for compliance

## 📚 Further Reading

- [Database Schema](./DATABASE.md)
- [API Documentation](./API.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Security Best Practices](./SECURITY.md)

---

Last updated: 2025-01-24


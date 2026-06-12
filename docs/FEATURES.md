# TaskNebula Features

A comprehensive overview of TaskNebula's features and capabilities.

## 🎯 Core Features

### Multi-Tenant Organization Management

- **Organizations**: Root-level tenant isolation
- **Teams**: Sub-groups within organizations
- **Role-Based Access Control**: Owner, Admin, Member, Viewer, Guest
- **Team Permissions**: Team Lead and Team Member roles
- **Invite System**: Email-based invitations with role assignment

### Project Management

- **Projects**: Organize work into distinct projects
- **Custom Workflows**: Define your own issue lifecycle
- **Sprints**: Time-boxed iterations with planning, tracking, and auto-rollover
- **Custom Fields**: Extend issues with organization-specific fields
- **Issue Types**: Story, Task, Bug, Epic (customizable)
- **Labels, Versions & Components** — _new in 0.3.x (API; UI minimal)_:
  - First-class org-scoped labels (`labels` + `issue_labels`, backfilled from the legacy JSONB array)
  - Project versions/releases with Fix Version / Affects Version relations
  - Project components with leads
  - Issue resolution model (`resolution`, `resolvedAt`, `flagged`)

### Issue Tracking

- **Rich Issue Model**:
  - Title, description (Markdown support)
  - Priority levels: Critical, High, Medium, Low, None
  - Status tracking with custom workflows
  - Story point estimation
  - Due dates and time tracking
  - Labels and tags
  - Parent-child relationships (epics, subtasks)

- **Issue Relationships**:
  - Blocks / Blocked by
  - Relates to
  - Duplicates / Duplicated by
  - Parent / Child

- **Comments & Activity**:
  - Threaded discussions
  - @mentions
  - Activity timeline
  - File attachments

### Multiple Views

- **Kanban Board**: Drag-and-drop issue management
- **List View**: Filterable, sortable table view
- **Roadmap View**: Per-project roadmap with Gantt-style bars (shipped; navigation entry minimal)
- **Backlog View**: Grooming and sprint assignment
- **Calendar View**: Date-based issue visualization (coming soon — roadmap #20)

### Keyboard-First UX

- **Command Palette** (`⌘K` / `Ctrl+K`):
  - Quick navigation
  - Issue creation
  - Search
  - Theme switching
  - AI features

- **Global Shortcuts**:
  - `C`: Create new issue
  - `/`: Focus search
  - `⌘K`: Open command palette
  - `Esc`: Close modals/dialogs

- **Inline Editing**:
  - Click to edit issue titles
  - Quick status changes
  - Rapid priority updates

## 🤖 AI-Powered Features

### 1. Generate Issue from Description

Transform natural language into structured tickets:

**Input:**

```
We need to add user authentication to our app. Users should be able
to sign in with Google or GitHub. We also need to protect certain
routes and manage user sessions securely.
```

**Output:**

- ✅ Structured title
- ✅ Detailed description with acceptance criteria
- ✅ Suggested type, priority, and labels
- ✅ Story point estimate

### 2. Summarize Thread

Get concise summaries of long comment threads:

- Key points and decisions
- Action items
- Unresolved questions
- Participant mentions

### 3. Sprint Planning Assistant

AI-powered sprint planning:

- Analyzes backlog and team capacity
- Suggests optimal issue selection
- Considers priorities and dependencies
- Provides reasoning and risk warnings

### 4. Project Health Analysis

Automated project insights:

- Overall health score (Healthy, At-Risk, Critical)
- Velocity trend analysis
- Risk identification
- Actionable recommendations

### 5. Improve Issue Title

Make titles clearer and more actionable:

- Action-oriented phrasing
- Concise and specific
- Professional tone
- Under 80 characters

### 6. Story Point Estimation

AI-suggested effort estimation (shipped):

- Story points and estimate hours with tracked estimate source
- AI estimate suggestions in the time-tracking flow

## 🎨 User Experience

### Three-Panel Layout

```
┌─────────────┬──────────────────┬─────────────┐
│             │                  │             │
│  Sidebar    │   Main Content   │   Detail    │
│             │                  │   Panel     │
│  - Nav      │   - Issue List   │   - Issue   │
│  - Projects │   - Kanban       │     Detail  │
│  - AI       │   - Timeline     │   - Activity│
│             │                  │             │
└─────────────┴──────────────────┴─────────────┘
```

### Dark Mode Support

- System preference detection
- Manual toggle
- Persistent user preference
- Optimized for both light and dark themes

### Responsive Design

- Mobile-first approach
- Tablet optimization
- Desktop-optimized layouts
- Touch-friendly interactions

## 🔐 Security & Compliance

### Authentication

- OAuth 2.0 (Google, GitHub)
- JWT-based sessions
- Refresh token rotation
- Secure password hashing (for email/password auth)

### Authorization

- API-level permission checks (application-level `WHERE`-clause tenant isolation — PostgreSQL RLS is **planned, not yet implemented**; see roadmap #37)
- UI-level access control
- Audit logging

### Data Protection

- Multi-tenant data isolation
- Encrypted connections (SSL/TLS)
- Input validation and sanitization
- CSRF protection
- Rate limiting

## 📊 Analytics & Reporting (Shipped)

### Team Metrics

- Velocity tracking
- Burndown charts
- Cycle time analysis
- Lead time measurement
- Time-in-status history per issue
- CSV / JSON export

### Individual Metrics

- Issue completion rate
- Average resolution time
- Contribution statistics

### Project Health

- Issue distribution
- Status breakdown
- Priority analysis
- Blocker identification

## 🔔 Notifications (Partially Shipped)

### In-App Notifications

- Notification bell with deep links and Smart Inbox (shipped)
- Issue assignment / comment / status-change events currently arrive via **email only**; in-app rows, @mention and watcher fan-out are roadmap #36
- Web-push subscriptions stored; sender pending

### Email Notifications

- Configurable preferences (shipped)
- Daily/weekly digests (preference exists; sending job pending — roadmap #36)

### Integrations

- Slack notifications
- Discord webhooks
- Microsoft Teams
- Custom webhooks

## 🔌 Integrations (Future)

### Version Control

- GitHub integration
- GitLab integration
- Bitbucket integration
- Commit linking

### Communication

- Slack
- Discord
- Microsoft Teams
- Email

### Development Tools

- Figma
- Linear (import)
- Jira (import)
- Notion (import)

## 🌐 Collaboration

### Real-Time Features (Shipped)

- Presence indicators on issues
- Collaborative issue-description editing (Tiptap + Yjs + Hocuspocus)
- SSE-based live updates (boards, activity, chat)
- LiveKit voice rooms and project-scoped chat

### Team Features

- @mentions in comments
- Issue assignments
- Team workload view
- Shared filters and views

## 📱 Mobile Support (Future)

- Progressive Web App (PWA)
- Native mobile apps (iOS, Android)
- Offline support
- Push notifications

## 🎯 Customization

### Workspace Customization

- Custom workflows
- Custom fields
- Custom issue types
- Custom labels

### Personal Preferences

- Theme selection
- Keyboard shortcuts
- Default views
- Notification settings

## 🚀 Performance

- Server-side rendering (SSR)
- Optimistic UI updates
- Code splitting
- Image optimization
- Caching strategies

---

**Note**: Features marked as "Coming Soon" or "Future" are planned but not yet implemented. For
per-feature status with evidence, see `docs/AUDIT_2026-06.md` and `docs/ROADMAP_2026.md`.

Last updated: 2026-06-12

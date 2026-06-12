> ARCHIVED 2026-06-12 — historical snapshot, superseded by docs/AUDIT_2026-06.md and README. Claims below describe Nov-2025-era state.

# TaskNebula 2025 Implementation Roadmap

**Created:** November 2025
**Status:** Phase 1 - Database Schema Completed ✅

---

## 🎯 ROADMAP OVERVIEW

### Phase 1: Foundation (COMPLETED ✅)

- ✅ Database schemas created for all 5 critical features
- ✅ 2025 competitive analysis completed
- ✅ Feature gaps identified

### Phase 2: AI Agents & Templates (Weeks 1-8)

- 🔄 AI Agents API endpoints
- 🔄 Project Templates system
- 🔄 Template marketplace UI

### Phase 3: Search & GitHub (Weeks 9-16)

- ⏳ Semantic search implementation
- ⏳ GitHub integration
- ⏳ Slack integration basics

### Phase 4: Resource Management (Weeks 17-24)

- ⏳ Workload balancing
- ⏳ Capacity planning
- ⏳ Smart assignment

---

## 📦 PHASE 1: DATABASE SCHEMAS (COMPLETED)

### Created Schemas

#### 1. AI Agents System

**File:** `packages/db/src/schema/ai-agents.ts`

**Tables:**

- ✅ `ai_agents` - Agent configurations (task creator, status updater, smart assigner, etc.)
- ✅ `ai_agent_executions` - Execution history and performance tracking
- ✅ `ai_agent_templates` - Pre-built agent templates marketplace

**Features:**

- Multi-LLM support (OpenAI, Anthropic, Google)
- Autonomous task execution
- Trigger-based activation
- Usage limits and quotas
- Execution analytics

**Example Agents:**

```typescript
// Task Creator Agent
{
  type: 'task_creator',
  aiModel: 'gpt-4o',
  config: {
    triggerOn: 'meeting_ended',
    sourceIntegrations: ['slack', 'zoom'],
    defaultProject: 'uuid',
    autoStart: true
  }
}

// Status Updater Agent
{
  type: 'status_updater',
  config: {
    triggerOn: 'pr_merged',
    statusMapping: {
      pr_opened: 'in_review',
      pr_merged: 'done'
    }
  }
}
```

---

#### 2. Project Templates System

**File:** `packages/db/src/schema/project-templates.ts`

**Tables:**

- ✅ `project_templates` - Reusable project configurations
- ✅ `template_usages` - Track template installations
- ✅ `template_reviews` - User ratings and reviews
- ✅ `template_categories` - Organize templates

**Features:**

- Save complete project setup (workflow, fields, automations, permissions)
- Template marketplace with ratings
- Public/private templates
- Template previews and screenshots
- Usage analytics

**Template Configuration:**

```typescript
{
  name: "Agile Software Development",
  category: "software_development",
  workflowId: "uuid",
  statuses: [...],
  issueTypes: ["story", "bug", "task", "epic"],
  customFields: [...],
  automationRules: [...],
  sprintConfig: {
    defaultDuration: 14,
    startDay: "monday"
  },
  boardConfig: {
    columns: ["backlog", "todo", "in_progress", "review", "done"],
    swimlanes: "assignee"
  }
}
```

---

#### 3. Semantic Search

**File:** `packages/db/src/schema/semantic-search.ts`

**Tables:**

- ✅ `content_embeddings` - Vector embeddings for semantic search (pgvector)
- ✅ `semantic_search_history` - Track searches for analytics
- ✅ `search_suggestions` - AI-powered search suggestions

**Features:**

- Natural language queries
- Context-aware search
- Multi-entity search (issues, comments, projects)
- Search history and suggestions
- Performance tracking

**Technical Stack:**

- PostgreSQL pgvector extension
- OpenAI text-embedding-ada-002 (1536 dimensions)
- Vector similarity search
- Content hashing for version control

---

#### 4. GitHub Integration

**File:** `packages/db/src/schema/github-integration.ts`

**Tables:**

- ✅ `github_installations` - GitHub App installations
- ✅ `github_repositories` - Linked repositories
- ✅ `github_commits` - Commits linked to issues
- ✅ `github_pull_requests` - PRs linked to issues
- ✅ `github_branches` - Branches created from issues
- ✅ `github_webhook_events` - Webhook event tracking

**Features:**

- PR/commit linking to issues
- Auto-transition on PR merge
- Branch creation from issues
- Bi-directional sync
- Webhook event processing
- Developer attribution

**Auto-Transition Example:**

```typescript
// Repository config
{
  autoTransitionOnMerge: true,
  mergeTransitionStatus: "done"
}

// When PR merged → Issue status = done
```

---

#### 5. Resource Management

**File:** `packages/db/src/schema/resource-management.ts`

**Tables:**

- ✅ `user_capacity` - Team member availability and skills
- ✅ `workload_snapshots` - Daily workload tracking
- ✅ `issue_estimations` - Enhanced time tracking
- ✅ `team_allocations` - Project team assignments
- ✅ `capacity_forecasts` - Future capacity planning
- ✅ `smart_assignment_rules` - AI-powered assignment config

**Features:**

- Workload balancing
- Capacity planning
- Skills-based assignment
- Time tracking (estimated vs actual)
- Team utilization analytics
- AI-powered smart assignment

**Smart Assignment Algorithm:**

```typescript
{
  considerWorkload: true,      // 40% weight
  considerSkills: true,        // 30% weight
  considerAvailability: true,  // 20% weight
  considerTimezone: true,      // 10% weight
  maxWorkloadPercentage: 100,
  maxAssignmentsPerDay: 5
}
```

---

## 🚀 PHASE 2: AI AGENTS & TEMPLATES (Weeks 1-8)

### Week 1-2: AI Agents Infrastructure

#### Database Migration

```bash
# Run migrations for new schemas
pnpm db:generate
pnpm db:migrate

# Enable required extensions
psql -d tasknebula -c "CREATE EXTENSION IF NOT EXISTS vector;"
```

#### LLM Package Enhancement

**File:** `packages/llm/src/index.ts`

```typescript
// Add multi-LLM support
export interface LLMProvider {
  provider: 'openai' | 'anthropic' | 'google';
  model: string;
  apiKey: string;
}

export function createLLMClient(config: LLMProvider) {
  switch (config.provider) {
    case 'openai':
      return new OpenAIClient(config);
    case 'anthropic':
      return new AnthropicClient(config);
    case 'google':
      return new GoogleClient(config);
  }
}

// Add Anthropic support
class AnthropicClient {
  constructor(config: LLMProvider) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async generateCompletion(prompt: string) {
    const message = await this.client.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content[0].text;
  }
}
```

#### API Endpoints

**Files to create:**

- `apps/web/src/app/api/ai-agents/route.ts`
- `apps/web/src/app/api/ai-agents/[agentId]/route.ts`
- `apps/web/src/app/api/ai-agents/[agentId]/execute/route.ts`
- `apps/web/src/app/api/ai-agents/templates/route.ts`

**Endpoints:**

```typescript
GET / api / ai - agents; // List agents
POST / api / ai - agents; // Create agent
GET / api / ai - agents / [agentId]; // Get agent
PUT / api / ai - agents / [agentId]; // Update agent
DELETE / api / ai - agents / [agentId]; // Delete agent
POST / api / ai - agents / [agentId] / execute; // Execute agent manually
GET / api / ai - agents / [agentId] / history; // Execution history
GET / api / ai - agents / templates; // Get agent templates
```

---

### Week 3-4: AI Agent Types Implementation

#### 1. Task Creator Agent

**Purpose:** Create tasks from meetings, Slack messages, emails

```typescript
// apps/web/src/lib/ai-agents/task-creator-agent.ts
export class TaskCreatorAgent {
  async execute(input: { source: 'slack' | 'zoom' | 'email'; content: string; context?: any }) {
    // 1. Parse content with LLM
    const parsed = await this.llm.parse(input.content);

    // 2. Extract task details
    const task = {
      title: parsed.title,
      description: parsed.description,
      assignee: parsed.suggestedAssignee,
      priority: parsed.suggestedPriority,
      labels: parsed.suggestedLabels,
    };

    // 3. Create issue
    const issue = await db.insert(issues).values(task);

    return { issueId: issue.id, created: true };
  }
}
```

#### 2. Status Updater Agent

**Purpose:** Auto-update issue status based on GitHub events

```typescript
// apps/web/src/lib/ai-agents/status-updater-agent.ts
export class StatusUpdaterAgent {
  async execute(input: {
    event: 'pr_opened' | 'pr_merged' | 'pr_closed';
    issueId: string;
    prNumber: number;
  }) {
    const agent = await this.getAgent();
    const statusMapping = agent.config.statusMapping;

    const newStatus = statusMapping[input.event];
    if (!newStatus) return;

    // Update issue status
    await db.update(issues).set({ statusId: newStatus }).where(eq(issues.id, input.issueId));

    // Add comment
    await db.insert(issueComments).values({
      issueId: input.issueId,
      userId: 'system',
      content: `Status automatically updated to ${newStatus} because PR #${input.prNumber} was ${input.event}`,
      isInternal: false,
    });

    return { updated: true, newStatus };
  }
}
```

#### 3. Smart Assignment Agent

**Purpose:** Intelligently assign issues based on workload, skills, availability

```typescript
// apps/web/src/lib/ai-agents/smart-assignment-agent.ts
export class SmartAssignmentAgent {
  async execute(input: { issueId: string }) {
    const issue = await this.getIssue(input.issueId);
    const teamMembers = await this.getTeamMembers(issue.projectId);

    // Calculate scores for each team member
    const scores = await Promise.all(
      teamMembers.map((member) => this.calculateAssignmentScore(member, issue))
    );

    // Sort by score (highest first)
    const bestMatch = scores.sort((a, b) => b.score - a.score)[0];

    // Assign issue
    await db
      .update(issues)
      .set({ assigneeId: bestMatch.userId })
      .where(eq(issues.id, input.issueId));

    return {
      assigned: true,
      assignee: bestMatch.userId,
      score: bestMatch.score,
      reasons: bestMatch.reasons,
    };
  }

  private async calculateAssignmentScore(member, issue) {
    const rule = await this.getAssignmentRule();
    const capacity = await this.getUserCapacity(member.id);
    const workload = await this.getUserWorkload(member.id);

    let score = 0;
    const reasons = [];

    // Workload factor (40%)
    if (rule.considerWorkload) {
      const utilizationScore = (100 - workload.utilizationPercentage) / 100;
      score += utilizationScore * 0.4;
      if (utilizationScore > 0.5) {
        reasons.push('Low current workload');
      }
    }

    // Skills factor (30%)
    if (rule.considerSkills) {
      const requiredSkills = issue.labels.filter((l) => capacity.skills.includes(l));
      const skillScore = requiredSkills.length / issue.labels.length;
      score += skillScore * 0.3;
      if (skillScore > 0.7) {
        reasons.push(`Strong match for required skills: ${requiredSkills.join(', ')}`);
      }
    }

    // Availability factor (20%)
    if (rule.considerAvailability) {
      const availabilityScore = capacity.isAvailable ? 1 : 0;
      score += availabilityScore * 0.2;
      if (!capacity.isAvailable) {
        reasons.push(`Currently unavailable until ${capacity.unavailableUntil}`);
      }
    }

    // Timezone factor (10%)
    if (rule.considerTimezone) {
      const timezoneMatch = member.timezone === issue.reporter.timezone;
      score += (timezoneMatch ? 1 : 0.5) * 0.1;
    }

    return { userId: member.id, score, reasons };
  }
}
```

---

### Week 5-6: Project Templates System

#### API Endpoints

**Files to create:**

- `apps/web/src/app/api/project-templates/route.ts`
- `apps/web/src/app/api/project-templates/[templateId]/route.ts`
- `apps/web/src/app/api/project-templates/[templateId]/use/route.ts`
- `apps/web/src/app/api/project-templates/marketplace/route.ts`

**Endpoints:**

```typescript
GET / api / project - templates; // List templates
POST / api / project - templates; // Create template
GET / api / project - templates / [templateId]; // Get template
PUT / api / project - templates / [templateId]; // Update template
DELETE / api / project - templates / [templateId]; // Delete template
POST / api / project - templates / [templateId] / use; // Create project from template
GET / api / project - templates / marketplace; // Browse marketplace
POST / api / project - templates / [templateId] / review; // Submit review
```

#### Template Creation Flow

```typescript
// Save existing project as template
POST /api/project-templates
{
  sourceProjectId: "uuid",
  name: "My Custom Template",
  description: "Template for mobile app projects",
  category: "software_development",
  isPublic: false
}

// System copies:
// - Workflow configuration
// - Custom fields
// - Automation rules
// - Permission scheme
// - Board settings
// - Sprint config (if enabled)
```

#### Template Usage Flow

```typescript
// Create project from template
POST /api/project-templates/[templateId]/use
{
  projectName: "New Mobile App",
  projectKey: "NMA",
  customizations: {
    // Override specific settings
    sprintDuration: 10, // Override default 14
    enableBacklog: false
  }
}

// System creates:
// 1. New project
// 2. Copies workflow
// 3. Copies custom fields
// 4. Copies automation rules (disabled by default)
// 5. Applies permission scheme
// 6. Configures board
```

---

### Week 7-8: Template Marketplace UI

#### UI Components

**Files to create:**

- `apps/web/src/components/templates/template-browser.tsx`
- `apps/web/src/components/templates/template-card.tsx`
- `apps/web/src/components/templates/template-detail-modal.tsx`
- `apps/web/src/components/templates/create-template-dialog.tsx`
- `apps/web/src/components/templates/use-template-wizard.tsx`

#### Template Browser

```typescript
// apps/web/src/components/templates/template-browser.tsx
export function TemplateBrowser() {
  const [category, setCategory] = useState('all');
  const { data: templates } = useQuery({
    queryKey: ['templates', category],
    queryFn: () => fetch(`/api/project-templates?category=${category}`).then(r => r.json()),
  });

  return (
    <div className="space-y-6">
      {/* Category filters */}
      <div className="flex gap-2">
        <Button variant={category === 'all' ? 'default' : 'outline'}
                onClick={() => setCategory('all')}>
          All Templates
        </Button>
        <Button variant={category === 'software_development' ? 'default' : 'outline'}
                onClick={() => setCategory('software_development')}>
          Software Development
        </Button>
        {/* More categories */}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-3 gap-4">
        {templates?.map(template => (
          <TemplateCard key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
}
```

---

## 📊 SUCCESS METRICS

### AI Agents

- [ ] 3+ agent types implemented
- [ ] 100+ agent executions per week
- [ ] 90%+ successful execution rate
- [ ] <2s average execution time

### Project Templates

- [ ] 10+ pre-built templates
- [ ] 50+ template installations per month
- [ ] 4.5+ average rating
- [ ] 80%+ user retention (templates used again)

### Semantic Search

- [ ] 50%+ queries using natural language
- [ ] <200ms search response time
- [ ] 90%+ search success rate (user clicks result)

### GitHub Integration

- [ ] 100+ repositories connected
- [ ] 500+ commits/PRs linked
- [ ] 80%+ auto-transition usage

### Resource Management

- [ ] 100%+ team capacity tracked
- [ ] 70%+ smart assignment usage
- [ ] 20%+ improvement in workload balance

---

## 🎯 NEXT STEPS

### Immediate (This Week)

1. ✅ Run database migrations
2. ⏳ Install required extensions (pgvector)
3. ⏳ Set up Anthropic API keys
4. ⏳ Create AI agents API endpoints

### Short Term (Weeks 2-4)

1. ⏳ Implement Task Creator Agent
2. ⏳ Implement Status Updater Agent
3. ⏳ Implement Smart Assignment Agent
4. ⏳ Build template creation flow

### Medium Term (Weeks 5-8)

1. ⏳ Template marketplace UI
2. ⏳ Pre-built templates (10+)
3. ⏳ Semantic search implementation
4. ⏳ GitHub App setup

---

## 📚 RESOURCES

### Documentation to Create

- [ ] AI Agents Developer Guide
- [ ] Template Creation Guide
- [ ] Semantic Search Usage Guide
- [ ] GitHub Integration Setup Guide
- [ ] Resource Management Best Practices

### Training Materials

- [ ] Video: Creating Your First AI Agent
- [ ] Video: Building Custom Templates
- [ ] Video: Setting Up GitHub Integration
- [ ] Blog: 2025 Feature Announcement

---

## 🔄 UPDATE LOG

**2025-11-26:**

- ✅ Created 5 core database schemas
- ✅ Competitive analysis completed
- ✅ Implementation roadmap defined
- ⏳ Ready for Phase 2 implementation

---

**Next Review:** End of Week 2 (After AI Agents API completion)

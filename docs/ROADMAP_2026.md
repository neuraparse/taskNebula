# TaskNebula 2026 Roadmap (Nisan-Mayıs sprintleri)

Source: 26-agent paralel araştırma (Linear, Jira/Rovo, Notion, ClickUp, Plane,
Asana/Monday, MCP, Voice, CRDT, Agent integrations, Calendar, UI, Mobile,
Analytics, Notifications, Time tracking, Docs, Compliance, Onboarding,
Slack/Discord, Performance, i18n/a11y, Observability, Search, OSS ecosystem,
AI safety, codebase audit).

## Stratejik Pozisyon

**"Self-hostable Linear, AI agentleri için kontrol düzlemi — Postgres'ten
başka hiçbir şey gerektirmeyen."**

Üç ayaklı moat:
1. Tek Postgres backend (rakipler Mongo/Elastic/RabbitMQ/MinIO yığını taşıyor)
2. Çift-provider AI (OpenAI + Anthropic) native, BYOK air-gapped
3. Linear Agent Protocol uyumu → Cursor/Devin/Copilot/Claude Code "TaskNebula
   assignee" olarak çalışsın

Yapma: chat/video/wiki süper-app, kendi calendar UI'sı, tldraw whiteboard
(lisans tuzağı), Microsoft Teams önce, native mobile önce.

## P0 — Nisan-Mayıs Sprintleri (deal-blocker / en yüksek ROI)

| # | Özellik | Efor |
|---|---|---|
| 1 | Hybrid search wire-up (tsvector + pgvector + RRF) — `content_embeddings` tablosu var, kod wire etmemiş | M |
| 2 | Triage Intelligence (auto-label + priority + assignee + duplicate detect) | M |
| 3 | "Ask TaskNebula" Q&A endpoint (RAG over issues+comments+docs, citation zorunlu) | M |
| 4 | Agent-as-assignee (`@claude`, `@cursor`, `@devin`, `@copilot`) — Linear Agent Protocol uyumu | L |
| 5 | MCP Server paketi (`packages/mcp-server`, 12 tool) | S-M |
| 6 | Centralized error handler + Pino logger (399 console → JSON logs) | S |
| 7 | AI cost runaway koruma (per-org token budget + kill switch + audit log) | S |
| 8 | Anthropic prompt caching + OpenAI Batch API | S |

## P1 — Mayıs-Haziran

| # | Özellik |
|---|---|
| 9 | Tiptap + Yjs + Hocuspocus collaborative issue description editing |
| 10 | Native time tracking minimum (estimate/actual + AI estimate suggest) |
| 11 | Initiatives + Sub-Initiatives + Initiative Updates |
| 12 | Web Forms / Intake (Linear Asks pattern) |
| 13 | AI Workspace Bootstrapper (NL → label/cycle/issue seed) |
| 14 | "Catch me up" digest + smart unified Inbox |
| 15 | Slack integration (slash + emoji-triage + thread sync + AI draft from thread) |
| 16 | PII redaction (Presidio) + prompt-injection sandbox |
| 17 | SAML 2.0 + SCIM 2.0 (Okta, Entra, Google Workspace) |

## P2 — Q3 2026

| # | Özellik |
|---|---|
| 18 | Docs module (BlockNote + Yjs + bidirectional `#TN-123` linking) |
| 19 | Native charts (Tremor + Recharts) + AI insight summaries + DORA-5 + Monte Carlo forecast |
| 20 | Calendar two-way sync (Google/Outlook/Cal.com) + Today + Pomodoro + capacity heatmap |
| 21 | Voice features (LiveKit transcript, voice → create issue, async voice notes) |
| 22 | i18n (TR/DE/ES) next-intl + WCAG 2.2 AA audit |
| 23 | Observability (SigNoz + Langfuse + pg_stat_statements + LiveKit metrics) |
| 24 | Agent recipe library (Standup, Stale-janitor, PR↔Issue linker, Release notes, Risk scorer) |
| 25 | Mobile (Expo: PWA → native shell; share-sheet, Live Activities, App Intents, offline queue) |
| 26 | Importers (Linear / Jira / GitHub Issues / CSV) |
| 27 | SOC 2 Type II + immutable audit log streaming + trust center |

## Sprint Planı (Nisan-Mayıs 2026)

**Hafta 1-2 — AI foundation:**
- Pino logger + error handler (#6)
- Hybrid search wire-up (#1)
- Prompt caching + Batch API (#8)

**Hafta 3-4 — Headline AI:**
- Triage Intelligence (#2)
- Ask TaskNebula RAG (#3)
- AI cost guard (#7) + PII redaction iskeleti (#16 yarısı)

**Hafta 5-6 — Ecosystem opening:**
- MCP Server (#5)
- Agent-as-assignee + Linear Agent Protocol (#4)
- Slack slash commands MVP (#15 yarısı)

**Hafta 7-8 — Activation & infra:**
- AI Workspace Bootstrapper (#13) + onboarding checklist
- Initiatives + Web Forms (#11, #12)
- E2E test seti (Playwright)

## Codebase Tech Debt (paralel olarak temizlenecek)

- 325 `any` tipi → strict null checks açılacak
- 399 `console.log` → Pino structured logger
- 194 API route'unun %9'u test edilmiş → Playwright E2E + Zod validator
  middleware ile %50+'a çıkar
- `error.tsx` boundary yok → ekle
- OpenAPI yok → Zod'dan generate
- SECURITY.md, CHANGELOG.md, CODE_OF_CONDUCT.md, ISSUE_TEMPLATE yok → ekle
- pgvector tablosu (`content_embeddings`) wire edilmemiş → embedding worker
- Pre-commit hook yok → Husky + lint-staged

## Açıkça Yapılmayacaklar

- tldraw whiteboard (lisans riski)
- Full standalone calendar UI (Google/Outlook'u complement et)
- Süper-app (chat + video + wiki + PM)
- Microsoft Teams önce (Slack/Discord öncelikli)
- Native mobile önce (PWA → Expo stage'leri)
- Replicache/Zero/Triplit (SSE %80 kapsamı veriyor)
- Time tracking'i Toggl'a karşı tam build (thin + sync)

## En Yüksek Asimetrik Bahis

**MCP Server + Agent-as-assignee (5 + 4)** — bir ayda bitiyor, anında
Cursor/Claude Code/Devin/Copilot kullanıcı tabanına TaskNebula'yı bağlıyor,
self-host tarafında henüz kimse yapmamış. Linear bu lane'i cloud'da kapadı,
açık alan TaskNebula'nın.

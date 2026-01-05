# TaskNebula - Eksiklikler ve Sorunlar Raporu (2025)

**Tarih:** Kasım 2025
**Araştırma Kapsamı:** Jira, Linear, Asana, Monday.com, ClickUp 2025 özellikleri

---

## 🎯 YÖNETİCİ ÖZETİ

TaskNebula **79 API endpoint**, **22 database tablosu** ve **105+ UI komponenti** ile güçlü bir temele sahip. Ancak 2025 rekabetinde kritik eksiklikler var:

### ❌ KRİTİK EKSİKLİKLER
1. **AI Agents/Otonom AI** - Rakiplerin hepsinde var, bizde yok
2. **Proje Template Sistemi** - Jira'nın en çok istenen özelliği, bizde yok
3. **Semantik Arama** - AI destekli akıllı arama yok
4. **GitHub/Slack Entegrasyonu** - Temel entegrasyonlar eksik

### ✅ GÜÇLÜ YÖNLER
1. **Granüler İzinler** (30+ izin tipi) - Sektörün en iyisi
2. **Audit Logging** (63+ aksiyon tipi) - Enterprise seviyesinde
3. **Güvenlik Şemaları** - Jira benzeri seviye bazlı güvenlik

---

## 📊 EKSİKLİKLER TABLOSU

| Kategori | TaskNebula Durumu | Rakipler | Öncelik | Etki |
|----------|-------------------|----------|---------|------|
| **AI Agents** | ❌ Yok | ✅ Tümünde var | 🔴 Kritik | Yüksek |
| **Proje Templates** | ❌ Yok | ✅ Tümünde var | 🔴 Kritik | Yüksek |
| **Semantik Arama** | ❌ Yok | ✅ Linear, Asana, ClickUp | 🔴 Kritik | Yüksek |
| **GitHub Entegrasyonu** | ❌ Yok | ✅ Tümünde var | 🔴 Kritik | Yüksek |
| **Slack Entegrasyonu** | ❌ Yok | ✅ Tümünde var | 🟡 Yüksek | Yüksek |
| **AI İş Parçalama** | ❌ Yok | ✅ Jira, ClickUp | 🟡 Yüksek | Orta |
| **Kaynak Yönetimi** | ❌ Yok | ✅ Monday, ClickUp | 🟡 Yüksek | Orta |
| **Gantt Chart** | ❌ Yok | ✅ Monday, ClickUp | 🟢 Orta | Orta |
| **Native Mobile App** | ❌ Yok | ✅ Tümünde var | 🟢 Orta | Orta |
| **SCIM 2.0** | ❌ Yok | ✅ Jira | 🟢 Orta | Düşük |

---

## 1. AI ÖZELLİKLERİ EKSİKLİKLERİ

### Mevcut Durum ✅
```typescript
// Var olan AI özellikleri
POST /api/ai/generate-issue     // GPT-4o-mini ile issue üretimi
POST /api/ai/summarize-thread   // Yorum özetleme

// LLM paketi
@tasknebula/llm
└── createLLMClient() // Sadece OpenAI
```

### Eksiklikler ❌

#### 1.1 AI Agents (Otonom AI Asistanları)
**Rakiplerde:**
- **ClickUp Autopilot**: $28/ay - Status günceller, toplantılardan task oluşturur, email gönderir
- **Asana AI Teammates**: Task atayabilirsin, AI bağımsız çalışır
- **Monday.com agents**: Baştan sona task çalıştırma
- **Linear for Agents**: Kod üretimi ve teknik delegasyon

**Bizde:** Yok. AI sadece talep üzerine çalışır, otonom değil.

**Etki:** Kullanıcılar AI'a iş delege edemez. Her AI işlemi manuel tetiklenmeli.

**Gerekli Geliştirme:**
```typescript
// Yeni tablo
CREATE TABLE ai_agents (
  id UUID PRIMARY KEY,
  name TEXT,
  type TEXT, -- 'task_creator', 'status_updater', 'email_sender'
  config JSON,
  enabled BOOLEAN,
  organization_id UUID
);

// Yeni endpoint
POST /api/ai-agents
POST /api/ai-agents/[agentId]/execute
```

#### 1.2 Semantik Arama
**Rakiplerde:**
- **Linear**: AI destekli semantik arama
- **Asana**: Çok dilli semantik arama
- **ClickUp Brain**: Tüm içerikte bağlam anlayan arama

**Bizde:** Sadece JQL keyword arama
```sql
-- Mevcut
/api/search?query=assignee:me status:todo

-- Eksik
"Yüksek öncelikli kimlik doğrulama ile ilgili tüm taskları bul"
```

**Gerekli Geliştirme:**
```typescript
// Embedding tablosu
CREATE TABLE content_embeddings (
  id UUID PRIMARY KEY,
  content_type TEXT, -- 'issue', 'comment', 'description'
  content_id UUID,
  embedding VECTOR(1536), -- OpenAI embedding
  created_at TIMESTAMP
);

// Yeni endpoint
POST /api/search/semantic
{
  query: "authentication tasks that are overdue",
  limit: 20
}
```

#### 1.3 Multi-LLM Desteği
**Rakiplerde:**
- **ClickUp Brain**: ChatGPT + Claude + Gemini (sınırsız)

**Bizde:** Sadece OpenAI GPT-4o-mini

**Gerekli Geliştirme:**
```typescript
// packages/llm/src/index.ts
export function createLLMClient(provider: 'openai' | 'anthropic' | 'google') {
  switch(provider) {
    case 'openai': return new OpenAIClient();
    case 'anthropic': return new AnthropicClient();
    case 'google': return new GoogleClient();
  }
}
```

#### 1.4 AI Risk Değerlendirmesi
**Rakiplerde:**
- **Asana AI Risk Reports**: Haftalık otomatik risk analizi
- **ClickUp**: Tahmine dayalı zamanlama

**Bizde:** Yok

**Gerekli:**
```typescript
POST /api/ai/risk-assessment
{
  projectId: string,
  sprintId?: string
}

Response: {
  riskLevel: 'low' | 'medium' | 'high',
  risks: [{
    type: 'schedule_delay' | 'resource_overload' | 'scope_creep',
    probability: number,
    impact: number,
    recommendation: string
  }]
}
```

#### 1.5 AI Custom Fields
**ClickUp'da:**
- Her field bir AI prompt olabiliyor
- "Bu taski özetle", "İspanyolcaya çevir", "Aksiyon itemları çıkar"

**Bizde:** Static custom fields
```sql
-- Mevcut
customFields: text, number, date, select, checkbox, url, email

-- Eksik: AI-powered fields
type: 'ai_generated'
aiPrompt: "Summarize the issue description"
triggerOn: 'issue_created' | 'issue_updated'
```

---

## 2. TEMPLATE SİSTEMİ EKSİKLİKLERİ

### Mevcut Durum ✅
```sql
-- Var olan
workflows table          -- Org başına custom workflow
workflowStatuses table   -- Custom statuslar
workflowTransitions      -- Status geçişleri
```

### Eksiklikler ❌

#### 2.1 Proje Template'leri
**Jira'da:** En çok istenen özellik (#1)
- Tüm proje config'ini kaydet (workflow, field, automation, permission)
- Template marketplace

**Bizde:** Yok. Her yeni proje sıfırdan başlıyor.

**Etki:** Takımlar aynı proje yapısını tekrar tekrar yaratmak zorunda. Saatler kayboluyor.

**Gerekli Tablo:**
```sql
CREATE TABLE project_templates (
  id UUID PRIMARY KEY,
  name TEXT,
  description TEXT,
  category TEXT, -- 'software_dev', 'marketing', 'hr'
  workflow_config JSON,
  custom_fields JSON,
  automation_rules JSON,
  permission_scheme_id UUID,
  statuses JSON,
  issue_types JSON[],
  is_public BOOLEAN,
  organization_id UUID,
  created_by UUID
);

CREATE TABLE template_marketplace (
  template_id UUID REFERENCES project_templates(id),
  downloads INTEGER,
  rating DECIMAL,
  verified BOOLEAN
);
```

#### 2.2 Automation Template'leri
**Asana'da:** AI Rules - Hazır automation kuralları
- "Taskları otomatik yeniden adlandır"
- "İstekleri özetle"
- "Gelen işleri önceliklendir"

**Bizde:** Manuel kural oluşturma

#### 2.3 Form Template'leri
**Jira'da:** Sık kullanılan istek formları
- Website güncelleme
- İçerik oluşturma
- Bug report

**Bizde:** Yok

---

## 3. ENTEGRASYON EKSİKLİKLERİ

### Mevcut Durum ✅
```typescript
Var olan entegrasyonlar:
├── Webhook sistemi (10 event tipi)
│   ├── Retry mekanizması
│   └── Delivery tracking
├── Stripe (faturalama)
├── OAuth providers (Auth.js)
├── Email templates
└── Push notifications
```

### Eksiklikler ❌

#### 3.1 GitHub Entegrasyonu (KRİTİK)
**Neden kritik:** Developer takımlar için olmazsa olmaz

**Rakiplerde:**
- **Jira**: PR/commit linking, merge'de otomatik geçiş, branch oluşturma
- **Linear**: GitHub sync, PR status issue'da görünür
- **ClickUp**: Commit tracking, PR merge'de issue kapatma

**Bizde:** Yok

**Etki:** Developerlar kod durumunu issue'da göremez. Merge'de otomatik kapanma yok.

**Gerekli API:**
```typescript
// Eksik endpoint'ler
POST /api/integrations/github/connect
POST /api/integrations/github/repos
GET  /api/issues/[issueId]/commits
GET  /api/issues/[issueId]/pull-requests
POST /api/issues/[issueId]/create-branch

// Eksik tablolar
CREATE TABLE github_installations (
  id UUID PRIMARY KEY,
  organization_id UUID,
  installation_id TEXT,
  access_token TEXT,
  repositories JSON[]
);

CREATE TABLE github_commits (
  id UUID PRIMARY KEY,
  issue_id UUID,
  sha TEXT,
  message TEXT,
  author TEXT,
  url TEXT,
  committed_at TIMESTAMP
);

CREATE TABLE github_pull_requests (
  id UUID PRIMARY KEY,
  issue_id UUID,
  pr_number INTEGER,
  title TEXT,
  state TEXT, -- 'open', 'merged', 'closed'
  url TEXT,
  created_at TIMESTAMP,
  merged_at TIMESTAMP
);
```

#### 3.2 Slack Entegrasyonu (KRİTİK)
**Neden kritik:** Ekip iletişiminin merkezi

**Rakiplerde:**
- **Linear**: Çift yönlü sync - Slack'te yorum → Linear'da görünür
- **Asana**: Slack'ten task oluşturma, kanallara bildirim
- **Monday**: Bot komutları, Slack'te status güncelleme

**Bizde:** Yok

**Etki:** Slack'te bildirim yok, Slack'ten task oluşturma yok.

**Gerekli:**
```typescript
POST /api/integrations/slack/connect
POST /api/integrations/slack/channels
POST /api/notifications/send-to-slack
POST /api/slack/commands/create-issue
POST /api/slack/commands/update-status
```

#### 3.3 Diğer Eksik Entegrasyonlar
- ❌ **Confluence/Docs**: Dökümanlardan task oluşturma
- ❌ **Microsoft 365**: Copilot entegrasyonu
- ❌ **Google Workspace**: Drive, Calendar
- ❌ **Loom/Zoom**: Toplantı kaydından task üretme

---

## 4. OTOMASYON EKSİKLİKLERİ

### Mevcut Durum ✅
```sql
automationRules table:
├── Triggers: issue.created, updated, assigned, commented, scheduled
├── Conditions: Custom logic
├── Actions: Multiple action execution
└── Org/project scope
```

### Eksiklikler ❌

#### 4.1 Doğal Dil Otomasyonu
**Monday.com vibe:** Düz İngilizce ile kural oluşturma
```
"When a task is marked high priority,
notify the team lead and create a subtask for review"
```

**Bizde:** Manuel JSON/form tabanlı

#### 4.2 AI Tarafından Önerilen Kurallar
**Asana:** Takım davranışlarından öğrenip automation önerir

**Bizde:** Yok

#### 4.3 Cross-Project Otomasyon
**Rakiplerde:** Projeler arası automation

**Bizde:** Tek proje/org ile sınırlı

#### 4.4 Gelişmiş Action Block'lar
**Gerekli yeni aksiyonlar:**
```typescript
type:
  | 'create_subtask'       // YENİ
  | 'link_issue'           // YENİ
  | 'add_to_sprint'        // YENİ
  | 'notify_slack'         // YENİ
  | 'trigger_webhook'      // YENİ
  | 'ai_summarize'         // YENİ
  | 'ai_breakdown'         // YENİ
  | 'schedule_task'        // YENİ
  | 'update_github_pr'     // YENİ
```

---

## 5. RAPORLAMA & ANALİTİK EKSİKLİKLERİ

### Mevcut Durum ✅
```typescript
Analytics API:
├── GET /api/analytics/velocity        // Sprint velocity
├── GET /api/analytics/project-health  // Proje sağlığı
├── GET /api/analytics/burndown        // Burndown chart
└── GET /api/export/issues             // CSV/JSON export
```

### Eksiklikler ❌

#### 5.1 Tarihsel Raporlama
**Monday.com:** Zaman içinde trend analizi

**Bizde:** Sadece anlık snapshot

**Etki:** Velocity trendleri görülemez, çeyrekler arası gelişim takip edilemez.

**Gerekli:**
```sql
CREATE TABLE analytics_snapshots (
  id UUID PRIMARY KEY,
  snapshot_date DATE,
  project_id UUID,
  metrics JSON, -- {velocity, completion_rate, etc}
  created_at TIMESTAMP
);

GET /api/analytics/trends?projectId=x&period=last_6_months
```

#### 5.2 Cross-Project Dashboard'lar
**Rakiplerde:** Tüm projeleri tek dashboard'da toplama

**Bizde:** Sadece tek proje analytics

**Etki:** Yönetici seviyesinde genel bakış yok.

**Gerekli:**
```sql
CREATE TABLE dashboards (
  id UUID PRIMARY KEY,
  name TEXT,
  owner_id UUID,
  layout JSON,
  widgets JSON[],
  filters JSON,
  shared_with UUID[]
);

CREATE TABLE dashboard_widgets (
  id UUID PRIMARY KEY,
  dashboard_id UUID,
  type TEXT, -- 'burndown', 'velocity', 'pie_chart'
  config JSON,
  data_source JSON -- multi-project query
);
```

#### 5.3 Tahmine Dayalı Analitik
**Asana:** Proje gecikmelerini önceden tahmin etme

**Bizde:** Yok

#### 5.4 Custom Dashboard'lar
**Jira:** Sürükle-bırak dashboard builder

**Bizde:** Sabit analytics görünümleri

---

## 6. KAYNAK YÖNETİMİ EKSİKLİKLERİ

### Mevcut Durum ⚠️
```typescript
// Var olan time tracking
Worklogs:
├── timeSpent (dakika)
├── description
├── startedAt
└── author
```

### Eksiklikler ❌

#### 6.1 Workload Balancing
**Monday.com AI Smart Assignment:**
- Task gereksinimleri, beceriler, roller, müsaitliği analiz eder
- En uygun team member'ı otomatik önerir

**Bizde:** Manuel assignment

**Etki:** İş yükü dengesiz dağılır → burnout veya atıl kapasite

#### 6.2 Capacity Planning
**ClickUp AI Scheduler:**
- Deadline ve müsaitliğe göre günlük ajanda oluşturur
- Öncelikler değiştikçe dinamik ayarlar

**Bizde:** Yok

**Etki:** Takım kapasitesi ve overload görünmez.

**Gerekli:**
```typescript
// Issues tablosuna ekle
estimatedTime: integer  // dakika
remainingTime: integer

// Yeni endpoint
GET /api/analytics/capacity
Response: {
  teamMembers: [{
    userId: string,
    name: string,
    allocatedHours: number,    // Atanan iş
    availableHours: number,    // Müsait kapasite
    utilization: number,       // %
    overloaded: boolean
  }]
}

GET /api/analytics/team-workload
Response: {
  date: string,
  members: [{
    userId: string,
    plannedHours: number,
    actualHours: number,
    tasks: [{
      issueId: string,
      estimatedHours: number
    }]
  }]
}
```

#### 6.3 Time Tracking Geliştirmeleri
**Eksik raporlar:**
- ❌ Tahmini vs gerçek süre karşılaştırması
- ❌ Takım kapasite dashboard'ları
- ❌ Burnup chart'lar
- ❌ Proje/epic bazında zaman dağılımı

---

## 7. GÖRSEL PLANLAMA EKSİKLİKLERİ

### Mevcut Durum ✅
```typescript
Görselleştirme:
├── Kanban Board (drag-drop)
├── Epic Roadmap (timeline view)
├── Sprint view
└── Backlog view
```

### Eksiklikler ❌

#### 7.1 Gantt Chart
**Rakiplerde:**
- **Monday**: Tam Gantt view + bağımlılıklar
- **ClickUp**: Milestone'lı timeline view

**Bizde:** Sadece basitleştirilmiş epic roadmap

#### 7.2 Görsel Bağımlılık Yönetimi
**Mevcut:**
```sql
issueLinks table:
- blocks, relates_to, duplicates
- parent_of, child_of
```

**İyi, ama eksik:**
- ❌ Roadmap'te bağımlılık okları yok
- ❌ Critical path highlighting yok
- ❌ Bağımlılık çakışması tespiti yok

#### 7.3 Swimlane'ler
**Linear ekledi:** Board organizasyonu için swimlane'ler

**Bizde:** Sadece basic kolonlar

**Etki:** Board'da assignee, priority veya epic'e göre gruplama yapılamaz.

**Gerekli:**
```typescript
// Board view options
groupBy: 'status' | 'assignee' | 'priority' | 'epic' | 'label'
```

#### 7.4 Conditional Formatting
**Jira 2025:** Hücreleri vurgulamak için kurallar

**Bizde:** Static card renkleri

**Eksik örnekler:**
- Geçmiş tasklar → kırmızı arka plan
- Blocked issue'lar → sarı border
- Yüksek öncelik → kalın yazı

---

## 8. ENTERPRISE ÖZELLİK EKSİKLİKLERİ

### Mevcut Durum ✅ (GÜÇLÜ)
```typescript
Admin sistemi:
├── Super admin role
├── User/org management
├── System statistics
├── Feature flags (rollout control)
├── Audit logs (63+ action type)
└── System audit logs
```

### Eksiklikler ❌

#### 8.1 SCIM 2.0 Provisioning
**Jira 2025:** IdP'den otomatik user provisioning (Okta, Azure AD)

**Bizde:** Manuel user oluşturma

**Etki:** Büyük enterprise'lar kurumsal dizinden user sync yapamaz.

**Gerekli:**
```typescript
// SCIM 2.0 endpoints
POST   /api/scim/v2/Users
GET    /api/scim/v2/Users
GET    /api/scim/v2/Users/[userId]
PUT    /api/scim/v2/Users/[userId]
DELETE /api/scim/v2/Users/[userId]
POST   /api/scim/v2/Groups
GET    /api/scim/v2/Groups
```

#### 8.2 Multi-Tenant/Multi-Portal
**Monday.com:** Tek hesapta birden fazla markalı portal

**Bizde:** Tek organization context

**Etki:** Service desk'ler farklı müşteriler için ayrı portallar oluşturamaz.

#### 8.3 Gelişmiş Faturalama
**Mevcut:**
- ✅ Stripe integration
- ✅ Plan tiers (free/starter/growth/enterprise)
- ✅ Usage tracking

**Eksik:**
- ❌ Usage-based billing (API call bazlı fiyatlandırma)
- ❌ Enterprise için özel kontratlar
- ❌ Multi-currency support

---

## 9. MOBİL & OFFLİNE EKSİKLİKLERİ

### Mevcut Durum ⚠️
```typescript
// Mobile component'ler var
├── mobile-nav.tsx
├── mobile-header.tsx
├── mobile-issue-list.tsx
└── pull-to-refresh.tsx

// AMA: Web-only, native app yok
```

### Eksiklikler ❌

#### 9.1 Native Mobile Apps
**Rakiplerde:** iOS/Android native app'ler
- Offline mode
- Push notifications
- Kamera entegrasyonu (attachment için)
- Optimize mobile UX

**Bizde:** Sadece responsive web

#### 9.2 Offline Mode
**Rakiplerde:**
- **ClickUp**: Full offline mode + sync
- **Asana**: Offline task görüntüleme/düzenleme

**Bizde:** İnternet bağlantısı gerekli

**Etki:** Saha ekipleri, remote çalışanlar bağlantı sorununda kullanamaz.

---

## 10. COLABORATION EKSİKLİKLERİ

### Mevcut Durum ✅
```typescript
Collaboration:
├── Comments (mentions, reactions, internal)
├── Presence tracking
├── Watchers
├── Notifications (9 tip)
└── Activity feed
```

### Eksiklikler ❌

#### 10.1 Video Yorumlar
**Rakiplerde:**
- **Jira**: Loom video comments
- **ClickUp**: Task içinde ekran kaydı

**Bizde:** Sadece text/file attachments

#### 10.2 Collaborative Editing
**Rakiplerde:**
- **ClickUp**: Task description'da real-time co-editing
- **Asana**: Presence indicator'lı canlı düzenleme

**Bizde:** Single-user editing (simultaneous edit'te conflict)

---

## ÖNCELİKLİ EYLEM PLANI

### 🔴 İLK 2 AY (Kritik - Piyasada kalmak için gerekli)

#### 1. AI Agents Framework (6 hafta)
```typescript
// Hedef
AI Agents:
├── Task Creator Agent (toplantı notlarından task)
├── Status Updater Agent (PR merge → done)
├── Smart Assignment Agent (en uygun kişiye ata)
└── Email/Notification Agent
```

**Tahmini Effort:** 6 hafta
- Hafta 1-2: Agent framework altyapısı
- Hafta 3-4: İlk 2 agent (task creator + status updater)
- Hafta 5-6: Testing + docs

#### 2. Proje Template Sistemi (3-4 hafta)
```sql
-- Database schema
project_templates
template_marketplace
template_categories

-- UI
Template browser
Template creation wizard
Template preview
```

**Tahmini Effort:** 4 hafta
- Hafta 1: Database + API
- Hafta 2: Template oluşturma UI
- Hafta 3: Template kullanma flow
- Hafta 4: Marketplace + polish

#### 3. Semantik Arama (4 hafta)
```typescript
// Teknoloji stack
OpenAI Embeddings API
PostgreSQL pgvector extension
Semantic search endpoint

// Features
Natural language queries
Context-aware search
Multi-entity search (issues + comments + docs)
```

**Tahmini Effort:** 4 hafta

### 🟡 3-4. AY (Rekabet avantajı)

#### 4. GitHub Entegrasyonu (4 hafta)
- GitHub App kurulumu
- PR/commit sync
- Auto-close on merge
- Branch creation from issues

#### 5. Slack Entegrasyonu (3 hafta)
- Slack Bot
- Bi-directional sync
- Slash commands
- Channel notifications

#### 6. Resource Management (5 hafta)
- Workload balancing
- Capacity planning
- Team utilization dashboard
- Smart assignment

### 🟢 5-6. AY (Ölçeklendirme)

#### 7. Advanced Analytics
- Historical reporting
- Cross-project dashboards
- Predictive analytics

#### 8. Mobile Apps
- React Native development
- iOS/Android apps
- Offline mode

#### 9. Enterprise Features
- SCIM 2.0
- Multi-portal support
- Advanced billing

---

## REKABET KONUMLAMA STRATEJİSİ

### Güçlü Yönlerimiz (Pazarlama Mesajları)

#### 1. "Enterprise-Grade Security That Scales"
- 30+ granular permission types (sektörün en fazlası)
- Issue-level security schemes
- Reusable permission templates

#### 2. "SOC 2 / GDPR Ready Out of the Box"
- 63 action type tracking
- Complete audit trail
- Compliance-ready

#### 3. "Open Integration Platform"
- Robust webhook system
- API-first architecture
- Developer-friendly

### Kapatılması Gereken Algı Boşlukları

❌ **"TaskNebula AI yok mu?"**
→ Şu anda: Basic AI (issue gen + summarization)
→ Hedef: AI Agents + Semantic Search

❌ **"Template sistemi var mı?"**
→ Şu anda: Yok
→ Hedef: 2 ay içinde

❌ **"GitHub/Slack entegre mi?"**
→ Şu anda: Yok
→ Hedef: 4 ay içinde

---

## KAYNAKLAR

Tüm araştırma kaynakları için bakınız:
- `COMPETITIVE_ANALYSIS_2025.md`
- `DETAILED_FEATURE_COMPARISON_2025.md`

---

## SONUÇ

**TaskNebula'nın güçlü bir temeli var** ancak 2025'te rekabet edebilmek için:

1. **AI-First Zorunlu**: 3 ay içinde AI agents + semantik arama
2. **Template'ler Büyüme Anahtarı**: Jira'nın #1 istenen özelliği
3. **Entegrasyonlar = Sadakat**: GitHub + Slack retention'ı 10x artırır
4. **Güçlü Yönleri Öne Çıkar**: Granular permissions ve audit logging enterprise diferansiyatörü

**Alt Çizgi:** Q1 2026 odağı: AI + Templates + GitHub/Slack. Geri kalan her şey ikincil.

/**
 * Sub-processors disclosed on the public Trust Center.
 *
 * Edit this list directly to keep the page current — the trust center page
 * imports it server-side, so every deploy ships the latest disclosure.
 *
 * Categories are intentionally coarse-grained: the goal is "what data goes
 * where", not vendor management. Add a `dataProcessed` field only when the
 * lawyer-approved description is ready; keep `Personal data only when needed`
 * as a safe default.
 */

export type SubProcessorCategory =
  | 'compute'
  | 'ai'
  | 'identity'
  | 'email'
  | 'observability'
  | 'realtime'
  | 'cdn';

export interface SubProcessor {
  name: string;
  category: SubProcessorCategory;
  purpose: string;
  region: string;
  // Optional — only show if a stable link exists.
  url?: string;
  // True when the vendor is on the roadmap rather than active production.
  placeholder?: boolean;
}

export const SUB_PROCESSORS: SubProcessor[] = [
  {
    name: 'Amazon Web Services (AWS)',
    category: 'compute',
    purpose: 'Primary cloud infrastructure: compute, storage, and database hosting.',
    region: 'US (us-east-1), EU (eu-west-1)',
    url: 'https://aws.amazon.com/compliance/data-privacy/',
  },
  {
    name: 'Google Cloud Platform (GCP)',
    category: 'compute',
    purpose: 'Secondary compute and storage for AI workloads.',
    region: 'US (us-central1), EU (europe-west4)',
    url: 'https://cloud.google.com/privacy',
  },
  {
    name: 'Anthropic',
    category: 'ai',
    purpose: 'Claude API for AI assistants, summarization, and search.',
    region: 'US',
    url: 'https://www.anthropic.com/legal/privacy',
  },
  {
    name: 'OpenAI',
    category: 'ai',
    purpose: 'Optional fallback LLM provider when configured by the workspace.',
    region: 'US',
    url: 'https://openai.com/policies/privacy-policy',
  },
  {
    name: 'GitHub (OAuth)',
    category: 'identity',
    purpose: 'OAuth identity provider and source-control integration.',
    region: 'US',
    url: 'https://docs.github.com/en/site-policy/privacy-policies',
  },
  {
    name: 'Resend',
    category: 'email',
    purpose: 'Transactional email delivery (notifications, invites).',
    region: 'US',
    url: 'https://resend.com/legal/privacy-policy',
  },
  {
    name: 'Amazon SES',
    category: 'email',
    purpose: 'Fallback transactional email delivery.',
    region: 'US, EU',
    url: 'https://aws.amazon.com/ses/',
  },
  {
    name: 'Sentry',
    category: 'observability',
    purpose: 'Error tracking and release health monitoring.',
    region: 'US, EU',
    url: 'https://sentry.io/privacy/',
  },
  {
    name: 'LiveKit',
    category: 'realtime',
    purpose: 'Realtime audio/video for in-product calls and presence.',
    region: 'Global edge',
    url: 'https://livekit.io/legal/privacy-policy',
  },
  {
    name: 'Cloudflare',
    category: 'cdn',
    purpose: 'CDN, DDoS protection, and DNS (planned).',
    region: 'Global edge',
    url: 'https://www.cloudflare.com/privacypolicy/',
    placeholder: true,
  },
];

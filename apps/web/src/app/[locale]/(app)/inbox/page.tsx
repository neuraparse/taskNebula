import { Metadata } from 'next';
import { InboxPageClient } from './inbox-client';

export const metadata: Metadata = {
  title: 'Inbox | TaskNebula',
  description: 'Unified Smart Inbox: mentions, agent runs, webhooks, and system events.',
};

export const dynamic = 'force-dynamic';

export default function InboxPage() {
  return <InboxPageClient />;
}

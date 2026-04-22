import { redirect } from 'next/navigation';

export default function BillingRedirectPage() {
  redirect('/settings?tab=organization');
}

import { redirect } from 'next/navigation';

export default function MembersRedirectPage() {
  redirect('/settings?tab=members');
}

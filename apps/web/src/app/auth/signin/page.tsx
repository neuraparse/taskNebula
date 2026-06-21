import { SignInForm } from '@/components/auth/signin-form';
import { AuthShell } from '@/components/auth/auth-shell';

// signin form reads query params (verified=1, reset=1, error=...) via useSearchParams,
// which requires either a Suspense boundary or opting out of static prerender.
export const dynamic = 'force-dynamic';

export default function SignInPage() {
  return (
    <AuthShell>
      <SignInForm />
    </AuthShell>
  );
}

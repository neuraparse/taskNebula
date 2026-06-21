import { SignUpForm } from '@/components/auth/signup-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function SignUpPage() {
  return (
    <AuthShell>
      <SignUpForm />
    </AuthShell>
  );
}

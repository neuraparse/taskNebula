import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AuthShell } from '@/components/auth/auth-shell';

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
      <ForgotPasswordForm />
    </AuthShell>
  );
}

import { SignUpForm } from '@/components/auth/signup-form';
import Link from 'next/link';

export default function SignUpPage() {
  return (
    <div className="relative min-h-screen bg-background overflow-hidden flex items-center justify-center px-4">
      {/* Aurora background */}
      <div className="bg-aurora absolute inset-0 pointer-events-none animate-aurora opacity-80" />

      {/* Centered card */}
      <div className="relative z-10 w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-foreground">
              <span className="text-xs font-semibold tracking-tight text-background">TN</span>
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-foreground">TaskNebula</span>
          </Link>
        </div>

        <div className="surface-card p-8 shadow-lg rounded-xl">
          <SignUpForm />
        </div>
      </div>
    </div>
  );
}

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'border-border bg-card ease-snap file:text-foreground placeholder:text-muted-foreground focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:border-ring aria-[invalid=true]:border-destructive aria-[invalid=true]:focus-visible:ring-destructive flex h-9 w-full rounded-md border px-3 py-1 text-sm transition-all duration-150 file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };

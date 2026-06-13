import * as React from 'react';
import * as AvatarPrimitive from '@radix-ui/react-avatar';
import { cva, type VariantProps } from 'class-variance-authority';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

function isSafeAvatarSrc(src: string | undefined) {
  if (!src) {
    return false;
  }

  const trimmed = src.trim();
  if (!trimmed) {
    return false;
  }

  return (
    trimmed.startsWith('/') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  );
}

const avatarVariants = cva('relative flex shrink-0 overflow-hidden rounded-full', {
  variants: {
    size: {
      xs: 'h-4 w-4 text-[8px]',
      sm: 'h-5 w-5 text-[10px]',
      md: 'h-6 w-6 text-[11px]',
      lg: 'h-8 w-8 text-xs',
      xl: 'h-10 w-10 text-sm',
      '2xl': 'h-14 w-14 text-base',
    },
  },
  defaultVariants: {
    size: 'xl',
  },
});

export interface AvatarProps
  extends React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>,
    VariantProps<typeof avatarVariants> {}

const Avatar = React.forwardRef<React.ElementRef<typeof AvatarPrimitive.Root>, AvatarProps>(
  ({ className, size, ...props }, ref) => (
    <AvatarPrimitive.Root
      ref={ref}
      className={cn(avatarVariants({ size }), className)}
      {...props}
    />
  )
);
Avatar.displayName = AvatarPrimitive.Root.displayName;

const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, src, ...props }, ref) => {
  if (typeof src === 'string' && !isSafeAvatarSrc(src)) {
    return null;
  }

  return (
    <AvatarPrimitive.Image
      ref={ref}
      className={cn('aspect-square h-full w-full', className)}
      src={src}
      {...props}
    />
  );
});
AvatarImage.displayName = AvatarPrimitive.Image.displayName;

const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn(
      'bg-muted flex h-full w-full items-center justify-center rounded-full',
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName;

export interface AvatarStackProps {
  children: React.ReactNode;
  size?: VariantProps<typeof avatarVariants>['size'];
  max?: number;
  className?: string;
}

const AvatarStack = React.forwardRef<HTMLDivElement, AvatarStackProps>(
  ({ children, size, max = 3, className }, ref) => {
    const t = useTranslations('uiCommon');
    const items = React.Children.toArray(children).filter(React.isValidElement);
    const visible = items.slice(0, max);
    const overflow = items.length - visible.length;

    return (
      <div ref={ref} className={cn('flex items-center', className)}>
        {visible.map((child, index) => {
          const element = child as React.ReactElement<{
            className?: string;
            size?: VariantProps<typeof avatarVariants>['size'];
          }>;
          return React.cloneElement(element, {
            key: element.key ?? index,
            size: element.props.size ?? size,
            className: cn(
              'ring-2 ring-background',
              index > 0 && '-ml-1.5',
              element.props.className
            ),
          });
        })}
        {overflow > 0 && (
          <div
            className={cn(
              avatarVariants({ size }),
              'ring-background bg-muted text-muted-foreground -ml-1.5 flex items-center justify-center font-medium ring-2'
            )}
            aria-label={t('avatarOverflow', { count: overflow })}
          >
            +{overflow}
          </div>
        )}
      </div>
    );
  }
);
AvatarStack.displayName = 'AvatarStack';

export { Avatar, AvatarImage, AvatarFallback, AvatarStack, avatarVariants };

'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface OptimizedImageProps extends Omit<ImageProps, 'onError' | 'onLoad'> {
  fallbackSrc?: string;
  showLoader?: boolean;
}

/**
 * Optimized Image Component
 * 
 * Wrapper around Next.js Image component with:
 * - Automatic loading states
 * - Fallback image support
 * - Error handling
 * - Blur placeholder
 */
export function OptimizedImage({
  src,
  alt,
  fallbackSrc = '/images/placeholder.png',
  showLoader = true,
  className,
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [imageSrc, setImageSrc] = useState(src);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {isLoading && showLoader && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )}
      
      <Image
        {...props}
        src={error ? fallbackSrc : imageSrc}
        alt={alt}
        className={cn(
          'transition-opacity duration-300',
          isLoading ? 'opacity-0' : 'opacity-100',
          className
        )}
        onLoad={() => setIsLoading(false)}
        onError={() => {
          setError(true);
          setImageSrc(fallbackSrc);
          setIsLoading(false);
        }}
      />
    </div>
  );
}

/**
 * Avatar Image Component
 * 
 * Optimized for user avatars with:
 * - Circular shape
 * - Fallback to initials
 * - Consistent sizing
 */
interface AvatarImageProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  fallbackInitials?: string;
  className?: string;
}

export function AvatarImage({
  src,
  alt,
  size = 'md',
  fallbackInitials,
  className,
}: AvatarImageProps) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
    xl: 'h-16 w-16 text-lg',
  };

  const sizePixels = {
    sm: 32,
    md: 40,
    lg: 48,
    xl: 64,
  };

  if (!src || error) {
    return (
      <div
        className={cn(
          'flex items-center justify-center rounded-full bg-primary text-primary-foreground font-medium',
          sizeClasses[size],
          className
        )}
      >
        {fallbackInitials || alt.charAt(0).toUpperCase()}
      </div>
    );
  }

  return (
    <div className={cn('relative rounded-full overflow-hidden', sizeClasses[size], className)}>
      <Image
        src={src}
        alt={alt}
        width={sizePixels[size]}
        height={sizePixels[size]}
        className="object-cover"
        onError={() => setError(true)}
      />
    </div>
  );
}

/**
 * Logo Image Component
 * 
 * Optimized for logos with:
 * - Consistent sizing
 * - Fallback to text
 */
interface LogoImageProps {
  src?: string | null;
  alt: string;
  size?: 'sm' | 'md' | 'lg';
  fallbackText?: string;
  className?: string;
}

export function LogoImage({
  src,
  alt,
  size = 'md',
  fallbackText,
  className,
}: LogoImageProps) {
  const [error, setError] = useState(false);

  const sizeClasses = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
  };

  if (!src || error) {
    return (
      <div className={cn('font-bold text-primary', sizeClasses[size], className)}>
        {fallbackText || alt}
      </div>
    );
  }

  return (
    <div className={cn('relative', sizeClasses[size], className)}>
      <Image
        src={src}
        alt={alt}
        width={200}
        height={50}
        className="h-full w-auto object-contain"
        onError={() => setError(true)}
      />
    </div>
  );
}


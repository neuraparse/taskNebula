'use client';

/**
 * <ViewTransition> wrapper.
 *
 * React 19 + Next 15 ship an experimental `<ViewTransition>` component (gated
 * behind `experimental.viewTransition` in next.config) that gives elements a
 * `view-transition-name` so the browser View Transitions API can morph them
 * across route changes (e.g. an issue card on the board → the issue detail
 * page header).
 *
 * The export name + import path have shifted across React 19 dev builds, so
 * we resolve it dynamically and fall back to a plain pass-through wrapper.
 * That keeps the call sites identical (`<ViewTransition name="...">{kid}`)
 * regardless of whether the underlying browser/runtime supports it.
 *
 * NOTE: this is intentionally tolerant — the API is still experimental and
 * the parent component should never be relied on for layout / behavior, only
 * for the morph hint.
 */
import * as React from 'react';

type ViewTransitionProps = {
  /** Unique view-transition-name. Shared across surfaces to morph between them. */
  name?: string;
  children: React.ReactNode;
};

// Best-effort lookup of the experimental React component without making
// TypeScript unhappy. If it isn't available we fall back to a Fragment.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactAny = React as any;
const ReactViewTransition: React.ComponentType<ViewTransitionProps> | undefined =
  ReactAny.unstable_ViewTransition ?? ReactAny.ViewTransition;

/**
 * Wrap a surface to opt it into a shared-element view transition. Pass the
 * same `name` on both ends of the navigation (e.g. issue card and issue
 * detail header) for the morph to chain.
 */
export function ViewTransition({ name, children }: ViewTransitionProps) {
  if (ReactViewTransition) {
    return <ReactViewTransition name={name}>{children}</ReactViewTransition>;
  }

  // Fallback: still set the CSS `view-transition-name` so projects that opt
  // in by way of CSS @view-transition rules continue to work in browsers
  // that support the API natively.
  if (name && React.isValidElement(children)) {
    const child = children as React.ReactElement<{ style?: React.CSSProperties }>;
    return React.cloneElement(child, {
      style: {
        ...(child.props.style ?? {}),
        // CSS property name as a string keeps TS happy without `as any`.
        ['viewTransitionName' as keyof React.CSSProperties]: name,
      },
    });
  }

  return <>{children}</>;
}

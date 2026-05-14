'use client';

/**
 * Client-side wrapper for swagger-ui-react.
 *
 * swagger-ui-react does not support SSR, so we render it via `next/dynamic`
 * with `ssr: false`. The CSS is imported here so it ships only with this
 * route's bundle.
 */

import dynamic from 'next/dynamic';
import 'swagger-ui-react/swagger-ui.css';

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => (
    <div className="p-6 text-sm text-muted-foreground">Loading API reference…</div>
  ),
});

export function ApiDocsClient({ specUrl }: { specUrl: string }) {
  return (
    <div className="swagger-ui-host">
      <SwaggerUI url={specUrl} docExpansion="list" defaultModelsExpandDepth={1} />
    </div>
  );
}

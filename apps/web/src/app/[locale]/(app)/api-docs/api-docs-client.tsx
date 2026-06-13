'use client';

/**
 * Client-side wrapper for swagger-ui-react.
 *
 * swagger-ui-react does not support SSR, so we render it via `next/dynamic`
 * with `ssr: false`. The CSS is imported here so it ships only with this
 * route's bundle.
 */

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import 'swagger-ui-react/swagger-ui.css';
// Scoped dark-theme overrides — must load after the base swagger CSS so the
// `.swagger-ui-host` rules win the cascade.
import './swagger-dark.css';

function SwaggerLoading() {
  const t = useTranslations('pagesWork');
  return <div className="text-muted-foreground p-6 text-sm">{t('apiDocs.loading')}</div>;
}

const SwaggerUI = dynamic(() => import('swagger-ui-react'), {
  ssr: false,
  loading: () => <SwaggerLoading />,
});

export function ApiDocsClient({ specUrl }: { specUrl: string }) {
  return (
    <div className="swagger-ui-host">
      <SwaggerUI url={specUrl} docExpansion="list" defaultModelsExpandDepth={1} />
    </div>
  );
}

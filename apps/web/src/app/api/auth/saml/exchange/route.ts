/**
 * SAML exchange landing — auto-submits the exchange token to the saml-bridge
 * Credentials provider via a tiny HTML form. We return HTML (not a 302)
 * because Auth.js Credentials sign-in needs a POST with a CSRF token.
 *
 * The page is intentionally minimal and never executes user-controlled
 * content. The browser sees:
 *   1. GET  /api/auth/saml/exchange?token=...&workspace=slug
 *   2. POST /api/auth/csrf  (fetched by the page script)
 *   3. POST /api/auth/callback/saml-bridge  (auto-submitted form)
 *
 * After Auth.js sets its session cookie the user lands on /dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getBaseUrl } from '@/lib/sso/saml';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeHtml(input: string): string {
  return input.replace(/[&<>"']/g, (ch) =>
    ch === '&'
      ? '&amp;'
      : ch === '<'
        ? '&lt;'
        : ch === '>'
          ? '&gt;'
          : ch === '"'
            ? '&quot;'
            : '&#39;'
  );
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  const workspace = url.searchParams.get('workspace') ?? '';
  if (!token) {
    return NextResponse.json(
      { error: 'Missing exchange token' },
      { status: 400 }
    );
  }
  const base = getBaseUrl();
  const safeToken = escapeHtml(token);
  const safeWorkspace = escapeHtml(workspace);
  const callbackUrl = `${base}/dashboard`;

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Signing you in…</title>
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
           display: flex; align-items: center; justify-content: center;
           min-height: 100vh; margin: 0; background: #0a0a0a; color: #f5f5f5; }
    .card { text-align: center; }
    .spinner { width: 32px; height: 32px; border: 3px solid #333;
               border-top-color: #fff; border-radius: 50%;
               animation: s 0.9s linear infinite; margin: 0 auto 12px; }
    @keyframes s { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <div>Signing you in to ${safeWorkspace}…</div>
  </div>
  <form id="f" method="POST" action="${base}/api/auth/callback/saml-bridge" style="display:none">
    <input type="hidden" name="token" value="${safeToken}" />
    <input type="hidden" name="callbackUrl" value="${callbackUrl}" />
    <input type="hidden" name="csrfToken" id="csrf" value="" />
    <input type="hidden" name="json" value="true" />
  </form>
  <script>
    (async function () {
      try {
        const r = await fetch('${base}/api/auth/csrf', { credentials: 'same-origin' });
        const { csrfToken } = await r.json();
        document.getElementById('csrf').value = csrfToken;
        document.getElementById('f').submit();
      } catch (e) {
        document.body.innerText = 'Sign-in failed — please try again.';
      }
    })();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

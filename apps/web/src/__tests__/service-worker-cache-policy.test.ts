import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('service worker cache policy', () => {
  const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8');

  it('does not precache the app shell or intercept mutating requests', () => {
    expect(source).toContain("const PRECACHE_URLS = ['/offline', '/manifest.json'];");
    expect(source).not.toContain("['/', '/offline'");
    expect(source).toContain("event.request.method !== 'GET'");
    expect(source).toContain('isNextInternalRequest(event.request.url)');
  });
});

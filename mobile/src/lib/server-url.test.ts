import { isSameBaseUrl, normalizeBaseUrl } from './server-url';

describe('self-hosted server URL normalization', () => {
  it('keeps explicit protocols and trims trailing slashes', () => {
    expect(normalizeBaseUrl('http://localhost:3000/')).toBe('http://localhost:3000');
    expect(normalizeBaseUrl('https://tasks.example.com/')).toBe('https://tasks.example.com');
  });

  it('reduces pasted app paths back to the self-hosted origin', () => {
    expect(normalizeBaseUrl('https://tasks.example.com/projects/TN/issues?filter=open#top')).toBe(
      'https://tasks.example.com',
    );
    expect(normalizeBaseUrl('localhost:3000/auth/signin')).toBe('http://localhost:3000');
  });

  it('defaults local and LAN hosts to HTTP for self-hosted development', () => {
    expect(normalizeBaseUrl('localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeBaseUrl('app.localhost:3000')).toBe('http://app.localhost:3000');
    expect(normalizeBaseUrl('10.0.2.2:3000')).toBe('http://10.0.2.2:3000');
    expect(normalizeBaseUrl('192.168.1.24:3000')).toBe('http://192.168.1.24:3000');
    expect(normalizeBaseUrl('172.16.0.10:3000')).toBe('http://172.16.0.10:3000');
  });

  it('defaults public hostnames to HTTPS', () => {
    expect(normalizeBaseUrl('tasks.example.com')).toBe('https://tasks.example.com');
  });

  it('rejects empty and invalid input', () => {
    expect(normalizeBaseUrl('')).toBeNull();
    expect(normalizeBaseUrl('http://')).toBeNull();
    expect(normalizeBaseUrl('ftp://tasks.example.com')).toBeNull();
    expect(normalizeBaseUrl('//tasks.example.com')).toBeNull();
  });

  it('compares normalized server URLs without treating missing input as equal', () => {
    expect(isSameBaseUrl('https://tasks.example.com/', 'tasks.example.com')).toBe(true);
    expect(isSameBaseUrl('localhost:3000', 'http://localhost:3000')).toBe(true);
    expect(isSameBaseUrl(null, null)).toBe(false);
    expect(isSameBaseUrl('https://tasks.example.com', 'https://other.example.com')).toBe(false);
  });
});

/**
 * @jest-environment node
 *
 * API-backed importer tests for current upstream contract behavior:
 * - Jira uses enhanced JQL search with nextPageToken pagination.
 * - GitHub follows the REST Link header and filters pull requests.
 */

import { githubImporter } from '../importers/github';
import { jiraImporter } from '../importers/jira';

function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
}

describe('jiraImporter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('uses enhanced JQL search and follows nextPageToken pagination', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          isLast: false,
          nextPageToken: 'next-token',
          issues: [
            {
              id: '10001',
              key: 'ENG-1',
              fields: { summary: 'First', status: { name: 'To Do' } },
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        jsonResponse({
          isLast: true,
          issues: [
            {
              id: '10002',
              key: 'ENG-2',
              fields: { summary: 'Second', status: { name: 'Done' } },
            },
          ],
        })
      );

    const records = await jiraImporter.parseSource({
      site: 'acme.atlassian.net',
      email: 'admin@example.com',
      apiToken: 'jira-token',
      maxResults: 50,
    });

    expect(records.map((record) => record.key)).toEqual(['ENG-1', 'ENG-2']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [firstUrl, firstInit] = fetchMock.mock.calls[0];
    expect(String(firstUrl)).toBe('https://acme.atlassian.net/rest/api/3/search/jql');
    expect(firstInit?.method).toBe('POST');
    expect(JSON.parse(String(firstInit?.body))).toMatchObject({
      fields: expect.arrayContaining(['summary', 'description', 'status']),
      jql: 'updated >= -90d ORDER BY updated DESC',
      maxResults: 50,
    });

    const [, secondInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(String(secondInit?.body))).toMatchObject({
      nextPageToken: 'next-token',
    });
  });
});

describe('githubImporter', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('follows Link pagination and skips pull requests returned by the issues endpoint', async () => {
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          [
            {
              number: 1,
              title: 'Issue one',
              body: 'Body',
              state: 'open',
              labels: [{ name: 'bug' }],
              assignee: null,
              milestone: null,
              created_at: '2026-01-01T00:00:00Z',
            },
            {
              number: 2,
              title: 'PR two',
              body: null,
              state: 'open',
              labels: [],
              assignee: null,
              milestone: null,
              created_at: '2026-01-02T00:00:00Z',
              pull_request: {},
            },
          ],
          {
            headers: {
              link: '<https://api.github.com/repos/acme/app/issues?page=2>; rel="next"',
            },
          }
        )
      )
      .mockResolvedValueOnce(
        jsonResponse([
          {
            number: 3,
            title: 'Issue three',
            body: null,
            state: 'closed',
            labels: ['enhancement'],
            assignee: null,
            milestone: null,
            created_at: '2026-01-03T00:00:00Z',
          },
        ])
      );

    const records = await githubImporter.parseSource({
      accessToken: 'ghp_token',
      owner: 'acme',
      repo: 'app',
      perPage: 50,
    });

    expect(records.map((record) => record.key)).toEqual(['#1', '#3']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, firstInit] = fetchMock.mock.calls[0];
    expect(firstInit?.headers).toMatchObject({
      Authorization: 'Bearer ghp_token',
      'X-GitHub-Api-Version': '2026-03-10',
    });
  });
});

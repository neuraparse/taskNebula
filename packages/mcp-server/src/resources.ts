/**
 * MCP resource definitions for TaskNebula.
 *
 * Resources expose read-only context the model can pull in. We define
 * four URI templates that map cleanly onto our REST API.
 */
import type { TaskNebulaClient } from './client.js';

export interface ResourceTemplateDefinition {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
  /** Resolve a concrete URI into a JSON payload via the REST API. */
  read: (uri: string, ctx: { client: TaskNebulaClient }) => Promise<unknown>;
}

export const resourceTemplates: ResourceTemplateDefinition[] = [
  {
    uriTemplate: 'tasknebula://issue/{id}',
    name: 'TaskNebula Issue',
    description: 'A single issue with comments, links, and history.',
    mimeType: 'application/json',
    async read(uri, { client }) {
      const id = parseId(uri, 'issue');
      return client.get(`/api/issues/${encodeURIComponent(id)}`);
    },
  },
  {
    uriTemplate: 'tasknebula://project/{id}',
    name: 'TaskNebula Project',
    description: 'A project with members, workflow, and recent activity.',
    mimeType: 'application/json',
    async read(uri, { client }) {
      const id = parseId(uri, 'project');
      return client.get(`/api/projects/${encodeURIComponent(id)}`);
    },
  },
  {
    uriTemplate: 'tasknebula://user/me',
    name: 'Current User',
    description: 'The authenticated user, including organization memberships.',
    mimeType: 'application/json',
    async read(_uri, { client }) {
      return client.get('/api/user/me');
    },
  },
  {
    uriTemplate: 'tasknebula://cycle/current',
    name: 'Current Sprint / Cycle',
    description: 'The active sprint/cycle across the user’s default project.',
    mimeType: 'application/json',
    async read(_uri, { client }) {
      return client.get('/api/sprints', { active: true });
    },
  },
];

function parseId(uri: string, kind: string): string {
  const prefix = `tasknebula://${kind}/`;
  if (!uri.startsWith(prefix)) {
    throw new Error(`Expected URI starting with ${prefix}, got ${uri}`);
  }
  const id = uri.slice(prefix.length);
  if (!id) throw new Error(`Missing id in URI ${uri}`);
  return id;
}

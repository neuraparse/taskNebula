import { type AnyToolDefinition, toAnyTool } from './types.js';
import { searchIssuesTool } from './search-issues.js';
import { getIssueTool } from './get-issue.js';
import { listMyAssignedTool } from './list-my-assigned.js';
import { createIssueTool } from './create-issue.js';
import { updateIssueTool } from './update-issue.js';
import { transitionStatusTool } from './transition-status.js';
import { assignIssueTool } from './assign-issue.js';
import { addCommentTool } from './add-comment.js';
import { linkPrTool } from './link-pr.js';
import { listProjectsTool } from './list-projects.js';
import { createSubtaskTool } from './create-subtask.js';
import { getMyWorkloadTool } from './get-my-workload.js';

/** Registry-ready list. Each entry is the erased form of a typed tool. */
export const allTools: AnyToolDefinition[] = [
  toAnyTool(searchIssuesTool),
  toAnyTool(getIssueTool),
  toAnyTool(listMyAssignedTool),
  toAnyTool(createIssueTool),
  toAnyTool(updateIssueTool),
  toAnyTool(transitionStatusTool),
  toAnyTool(assignIssueTool),
  toAnyTool(addCommentTool),
  toAnyTool(linkPrTool),
  toAnyTool(listProjectsTool),
  toAnyTool(createSubtaskTool),
  toAnyTool(getMyWorkloadTool),
];

export {
  searchIssuesTool,
  getIssueTool,
  listMyAssignedTool,
  createIssueTool,
  updateIssueTool,
  transitionStatusTool,
  assignIssueTool,
  addCommentTool,
  linkPrTool,
  listProjectsTool,
  createSubtaskTool,
  getMyWorkloadTool,
};

export * from './types.js';

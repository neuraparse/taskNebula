import { Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { agentExecutor } from '../lib/agents/executor';
import { AgentJobData } from '../lib/queue/agent-queue';
import {
  db,
  agentWorkspaces,
  agentSessions,
  agentExecutionProcesses,
  issues
} from '@tasknebula/db';
import { eq } from 'drizzle-orm';
import { createId } from '@paralleldrive/cuid2';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Create BullMQ worker
export const agentWorker = new Worker<AgentJobData>(
  'agent-execution',
  async (job: Job<AgentJobData>) => {
    console.log(`[AgentWorker] Processing job: ${job.name} (${job.id})`);

    try {
      const { type, data } = job.data;

      switch (type) {
        case 'agent-setup':
          return await handleAgentSetup(job, data);

        case 'agent-execute':
          return await handleAgentExecute(job, data);

        case 'git-operation':
          return await handleGitOperation(job, data);

        case 'cleanup':
          return await handleCleanup(job, data);

        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      console.error(`[AgentWorker] Job failed:`, error);
      throw error;
    }
  },
  {
    connection,
    concurrency: parseInt(process.env.MAX_CONCURRENT_AGENTS || '3'),
    limiter: {
      max: 10,
      duration: 1000,
    },
  }
);

// Job handlers

async function handleAgentSetup(job: Job, data: any) {
  await job.updateProgress(10);
  console.log(`[AgentWorker] Setting up workspace: ${data.workspaceId}`);

  // Update workspace status
  await db
    .update(agentWorkspaces)
    .set({
      status: 'setup_in_progress',
      updatedAt: new Date(),
    })
    .where(eq(agentWorkspaces.id, data.workspaceId));

  // TODO: Initialize workspace, install dependencies, etc.
  await job.updateProgress(50);

  // Mark setup as complete
  await db
    .update(agentWorkspaces)
    .set({
      status: 'ready',
      setupCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentWorkspaces.id, data.workspaceId));

  await job.updateProgress(100);

  return {
    status: 'setup_complete',
    workspaceId: data.workspaceId,
  };
}

async function handleAgentExecute(job: Job, data: any) {
  await job.updateProgress(10);
  console.log(`[AgentWorker] Executing agent for issue: ${data.issueId}`);

  // Fetch issue details from database
  const issue = await db.query.issues.findFirst({
    where: eq(issues.id, data.issueId),
    with: { project: true },
  });

  if (!issue) {
    throw new Error(`Issue not found: ${data.issueId}`);
  }

  // Fetch session details
  const session = await db.query.agentSessions.findFirst({
    where: eq(agentSessions.id, data.sessionId),
    with: { workspace: true },
  });

  if (!session) {
    throw new Error(`Session not found: ${data.sessionId}`);
  }

  // Create execution process record
  const executionProcessId = createId();
  await db.insert(agentExecutionProcesses).values({
    id: executionProcessId,
    sessionId: data.sessionId,
    workspaceId: data.workspaceId,
    runReason: 'initial_prompt',
    status: 'running',
  });

  const context = {
    workspaceId: data.workspaceId,
    issueId: data.issueId,
    issueKey: issue.key,
    issueTitle: issue.title,
    issueDescription: issue.description || '',
    projectId: 'project-id',
    executorProfile: data.executorProfile,
    executorVariant: data.executorVariant,
    initialPrompt: data.initialPrompt,
  };

  await job.updateProgress(30);

  const result = await agentExecutor.execute(context);

  await job.updateProgress(90);

  if (!result.success) {
    // Mark execution as failed
    await db
      .update(agentExecutionProcesses)
      .set({
        status: 'failed',
        exitCode: result.exitCode || 1,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentExecutionProcesses.id, executionProcessId));

    throw new Error(result.error || 'Execution failed');
  }

  // Mark execution as completed
  await db
    .update(agentExecutionProcesses)
    .set({
      status: 'completed',
      exitCode: 0,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(agentExecutionProcesses.id, executionProcessId));

  await job.updateProgress(100);

  return {
    status: 'execution_complete',
    executionProcessId,
    containerId: result.containerId,
    branchName: result.branchName,
    commitSha: result.commitSha,
    logs: result.logs,
  };
}

async function handleGitOperation(job: Job, data: any) {
  await job.updateProgress(50);
  console.log(`[AgentWorker] Git operation: ${data.operation}`);

  // TODO: Implement git operations (commit, push, PR creation)
  await job.updateProgress(100);

  return {
    status: 'git_operation_complete',
    operation: data.operation,
  };
}

async function handleCleanup(job: Job, data: any) {
  console.log(`[AgentWorker] Cleaning up workspace: ${data.workspaceId}`);

  await agentExecutor.cleanup(data.workspaceId);

  return {
    status: 'cleanup_complete',
    workspaceId: data.workspaceId,
  };
}

// Worker event listeners

agentWorker.on('completed', (job) => {
  console.log(`[AgentWorker] Job completed: ${job.id}`);
});

agentWorker.on('failed', (job, err) => {
  console.error(`[AgentWorker] Job failed: ${job?.id}`, err);
});

agentWorker.on('progress', (job, progress) => {
  console.log(`[AgentWorker] Job progress: ${job.id} - ${progress}%`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[AgentWorker] Shutting down gracefully...');
  await agentWorker.close();
  await connection.quit();
  process.exit(0);
});

console.log('[AgentWorker] Worker started and listening for jobs...');

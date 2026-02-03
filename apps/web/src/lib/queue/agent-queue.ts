import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection
const connection = new Redis(REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

// Job data types
export interface AgentSetupJobData {
  workspaceId: string;
  issueId: string;
  projectId: string;
  branchName: string;
}

export interface AgentExecuteJobData {
  sessionId: string;
  workspaceId: string;
  issueId: string;
  executorProfile: string;
  executorVariant?: string;
  initialPrompt: string;
}

export interface GitOperationJobData {
  workspaceId: string;
  operation: 'commit' | 'push' | 'create-pr';
  message?: string;
  prTitle?: string;
  prBody?: string;
}

export interface CleanupJobData {
  workspaceId: string;
  containerId?: string;
}

export type AgentJobData =
  | { type: 'agent-setup'; data: AgentSetupJobData }
  | { type: 'agent-execute'; data: AgentExecuteJobData }
  | { type: 'git-operation'; data: GitOperationJobData }
  | { type: 'cleanup'; data: CleanupJobData };

// Agent Queue
export const agentQueue = new Queue<AgentJobData>('agent-execution', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      age: 7 * 24 * 60 * 60, // Keep completed jobs for 7 days
      count: 1000, // Keep last 1000 completed jobs
    },
    removeOnFail: {
      age: 30 * 24 * 60 * 60, // Keep failed jobs for 30 days
    },
  },
});

// Queue Events for monitoring
export const agentQueueEvents = new QueueEvents('agent-execution', {
  connection,
});

// Helper functions for adding jobs
export async function addAgentSetupJob(data: AgentSetupJobData) {
  return agentQueue.add('agent-setup', { type: 'agent-setup', data }, {
    jobId: `setup-${data.workspaceId}`,
    priority: 1, // High priority for setup
  });
}

export async function addAgentExecuteJob(data: AgentExecuteJobData) {
  return agentQueue.add('agent-execute', { type: 'agent-execute', data }, {
    jobId: `execute-${data.sessionId}-${Date.now()}`,
    priority: 2,
  });
}

export async function addGitOperationJob(data: GitOperationJobData) {
  return agentQueue.add('git-operation', { type: 'git-operation', data }, {
    jobId: `git-${data.operation}-${data.workspaceId}-${Date.now()}`,
    priority: 3,
  });
}

export async function addCleanupJob(data: CleanupJobData) {
  return agentQueue.add('cleanup', { type: 'cleanup', data }, {
    jobId: `cleanup-${data.workspaceId}`,
    priority: 10, // Lower priority for cleanup
    delay: 60000, // Delay 1 minute before cleanup
  });
}

// Get job status
export async function getJobStatus(jobId: string) {
  const job = await agentQueue.getJob(jobId);
  if (!job) return null;

  return {
    id: job.id,
    name: job.name,
    data: job.data,
    progress: await job.getState(),
    returnvalue: job.returnvalue,
    failedReason: job.failedReason,
    timestamp: job.timestamp,
    finishedOn: job.finishedOn,
    processedOn: job.processedOn,
  };
}

// Pause/Resume queue
export async function pauseQueue() {
  await agentQueue.pause();
}

export async function resumeQueue() {
  await agentQueue.resume();
}

// Get queue metrics
export async function getQueueMetrics() {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    agentQueue.getWaitingCount(),
    agentQueue.getActiveCount(),
    agentQueue.getCompletedCount(),
    agentQueue.getFailedCount(),
    agentQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    total: waiting + active + completed + failed + delayed,
  };
}

// Graceful shutdown
export async function closeQueue() {
  await agentQueue.close();
  await agentQueueEvents.close();
  await connection.quit();
}

// Event listeners for logging
agentQueueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[AgentQueue] Job ${jobId} completed:`, returnvalue);
});

agentQueueEvents.on('failed', ({ jobId, failedReason }) => {
  console.error(`[AgentQueue] Job ${jobId} failed:`, failedReason);
});

agentQueueEvents.on('progress', ({ jobId, data }) => {
  console.log(`[AgentQueue] Job ${jobId} progress:`, data);
});

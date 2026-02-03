import { create } from 'zustand';

export interface AgentExecutionState {
  id: string;
  issueId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  executorProfile: string;
  startedAt: Date;
}

interface AgentExecutionStore {
  executions: Map<string, AgentExecutionState>;
  activeExecutionId: string | null;

  // Actions
  addExecution: (execution: AgentExecutionState) => void;
  updateExecution: (id: string, updates: Partial<AgentExecutionState>) => void;
  removeExecution: (id: string) => void;
  setActiveExecution: (id: string | null) => void;
  getExecution: (id: string) => AgentExecutionState | undefined;
  getExecutionsByIssue: (issueId: string) => AgentExecutionState[];
}

export const useAgentExecutionStore = create<AgentExecutionStore>((set, get) => ({
  executions: new Map(),
  activeExecutionId: null,

  addExecution: (execution) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.set(execution.id, execution);
      return { executions: newExecutions };
    }),

  updateExecution: (id, updates) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      const existing = newExecutions.get(id);
      if (existing) {
        newExecutions.set(id, { ...existing, ...updates });
      }
      return { executions: newExecutions };
    }),

  removeExecution: (id) =>
    set((state) => {
      const newExecutions = new Map(state.executions);
      newExecutions.delete(id);
      return {
        executions: newExecutions,
        activeExecutionId: state.activeExecutionId === id ? null : state.activeExecutionId,
      };
    }),

  setActiveExecution: (id) => set({ activeExecutionId: id }),

  getExecution: (id) => get().executions.get(id),

  getExecutionsByIssue: (issueId) =>
    Array.from(get().executions.values()).filter((e) => e.issueId === issueId),
}));

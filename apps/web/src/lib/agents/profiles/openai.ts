import { ExecutorProfile } from './claude';

export const openaiProfiles: ExecutorProfile[] = [
  {
    executor: 'OPENAI',
    variant: 'O1',
    displayName: 'OpenAI o1',
    description: 'OpenAI o1 - Advanced reasoning for complex problem solving',
    baseCommand: 'node',
    extraParams: ['-e', 'require("./openai-agent.js")'],
    envVars: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL: 'o1-preview',
    },
  },
  {
    executor: 'OPENAI',
    variant: 'GPT4',
    displayName: 'OpenAI GPT-4 Turbo',
    description: 'GPT-4 Turbo - Fast and capable for general coding tasks',
    baseCommand: 'node',
    extraParams: ['-e', 'require("./openai-agent.js")'],
    envVars: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL: 'gpt-4-turbo-preview',
    },
  },
  {
    executor: 'OPENAI',
    variant: 'GPT4O',
    displayName: 'OpenAI GPT-4o',
    description: 'GPT-4o - Multimodal with vision capabilities',
    baseCommand: 'node',
    extraParams: ['-e', 'require("./openai-agent.js")'],
    envVars: {
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL: 'gpt-4o',
    },
  },
];

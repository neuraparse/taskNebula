import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createLLMClient, PROMPTS } from '@tasknebula/llm';
import { z } from 'zod';

const requestSchema = z.object({
  description: z.string().min(10, 'Description must be at least 10 characters'),
  projectId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { description, projectId } = requestSchema.parse(body);

    // Create LLM client
    const llmClient = createLLMClient({
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.7,
      maxTokens: 1000,
    });

    // Generate issue structure from description
    const messages = PROMPTS.generateIssue(description);
    const response = await llmClient.chat(messages);

    // Parse the AI response
    let issueData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        issueData = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: create a basic structure
        issueData = {
          title: description.slice(0, 100),
          description: description,
          type: 'task',
          priority: 'medium',
          estimate: 'M',
          labels: [],
        };
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Fallback structure
      issueData = {
        title: description.slice(0, 100),
        description: description,
        type: 'task',
        priority: 'medium',
        estimate: 'M',
        labels: [],
      };
    }

    return NextResponse.json({
      issue: {
        ...issueData,
        projectId,
      },
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error generating issue:', error);
    return NextResponse.json(
      { error: 'Failed to generate issue' },
      { status: 500 }
    );
  }
}


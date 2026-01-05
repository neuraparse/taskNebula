import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { createLLMClient, PROMPTS } from '@tasknebula/llm';
import { getIssueComments } from '@tasknebula/db';
import { z } from 'zod';

const requestSchema = z.object({
  issueId: z.string(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { issueId } = requestSchema.parse(body);

    // Fetch comments for the issue
    const comments = await getIssueComments(issueId);

    if (comments.length === 0) {
      return NextResponse.json(
        { error: 'No comments to summarize' },
        { status: 400 }
      );
    }

    // Format comments for AI
    const commentTexts = comments.map(
      (comment: { author: { name?: string | null; email?: string | null }; content: string }) =>
        `${comment.author.name || comment.author.email}: ${comment.content}`
    );

    // Create LLM client
    const llmClient = createLLMClient({
      provider: 'openai',
      model: 'gpt-4o-mini',
      temperature: 0.5,
      maxTokens: 500,
    });

    // Generate summary
    const messages = PROMPTS.summarizeThread(commentTexts);
    const response = await llmClient.chat(messages);

    return NextResponse.json({
      summary: response.content,
      commentCount: comments.length,
      usage: response.usage,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.errors },
        { status: 400 }
      );
    }

    console.error('Error summarizing thread:', error);
    return NextResponse.json(
      { error: 'Failed to summarize thread' },
      { status: 500 }
    );
  }
}


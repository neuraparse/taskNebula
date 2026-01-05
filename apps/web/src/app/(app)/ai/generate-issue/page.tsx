'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ArrowRight, Copy, Check, Loader2 } from 'lucide-react';
import { useGenerateIssue } from '@/lib/hooks/use-ai';
import { useCreateIssue } from '@/lib/hooks/use-issues';
import { useRouter } from 'next/navigation';

export default function GenerateIssuePage() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [generatedIssue, setGeneratedIssue] = useState<{
    title: string;
    description: string;
    type: string;
    priority: string;
    estimate?: string;
    labels?: string[];
    projectId?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateIssue = useGenerateIssue();
  const createIssue = useCreateIssue();

  const handleGenerate = async () => {
    setError(null);
    try {
      const result = await generateIssue.mutateAsync({ description });
      setGeneratedIssue(result.issue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate issue');
    }
  };

  const handleCreateIssue = async () => {
    if (!generatedIssue) return;

    try {
      const created = await createIssue.mutateAsync({
        title: generatedIssue.title,
        description: generatedIssue.description,
        type: generatedIssue.type,
        priority: generatedIssue.priority,
        status: 'backlog',
        projectId: generatedIssue.projectId || '', // You might want to add project selection
      });

      // Navigate to the created issue
      router.push(`/issues/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create issue');
    }
  };

  const handleCopy = () => {
    if (generatedIssue) {
      navigator.clipboard.writeText(JSON.stringify(generatedIssue, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Generate Issue from Description</h1>
        <p className="text-muted-foreground">
          Describe your feature or bug in plain text, and AI will create a structured ticket
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Section */}
        <Card>
          <CardHeader>
            <CardTitle>Describe Your Issue</CardTitle>
            <CardDescription>
              Write a natural language description of what you want to build or fix
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                className="min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder="Example: We need to add user authentication to our app. Users should be able to sign in with Google or GitHub. We also need to protect certain routes and manage user sessions securely."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            
            {error && (
              <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}

            <Button
              onClick={handleGenerate}
              disabled={!description.trim() || generateIssue.isPending}
              className="w-full"
            >
              {generateIssue.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating with AI...
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Generate Issue with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Output Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Generated Issue</CardTitle>
              {generatedIssue && (
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy
                    </>
                  )}
                </Button>
              )}
            </div>
            <CardDescription>AI-generated structured issue</CardDescription>
          </CardHeader>
          <CardContent>
            {!generatedIssue ? (
              <div className="flex min-h-[200px] items-center justify-center rounded-lg border-2 border-dashed">
                <div className="text-center">
                  <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Generated issue will appear here
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Title</label>
                  <p className="mt-1 font-medium">{generatedIssue.title}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Description</label>
                  <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm">
                    <pre className="whitespace-pre-wrap font-sans">{generatedIssue.description}</pre>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Type</label>
                    <p className="mt-1">
                      <Badge>{generatedIssue.type}</Badge>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Priority</label>
                    <p className="mt-1">
                      <Badge variant="destructive">{generatedIssue.priority}</Badge>
                    </p>
                  </div>
                </div>
                
                {generatedIssue.labels && generatedIssue.labels.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Labels</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {generatedIssue.labels.map((label: string) => (
                        <Badge key={label} variant="secondary">
                          {label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  className="w-full"
                  onClick={handleCreateIssue}
                  disabled={createIssue.isPending}
                >
                  {createIssue.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      Create Issue
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}


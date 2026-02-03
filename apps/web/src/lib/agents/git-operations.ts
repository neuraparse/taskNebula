import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface GitConfig {
  repositoryPath: string;
  branchName: string;
  userEmail?: string;
  userName?: string;
}

export interface CommitResult {
  sha: string;
  message: string;
}

export interface PushResult {
  pushed: boolean;
  remote: string;
  branch: string;
}

export class GitOperations {
  private readonly DEFAULT_USER_EMAIL = 'agent@tasknebula.io';
  private readonly DEFAULT_USER_NAME = 'TaskNebula Agent';

  /**
   * Clone repository from GitHub
   */
  async cloneRepository(cloneUrl: string, repositoryPath: string, accessToken?: string): Promise<void> {
    try {
      // Build authenticated clone URL for private repos
      let authCloneUrl = cloneUrl;
      if (accessToken && cloneUrl.includes('github.com')) {
        authCloneUrl = cloneUrl.replace('https://github.com/', `https://x-access-token:${accessToken}@github.com/`);
      } else if (accessToken && cloneUrl.includes('gitlab.com')) {
        authCloneUrl = cloneUrl.replace('https://gitlab.com/', `https://oauth2:${accessToken}@gitlab.com/`);
      }

      // Clone with depth 1 for faster clone
      await execAsync(`git clone --depth 1 ${authCloneUrl} ${repositoryPath}`);

      // Configure git
      await this.execGit(repositoryPath, `config user.email "${this.DEFAULT_USER_EMAIL}"`);
      await this.execGit(repositoryPath, `config user.name "${this.DEFAULT_USER_NAME}"`);

      console.log(`[GitOps] Cloned repository to: ${repositoryPath}`);
    } catch (error) {
      console.error('[GitOps] Failed to clone repository:', error);
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async createBranch(config: GitConfig): Promise<string> {
    const { repositoryPath, branchName } = config;

    try {
      // Ensure we're on main/master
      await this.execGit(repositoryPath, 'checkout main || git checkout master');

      // Pull latest
      await this.execGit(repositoryPath, 'pull origin $(git rev-parse --abbrev-ref HEAD)');

      // Create and checkout new branch
      await this.execGit(repositoryPath, `checkout -b ${branchName}`);

      console.log(`[GitOps] Created branch: ${branchName}`);
      return branchName;
    } catch (error) {
      console.error('[GitOps] Failed to create branch:', error);
      throw new Error(`Failed to create branch: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async commitChanges(config: GitConfig, message: string, files?: string[]): Promise<CommitResult> {
    const { repositoryPath, userEmail, userName } = config;

    try {
      // Configure git user
      await this.execGit(repositoryPath, `config user.email "${userEmail || this.DEFAULT_USER_EMAIL}"`);
      await this.execGit(repositoryPath, `config user.name "${userName || this.DEFAULT_USER_NAME}"`);

      // Stage files
      if (files && files.length > 0) {
        await this.execGit(repositoryPath, `add ${files.join(' ')}`);
      } else {
        await this.execGit(repositoryPath, 'add .');
      }

      // Commit
      const escapedMessage = message.replace(/"/g, '\\"');
      await this.execGit(repositoryPath, `commit -m "${escapedMessage}"`);

      // Get commit SHA
      const { stdout: sha } = await this.execGit(repositoryPath, 'rev-parse HEAD');

      console.log(`[GitOps] Committed changes: ${sha.trim()}`);
      return {
        sha: sha.trim(),
        message,
      };
    } catch (error) {
      console.error('[GitOps] Failed to commit:', error);
      throw new Error(`Failed to commit: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async pushBranch(config: GitConfig, force = false): Promise<PushResult> {
    const { repositoryPath, branchName } = config;

    try {
      // Get remote name (usually 'origin')
      const { stdout: remoteOutput } = await this.execGit(repositoryPath, 'remote');
      const remote = remoteOutput.trim().split('\n')[0] || 'origin';

      // Push branch
      const pushCommand = force
        ? `push --force ${remote} ${branchName}`
        : `push -u ${remote} ${branchName}`;
      await this.execGit(repositoryPath, pushCommand);

      console.log(`[GitOps] Pushed branch: ${branchName} to ${remote}`);
      return {
        pushed: true,
        remote,
        branch: branchName,
      };
    } catch (error) {
      console.error('[GitOps] Failed to push:', error);
      throw new Error(`Failed to push: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async getChangedFiles(repositoryPath: string): Promise<string[]> {
    try {
      const { stdout } = await this.execGit(repositoryPath, 'diff --name-only');
      return stdout.trim().split('\n').filter((f) => f);
    } catch (error) {
      console.error('[GitOps] Failed to get changed files:', error);
      return [];
    }
  }

  async getBranchStatus(repositoryPath: string): Promise<{
    branch: string;
    ahead: number;
    behind: number;
    clean: boolean;
  }> {
    try {
      const { stdout: branchOutput } = await this.execGit(repositoryPath, 'rev-parse --abbrev-ref HEAD');
      const branch = branchOutput.trim();

      const { stdout: statusOutput } = await this.execGit(repositoryPath, 'status --porcelain');
      const clean = statusOutput.trim() === '';

      // Get ahead/behind count
      let ahead = 0;
      let behind = 0;
      try {
        const { stdout: revOutput } = await this.execGit(
          repositoryPath,
          `rev-list --left-right --count origin/${branch}...${branch}`
        );
        const [behindStr, aheadStr] = revOutput.trim().split('\t');
        ahead = parseInt(aheadStr) || 0;
        behind = parseInt(behindStr) || 0;
      } catch {
        // Branch might not have upstream yet
      }

      return { branch, ahead, behind, clean };
    } catch (error) {
      console.error('[GitOps] Failed to get status:', error);
      throw error;
    }
  }

  async deleteBranch(repositoryPath: string, branchName: string, force = false): Promise<void> {
    try {
      // Switch to main first
      await this.execGit(repositoryPath, 'checkout main || git checkout master');

      // Delete branch
      const deleteFlag = force ? '-D' : '-d';
      await this.execGit(repositoryPath, `branch ${deleteFlag} ${branchName}`);

      console.log(`[GitOps] Deleted branch: ${branchName}`);
    } catch (error) {
      console.error('[GitOps] Failed to delete branch:', error);
      throw error;
    }
  }

  private async execGit(repositoryPath: string, command: string) {
    try {
      return await execAsync(`git ${command}`, { cwd: repositoryPath });
    } catch (error: any) {
      throw new Error(error.stderr || error.message);
    }
  }
}

export const gitOperations = new GitOperations();

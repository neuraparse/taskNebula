import Docker from 'dockerode';

const docker = new Docker({
  socketPath: process.env.DOCKER_SOCKET_PATH || '/var/run/docker.sock',
});

export interface ContainerConfig {
  workspaceId: string;
  projectId: string;
  issueId: string;
  repositoryPath?: string;
  environmentVariables?: Record<string, string>;
}

export interface ContainerExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export class DockerManager {
  private readonly IMAGE = 'node:22-alpine';
  private readonly WORKSPACE_BASE = process.env.AGENT_WORKSPACE_DIR || '/tmp/agent-workspaces';
  private readonly MAX_MEMORY = '2g';
  private readonly MAX_CPU = 1;

  async createContainer(config: ContainerConfig): Promise<Docker.Container> {
    const containerName = `tasknebula-agent-${config.workspaceId}`;

    try {
      await this.ensureImage();

      const container = await docker.createContainer({
        name: containerName,
        Image: this.IMAGE,
        Cmd: ['/bin/sh', '-c', 'tail -f /dev/null'],
        WorkingDir: '/workspace',
        Env: this.buildEnvironmentVariables(config.environmentVariables),
        HostConfig: {
          Binds: config.repositoryPath ? [`${config.repositoryPath}:/workspace:rw`] : undefined,
          Memory: this.parseMemory(this.MAX_MEMORY),
          NanoCpus: this.MAX_CPU * 1e9,
          NetworkMode: 'bridge',
          AutoRemove: false,
        },
        Labels: {
          'tasknebula.workspace': config.workspaceId,
          'tasknebula.project': config.projectId,
          'tasknebula.issue': config.issueId,
          'tasknebula.type': 'agent-execution',
        },
      });

      await container.start();
      console.log(`[DockerManager] Created container: ${containerName}`);
      return container;
    } catch (error) {
      console.error('[DockerManager] Failed to create container:', error);
      throw new Error(`Failed to create container: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  }

  async executeCommand(container: Docker.Container, command: string[], onLog?: (log: string) => void): Promise<ContainerExecResult> {
    try {
      const exec = await container.exec({ Cmd: command, AttachStdout: true, AttachStderr: true });

      return new Promise((resolve, reject) => {
        exec.start({ hijack: true, stdin: false }, (err, stream) => {
          if (err) return reject(err);
          if (!stream) return reject(new Error('No stream'));

          let stdout = '';
          let stderr = '';

          docker.modem.demuxStream(stream, {
            write: (chunk: Buffer) => {
              const text = chunk.toString();
              stdout += text;
              onLog?.(text);
            },
          } as any, {
            write: (chunk: Buffer) => {
              const text = chunk.toString();
              stderr += text;
              onLog?.(text);
            },
          } as any);

          stream.on('end', async () => {
            const inspect = await exec.inspect();
            resolve({ exitCode: inspect.ExitCode || 0, stdout, stderr });
          });

          stream.on('error', reject);
        });
      });
    } catch (error) {
      console.error('[DockerManager] Command execution failed:', error);
      throw error;
    }
  }

  async stopContainer(container: Docker.Container): Promise<void> {
    try {
      await container.stop({ t: 10 });
      console.log('[DockerManager] Container stopped');
    } catch (error: any) {
      if (!error.message?.includes('is not running')) throw error;
    }
  }

  async removeContainer(container: Docker.Container): Promise<void> {
    try {
      await container.remove({ force: true });
      console.log('[DockerManager] Container removed');
    } catch (error: any) {
      if (!error.message?.includes('No such container')) throw error;
    }
  }

  async getContainerByWorkspace(workspaceId: string): Promise<Docker.Container | null> {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: { label: [`tasknebula.workspace=${workspaceId}`] },
      });
      if (containers.length === 0) return null;
      return docker.getContainer(containers[0].Id);
    } catch (error) {
      console.error('[DockerManager] Failed to get container:', error);
      return null;
    }
  }

  private async ensureImage(): Promise<void> {
    try {
      await docker.getImage(this.IMAGE).inspect();
    } catch {
      console.log(`[DockerManager] Pulling image: ${this.IMAGE}`);
      await new Promise((resolve, reject) => {
        docker.pull(this.IMAGE, (err: any, stream: any) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, (err: any) => (err ? reject(err) : resolve(null)));
        });
      });
    }
  }

  private buildEnvironmentVariables(custom?: Record<string, string>): string[] {
    const defaults = { NODE_ENV: 'production', PATH: '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin' };
    const merged = { ...defaults, ...custom };
    return Object.entries(merged).map(([key, value]) => `${key}=${value}`);
  }

  private parseMemory(memory: string): number {
    const units: Record<string, number> = { b: 1, k: 1024, m: 1024 * 1024, g: 1024 * 1024 * 1024 };
    const match = memory.match(/^(\d+)([bkmg]?)$/i);
    if (!match) return 2 * 1024 * 1024 * 1024;
    const value = parseInt(match[1]);
    const unit = (match[2] || 'b').toLowerCase();
    return value * (units[unit] || 1);
  }
}

export const dockerManager = new DockerManager();

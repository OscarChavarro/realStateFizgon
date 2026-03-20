import { Injectable } from '@nestjs/common';
import { ChildProcess, spawn, spawnSync } from 'node:child_process';
import { accessSync } from 'node:fs';

import type {
  OperatingSystemProcessControlPort,
  OperatingSystemSpawnedProcess,
  OperatingSystemSpawnOptions,
  OperatingSystemSpawnSyncOptions,
  OperatingSystemSpawnSyncResult
} from 'ports/outbound/operating-system/operating-system-process-control.port';

class ChildProcessAdapter implements OperatingSystemSpawnedProcess {
  constructor(private readonly childProcess: ChildProcess) {}

  get pid(): number | undefined {
    return this.childProcess.pid;
  }

  get killed(): boolean | undefined {
    return this.childProcess.killed;
  }

  once(event: 'spawn', listener: () => void): OperatingSystemSpawnedProcess;
  once(event: 'error', listener: (error: Error) => void): OperatingSystemSpawnedProcess;
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): OperatingSystemSpawnedProcess;
  once(
    event: 'spawn' | 'error' | 'exit',
    listener:
      | (() => void)
      | ((error: Error) => void)
      | ((code: number | null, signal: NodeJS.Signals | null) => void)
  ): OperatingSystemSpawnedProcess {
    this.childProcess.once(event, listener as (...args: unknown[]) => void);
    return this;
  }

  kill(signal?: NodeJS.Signals): void {
    this.childProcess.kill(signal);
  }
}

@Injectable()
export class OperatingSystemProcessControlService implements OperatingSystemProcessControlPort {
  spawn(
    command: string,
    args: string[],
    options: OperatingSystemSpawnOptions
  ): OperatingSystemSpawnedProcess {
    return new ChildProcessAdapter(
      spawn(command, args, { stdio: options.stdio })
    );
  }

  spawnSync(
    command: string,
    args: string[],
    options?: OperatingSystemSpawnSyncOptions
  ): OperatingSystemSpawnSyncResult {
    const result = spawnSync(command, args, options);

    return {
      status: result.status ?? null,
      stdout: this.normalizeSyncOutput(result.stdout),
      stderr: this.normalizeSyncOutput(result.stderr)
    };
  }

  canAccessPath(path: string): boolean {
    try {
      accessSync(path);
      return true;
    } catch {
      return false;
    }
  }

  isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  killPid(pid: number, signal: NodeJS.Signals): void {
    process.kill(pid, signal);
  }

  private normalizeSyncOutput(value: string | Buffer | null | undefined): string {
    if (typeof value === 'string') {
      return value;
    }

    if (Buffer.isBuffer(value)) {
      return value.toString('utf8');
    }

    return '';
  }
}

export type OperatingSystemSpawnedProcess = {
  readonly pid?: number;
  readonly killed?: boolean;
  once(event: 'spawn', listener: () => void): OperatingSystemSpawnedProcess;
  once(event: 'error', listener: (error: Error) => void): OperatingSystemSpawnedProcess;
  once(
    event: 'exit',
    listener: (code: number | null, signal: NodeJS.Signals | null) => void
  ): OperatingSystemSpawnedProcess;
  kill(signal?: NodeJS.Signals): void;
};

export type OperatingSystemSpawnOptions = {
  stdio: ['ignore', number, number];
};

export type OperatingSystemSpawnSyncOptions = {
  encoding?: BufferEncoding;
  stdio?: 'ignore';
};

export type OperatingSystemSpawnSyncResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

export interface OperatingSystemProcessControlPort {
  spawn(
    command: string,
    args: string[],
    options: OperatingSystemSpawnOptions
  ): OperatingSystemSpawnedProcess;
  spawnSync(
    command: string,
    args: string[],
    options?: OperatingSystemSpawnSyncOptions
  ): OperatingSystemSpawnSyncResult;
  canAccessPath(path: string): boolean;
  isPidAlive(pid: number): boolean;
  killPid(pid: number, signal: NodeJS.Signals): void;
}

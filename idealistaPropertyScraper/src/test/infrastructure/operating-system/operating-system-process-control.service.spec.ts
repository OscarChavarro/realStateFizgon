import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { accessSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { OperatingSystemProcessControlService } from 'infrastructure/operating-system/operating-system-process-control.service';

jest.mock('node:child_process', () => ({
  spawn: jest.fn(),
  spawnSync: jest.fn()
}));

jest.mock('node:fs', () => ({
  accessSync: jest.fn()
}));

describe('OperatingSystemProcessControlService', () => {
  let service: OperatingSystemProcessControlService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new OperatingSystemProcessControlService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('whenSpawnIsCalled_spawn_shouldDelegateToNodeChildProcess', () => {
    // Arrange
    const childProcess = {
      pid: 1234,
      killed: false,
      once: jest.fn(),
      kill: jest.fn()
    };
    (spawn as unknown as jest.Mock).mockReturnValue(childProcess);
    // Action
    const result = service.spawn('/usr/bin/chromium', ['--headless=new'], {
      stdio: ['ignore', 10, 11]
    });
    result.once('spawn', () => undefined);
    result.kill('SIGTERM');
    // Assert
    expect(spawn).toHaveBeenCalledWith('/usr/bin/chromium', ['--headless=new'], {
      stdio: ['ignore', 10, 11]
    });
    expect(result.pid).toBe(1234);
    expect(result.killed).toBe(false);
    expect(childProcess.once).toHaveBeenCalledWith('spawn', expect.any(Function));
    expect(childProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('whenSpawnSyncReturnsBuffers_spawnSync_shouldNormalizeOutput', () => {
    // Arrange
    (spawnSync as unknown as jest.Mock).mockReturnValue({
      status: 0,
      stdout: Buffer.from('stdout-buffer'),
      stderr: Buffer.from('stderr-buffer')
    });
    // Action
    const result = service.spawnSync('chromium', ['--version'], { encoding: 'utf8' });
    // Assert
    expect(result).toEqual({
      status: 0,
      stdout: 'stdout-buffer',
      stderr: 'stderr-buffer'
    });
  });

  it('whenSpawnSyncReturnsStrings_spawnSync_shouldKeepStringOutput', () => {
    // Arrange
    (spawnSync as unknown as jest.Mock).mockReturnValue({
      status: 0,
      stdout: 'stdout-string',
      stderr: 'stderr-string'
    });
    // Action
    const result = service.spawnSync('chromium', ['--version'], { encoding: 'utf8' });
    // Assert
    expect(result).toEqual({
      status: 0,
      stdout: 'stdout-string',
      stderr: 'stderr-string'
    });
  });

  it('whenSpawnSyncReturnsNullFields_spawnSync_shouldReturnEmptyStringsAndNullStatus', () => {
    // Arrange
    (spawnSync as unknown as jest.Mock).mockReturnValue({
      status: undefined,
      stdout: undefined,
      stderr: null
    });
    // Action
    const result = service.spawnSync('chromium', ['--version']);
    // Assert
    expect(result).toEqual({
      status: null,
      stdout: '',
      stderr: ''
    });
  });

  it('whenPathIsAccessible_canAccessPath_shouldReturnTrue', () => {
    // Arrange
    (accessSync as unknown as jest.Mock).mockImplementation(() => undefined);
    // Action
    const result = service.canAccessPath('/usr/bin/chromium');
    // Assert
    expect(result).toBe(true);
  });

  it('whenPathIsNotAccessible_canAccessPath_shouldReturnFalse', () => {
    // Arrange
    (accessSync as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('missing');
    });
    // Action
    const result = service.canAccessPath('/usr/bin/chromium');
    // Assert
    expect(result).toBe(false);
  });

  it('whenPidProbeSucceeds_isPidAlive_shouldReturnTrue', () => {
    // Arrange
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    // Action
    const result = service.isPidAlive(1234);
    // Assert
    expect(result).toBe(true);
    expect(killSpy).toHaveBeenCalledWith(1234, 0);
  });

  it('whenPidProbeThrows_isPidAlive_shouldReturnFalse', () => {
    // Arrange
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => {
      throw new Error('missing');
    });
    // Action
    const result = service.isPidAlive(1234);
    // Assert
    expect(result).toBe(false);
    expect(killSpy).toHaveBeenCalledWith(1234, 0);
  });

  it('whenKillPidIsCalled_killPid_shouldDelegateToProcessKill', () => {
    // Arrange
    const killSpy = jest.spyOn(process, 'kill').mockImplementation(() => true);
    // Action
    service.killPid(5678, 'SIGKILL');
    // Assert
    expect(killSpy).toHaveBeenCalledWith(5678, 'SIGKILL');
  });
});

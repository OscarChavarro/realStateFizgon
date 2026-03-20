import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { accessSync, closeSync, existsSync, mkdirSync, openSync, unlinkSync, writeFileSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { NodeInputOutputService } from 'infrastructure/input-output/node-input-output.service';

jest.mock('node:fs', () => ({
  constants: {
    F_OK: 0,
    R_OK: 4,
    W_OK: 2
  },
  accessSync: jest.fn(),
  closeSync: jest.fn(),
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  openSync: jest.fn(),
  unlinkSync: jest.fn(),
  writeFileSync: jest.fn()
}));

jest.mock('node:fs/promises', () => ({
  access: jest.fn()
}));

jest.mock('node:path', () => ({
  join: jest.fn((...segments: string[]) => segments.join('/')),
  resolve: jest.fn((...segments: string[]) => segments.join('/'))
}));

describe('NodeInputOutputService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('whenJoinIsRequested_join_shouldDelegateToNodePathJoin', () => {
    // Arrange
    const service = new NodeInputOutputService();
    // Action
    const value = service.join('a', 'b', 'c');
    // Assert
    expect(value).toBe('a/b/c');
    expect(join).toHaveBeenCalledWith('a', 'b', 'c');
  });

  it('whenResolveIsRequested_resolve_shouldDelegateToNodePathResolve', () => {
    // Arrange
    const service = new NodeInputOutputService();
    // Action
    const value = service.resolve('/tmp', 'images');
    // Assert
    expect(value).toBe('/tmp/images');
    expect(resolve).toHaveBeenCalledWith('/tmp', 'images');
  });

  it('whenFileSystemOperationsAreRequested_methods_shouldDelegateToNodeFs', () => {
    // Arrange
    const service = new NodeInputOutputService();
    const openSyncMock = openSync as unknown as jest.MockedFunction<typeof openSync>;
    openSyncMock.mockReturnValue(31 as never);
    const existsSyncMock = existsSync as unknown as jest.MockedFunction<typeof existsSync>;
    existsSyncMock.mockReturnValue(true as never);
    // Action
    const exists = service.fileExists('/tmp/x');
    service.ensureDirectory('/tmp/y');
    service.assertReadableWritable('/tmp/z');
    service.writeTextFile('/tmp/a.txt', 'ok');
    service.deleteFile('/tmp/a.txt');
    const fd = service.openFileForAppend('/tmp/log.txt');
    service.closeFileDescriptor(fd);
    // Assert
    expect(exists).toBe(true);
    expect(mkdirSync).toHaveBeenCalledWith('/tmp/y', { recursive: true });
    expect(accessSync).toHaveBeenCalled();
    expect(writeFileSync).toHaveBeenCalledWith('/tmp/a.txt', 'ok');
    expect(unlinkSync).toHaveBeenCalledWith('/tmp/a.txt');
    expect(openSync).toHaveBeenCalledWith('/tmp/log.txt', 'a');
    expect(closeSync).toHaveBeenCalledWith(31);
  });

  it.each([
    { throws: false, expected: true },
    { throws: true, expected: false }
  ])('whenPathExistenceIsChecked_pathExists_shouldReturnExpectedValue', async ({ throws, expected }) => {
    // Arrange
    const service = new NodeInputOutputService();
    const accessMock = access as unknown as jest.MockedFunction<typeof access>;
    accessMock.mockImplementation(async () => {
      if (throws) {
        throw new Error('missing');
      }
    });
    // Action
    const exists = await service.pathExists('/tmp/test');
    // Assert
    expect(exists).toBe(expected);
  });
});

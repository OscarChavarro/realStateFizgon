export type FileSystemEntry = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
};

export interface FileSystemPort {
  ensureDirectory(path: string): Promise<void>;
  listEntries(path: string): Promise<FileSystemEntry[]>;
  move(sourcePath: string, targetPath: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  deleteDirectory(path: string): Promise<void>;
  writeFile(path: string, bytes: Buffer): Promise<void>;
}

export interface InputOutputFileAccessPort {
  fileExists(path: string): boolean;
  ensureDirectory(path: string): void;
  assertReadableWritable(path: string): void;
  writeTextFile(path: string, content: string): void;
  deleteFile(path: string): void;
  openFileForAppend(path: string): number;
  closeFileDescriptor(fileDescriptor: number): void;
  pathExists(path: string): Promise<boolean>;
}

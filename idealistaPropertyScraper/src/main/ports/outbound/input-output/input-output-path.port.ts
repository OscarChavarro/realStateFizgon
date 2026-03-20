export interface InputOutputPathPort {
  join(...segments: string[]): string;
  resolve(...segments: string[]): string;
}

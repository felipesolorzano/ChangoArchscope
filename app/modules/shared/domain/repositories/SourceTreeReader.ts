export type SourceTreeReader = {
  listDirectories(directory: string): string[];
  walkFiles(directory: string, extensions: string[], ignoredPaths?: string[]): string[];
  readText(file: string): string;
  isFile(path: string): boolean;
};

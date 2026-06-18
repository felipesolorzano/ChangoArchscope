import path from "node:path";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join("/");
}

export function relativePosix(from: string, to: string): string {
  return toPosixPath(path.relative(from, to));
}

export function nowIso(): string {
  return new Date().toISOString();
}

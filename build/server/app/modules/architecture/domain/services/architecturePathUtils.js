import path from "node:path";
export function toPosixPath(value) {
    return value.split(path.sep).join("/");
}
export function relativePosix(from, to) {
    return toPosixPath(path.relative(from, to));
}
export function nowIso() {
    return new Date().toISOString();
}

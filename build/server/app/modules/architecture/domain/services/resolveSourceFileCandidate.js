import path from "node:path";
export function resolveSourceFileCandidate(base, extensions, reader) {
    if (reader.isFile(base)) {
        return base;
    }
    for (const extension of extensions) {
        const candidate = `${base}${extension}`;
        if (reader.isFile(candidate)) {
            return candidate;
        }
    }
    for (const extension of extensions) {
        const candidate = path.join(base, `index${extension}`);
        if (reader.isFile(candidate)) {
            return candidate;
        }
    }
    return null;
}

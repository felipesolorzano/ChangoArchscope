/** Extensiones que audita el target React (mismo alcance que la fuente de Migracion). */
export const JS_SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];
export function scanJsFiles(reader, parser, jsRoot, extensions, ignoredPaths) {
    const files = [];
    const skipped = [];
    for (const file of reader.walkFiles(jsRoot, extensions, ignoredPaths)) {
        try {
            files.push(parser.parse(file, reader.readText(file)));
        }
        catch (error) {
            skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
        }
    }
    return { files, skipped };
}

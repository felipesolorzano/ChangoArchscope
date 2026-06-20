const PHP_EXTENSION = ".php";
export function scanPhpFiles(reader, parser, phpRoot, extensions = [PHP_EXTENSION], ignoredPaths = []) {
    const files = [];
    const skipped = [];
    for (const file of reader.walkFiles(phpRoot, extensions, ignoredPaths)) {
        try {
            files.push(parser.parse(file, reader.readText(file)));
        }
        catch (error) {
            skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
        }
    }
    return { files, skipped };
}

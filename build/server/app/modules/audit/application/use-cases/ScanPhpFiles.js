const PHP_EXTENSION = ".php";
export function scanPhpFiles(reader, parser, phpRoot) {
    return reader.walkFiles(phpRoot, [PHP_EXTENSION]).map((file) => parser.parse(file, reader.readText(file)));
}

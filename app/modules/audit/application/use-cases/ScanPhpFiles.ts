import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { PhpFileStructure } from "../../domain/value-objects/PhpFileStructure.js";

const PHP_EXTENSION = ".php";

export function scanPhpFiles(reader: SourceTreeReader, parser: PhpSourceParser, phpRoot: string): PhpFileStructure[] {
  return reader.walkFiles(phpRoot, [PHP_EXTENSION]).map((file) => parser.parse(file, reader.readText(file)));
}

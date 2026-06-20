import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { PhpSourceParser } from "../../domain/repositories/PhpSourceParser.js";
import type { PhpFileStructure, PhpParseFailure } from "../../domain/value-objects/PhpFileStructure.js";

const PHP_EXTENSION = ".php";

export type PhpScanResult = {
  files: PhpFileStructure[];
  skipped: PhpParseFailure[];
};

export function scanPhpFiles(
  reader: SourceTreeReader,
  parser: PhpSourceParser,
  phpRoot: string,
  extensions: string[] = [PHP_EXTENSION],
  ignoredPaths: string[] = [],
): PhpScanResult {
  const files: PhpFileStructure[] = [];
  const skipped: PhpParseFailure[] = [];

  for (const file of reader.walkFiles(phpRoot, extensions, ignoredPaths)) {
    try {
      files.push(parser.parse(file, reader.readText(file)));
    } catch (error) {
      skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { files, skipped };
}

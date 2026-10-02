import type { SourceTreeReader } from "../../../shared/domain/repositories/SourceTreeReader.js";
import type { JsSourceParser } from "../../domain/repositories/JsSourceParser.js";
import type { JsFileStructure, JsParseFailure } from "../../domain/value-objects/JsFileStructure.js";

/** Extensiones que audita el target React (mismo alcance que la fuente de Migracion). */
export const JS_SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

export type JsScanResult = {
  files: JsFileStructure[];
  skipped: JsParseFailure[];
};

export function scanJsFiles(
  reader: SourceTreeReader,
  parser: JsSourceParser,
  jsRoot: string,
  extensions: string[],
  ignoredPaths: string[],
): JsScanResult {
  const files: JsFileStructure[] = [];
  const skipped: JsParseFailure[] = [];

  for (const file of reader.walkFiles(jsRoot, extensions, ignoredPaths)) {
    try {
      files.push(parser.parse(file, reader.readText(file)));
    } catch (error) {
      skipped.push({ file, error: error instanceof Error ? error.message : String(error) });
    }
  }

  return { files, skipped };
}

import type { PhpFileStructure } from "../value-objects/PhpFileStructure.js";

export type PhpSourceParser = {
  parse(file: string, source: string): PhpFileStructure;
};

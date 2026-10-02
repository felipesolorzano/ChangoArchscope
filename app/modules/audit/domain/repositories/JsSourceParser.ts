import type { JsFileStructure } from "../value-objects/JsFileStructure.js";

export type JsSourceParser = {
  parse(file: string, source: string): JsFileStructure;
};

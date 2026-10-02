import type { JsClassStructure, JsFileStructure } from "../value-objects/JsFileStructure.js";

export type JsComponent = {
  name: string;
  kind: "class" | "function";
  startLine: number;
  endLine: number;
  cyclomaticComplexity: number;
};

export const REACT_BASE_CLASSES = new Set<string | null>(["Component", "PureComponent", "React.Component", "React.PureComponent"]);

export function isComponentClass(classStructure: JsClassStructure): boolean {
  return REACT_BASE_CLASSES.has(classStructure.extendsName) || classStructure.methods.some((method) => method.name === "render");
}

// Componentes de un archivo: clases componente (render o base de React) y funciones de nivel
// superior que devuelven JSX.
export function jsComponentsOf(file: JsFileStructure): JsComponent[] {
  const classComponents: JsComponent[] = file.classes.filter(isComponentClass).map((classStructure) => ({
    name: classStructure.name,
    kind: "class",
    startLine: classStructure.startLine,
    endLine: classStructure.endLine,
    cyclomaticComplexity: classStructure.methods.reduce((sum, method) => sum + method.decisionPointsCount, 0) + 1,
  }));

  const functionComponents: JsComponent[] = file.functions
    .filter((fn) => fn.containsJsx)
    .map((fn) => ({
      name: fn.name,
      kind: "function",
      startLine: fn.startLine,
      endLine: fn.endLine,
      cyclomaticComplexity: fn.decisionPointsCount + 1,
    }));

  return [...classComponents, ...functionComponents];
}

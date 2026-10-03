import type { Ecosystem } from "../value-objects/Dependency.js";

const REACT_FAMILY = new Set(["react", "react-dom", "react-test-renderer", "react-is", "@types/react", "@types/react-dom"]);

// Familias npm que se actualizan juntas: [grupo, coincide con el nombre].
const NPM_FAMILIES: Array<[string, (name: string) => boolean]> = [
  ["react", (name) => REACT_FAMILY.has(name)],
  ["eslint", (name) => name === "eslint" || name.startsWith("eslint-") || name.startsWith("@typescript-eslint/")],
  ["jest", (name) => name === "jest" || name.startsWith("jest-") || name === "babel-jest" || name === "ts-jest" || name.startsWith("@jest/")],
  ["vite", (name) => name === "vite" || name === "vitest" || name.startsWith("@vitejs/") || name.startsWith("@vitest/")],
  ["webpack", (name) => name === "webpack" || name.startsWith("webpack-")],
  ["gulp", (name) => name === "gulp" || name.startsWith("gulp-")],
  // Su major rompe withRouter: en el Plan va como un paso propio (XRay X6).
  ["react-router", (name) => name === "react-router" || name === "react-router-dom" || name === "history"],
];

/** Clave del grupo de paquetes que conviene actualizar juntos, o null si va solo. */
export function upgradeGroup(ecosystem: Ecosystem, name: string): string | null {
  return ecosystem === "npm" ? npmGroup(name) : composerGroup(name);
}

function npmGroup(name: string): string | null {
  const family = NPM_FAMILIES.find(([, matches]) => matches(name));
  if (family) {
    return family[0];
  }
  return name.startsWith("@") ? name.split("/")[0] : null;
}

function composerGroup(name: string): string | null {
  const [vendor, pkg] = name.split("/");
  if (pkg === undefined) {
    return null;
  }
  return vendor === "illuminate" ? "laravel" : vendor;
}

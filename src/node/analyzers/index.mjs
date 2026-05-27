import { buildLaravelGraph, checkLaravelArchitecture } from "./laravelAnalyzer.mjs";
import { buildReactGraph, checkReactArchitecture } from "./reactAnalyzer.mjs";

export function buildArchitectureGraph(config, { target = "laravel", module = null } = {}) {
  return target === "react"
    ? buildReactGraph(config, module)
    : buildLaravelGraph(config, module);
}

export function checkArchitecture(config, { target = "laravel", module = null, failOnCoupling = true } = {}) {
  return target === "react"
    ? checkReactArchitecture(config, module, failOnCoupling)
    : checkLaravelArchitecture(config, module, failOnCoupling);
}

import { buildArchitectureGraph, checkArchitecture } from "../../application/analyzers/index.mjs";

export function resolveArchitectureApiRoute(url, config) {
  if (url.pathname === "/graph.json") {
    return {
      payload: buildArchitectureGraph(config, {
        target: url.searchParams.get("target") ?? "laravel",
        module: url.searchParams.get("module") || null,
      }),
    };
  }

  if (url.pathname === "/check.json") {
    return {
      payload: checkArchitecture(config, {
        target: url.searchParams.get("target") ?? "laravel",
        module: url.searchParams.get("module") || null,
        failOnCoupling: url.searchParams.get("fail_on_coupling") !== "false",
      }),
    };
  }

  return null;
}

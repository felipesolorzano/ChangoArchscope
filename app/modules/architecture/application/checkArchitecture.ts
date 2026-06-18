import type { SourceTreeReader } from "../../shared/domain/repositories/SourceTreeReader.js";
import type { ArchitectureCheckResult } from "../domain/value-objects/ArchitectureCheckReport.js";
import type { ArchitectureConfig } from "../domain/value-objects/ArchitectureConfig.js";
import type { CheckOptions } from "../domain/value-objects/ArchitectureTarget.js";
import { checkLaravelArchitecture } from "./analyzers/laravelAnalyzer.js";
import { checkReactArchitecture } from "./analyzers/reactAnalyzer.js";

export function checkArchitecture(
  config: ArchitectureConfig,
  reader: SourceTreeReader,
  { target = "laravel", module = null, failOnCoupling = true }: CheckOptions = {},
): ArchitectureCheckResult {
  return target === "react"
    ? checkReactArchitecture(config, reader, module, failOnCoupling)
    : checkLaravelArchitecture(config, reader, module, failOnCoupling);
}

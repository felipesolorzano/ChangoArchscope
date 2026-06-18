import { checkLaravelArchitecture } from "./analyzers/laravelAnalyzer.js";
import { checkReactArchitecture } from "./analyzers/reactAnalyzer.js";
export function checkArchitecture(config, reader, { target = "laravel", module = null, failOnCoupling = true } = {}) {
    return target === "react"
        ? checkReactArchitecture(config, reader, module, failOnCoupling)
        : checkLaravelArchitecture(config, reader, module, failOnCoupling);
}

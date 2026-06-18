let currentConfig;
export function setArchitectureConfig(config) {
    currentConfig = config;
}
export function getArchitectureConfig() {
    if (currentConfig === undefined) {
        throw new Error("Architecture config has not been registered.");
    }
    return currentConfig;
}
export function clearArchitectureConfig() {
    currentConfig = undefined;
}

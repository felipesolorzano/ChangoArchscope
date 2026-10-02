const REACT_TARGETS = new Set(["react", "react-design"]);
// Resuelve que stack corresponde al target del mapa (as-is o diseño) y enumera sus archivos en
// alcance. Los targets historicos de Laravel (`laravel`, `design`) y cualquier otro caen a laravel.
function stackFor(target, stacks) {
    return REACT_TARGETS.has(target) ? stacks.react : stacks.laravel;
}
// Raiz del proyecto del target: clave con la que se guardan sus mapas y el estado del plan.
export function projectRootFor(target, stacks) {
    return stackFor(target, stacks).root;
}
export function resolveProjectSource(target, stacks, listFiles) {
    const stack = stackFor(target, stacks);
    return {
        target,
        root: stack.root,
        extensions: stack.extensions,
        ignoredPaths: stack.ignoredPaths,
        files: listFiles(stack.root, stack.extensions, stack.ignoredPaths),
    };
}

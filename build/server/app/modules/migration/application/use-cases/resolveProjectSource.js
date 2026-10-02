const REACT_TARGETS = new Set(["react", "react-design"]);
// Resuelve que stack corresponde al target del mapa (as-is o diseño) y enumera sus archivos en
// alcance. Los targets historicos de Laravel (`laravel`, `design`) y cualquier otro caen a laravel.
export function resolveProjectSource(target, stacks, listFiles) {
    const stack = REACT_TARGETS.has(target) ? stacks.react : stacks.laravel;
    return {
        target,
        root: stack.root,
        extensions: stack.extensions,
        ignoredPaths: stack.ignoredPaths,
        files: listFiles(stack.root, stack.extensions, stack.ignoredPaths),
    };
}

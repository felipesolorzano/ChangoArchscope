// Categorias que audita cada stack, en el orden en que se muestran en el checklist de salud.
const COMMON = [
    { category: "security", label: "Seguridad" },
    { category: "architecture_violation", label: "Arquitectura" },
    { category: "coupling_module", label: "Acoplamiento entre módulos" },
    { category: "complexity", label: "Complejidad" },
    { category: "coupling_low_level", label: "Acoplamiento de bajo nivel" },
    { category: "dead_code", label: "Código muerto" },
    { category: "testing", label: "Tests" },
    { category: "legacy_api", label: "APIs legacy" },
];
const BY_TARGET = {
    laravel: [...COMMON, { category: "database", label: "Base de datos" }, { category: "php_compatibility", label: "Compatibilidad PHP" }],
    react: [...COMMON, { category: "api_access", label: "API / HTTP" }],
};
export function auditCategoriesFor(target) {
    return BY_TARGET[target];
}

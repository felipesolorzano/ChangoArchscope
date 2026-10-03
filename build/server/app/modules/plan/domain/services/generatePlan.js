import { DUPLICATE_FILES_TASK, SKIPPED_FILES_TASK, TASK_RULES, countSelected } from "./planTaskRules.js";
const VALIDATE_KEY = "validate-risk-reduction";
const MAJOR_KEY = "upgrade-major-versions";
const MAJOR_STEP_PREFIX = "upgrade-major:";
// Dependencia comodin: todos los pasos de major incluidos.
// Stryker disable next-line StringLiteral: la constante se usa igual al declarar y al expandir, mutante equivalente.
const MAJOR_STEPS = "upgrade-major:*";
const SHOWN_JUMPS = 3;
// Plantillas de remediacion en orden de roadmap = orden de las fases (XRay X6, plan-phases.md). Cada una se incluye solo si su metrica es > 0.
// Las basadas en reglas miden con sus selectores de TASK_RULES (misma fuente que el panel).
// Stryker disable ArrayDeclaration: equivalente en los `dependsOn: []`. generatePlan poda las
// dependencias a claves de tareas incluidas, asi que agregar una clave inexistente no cambia nada.
const TEMPLATES = [
    // Fase 0 — linea base
    {
        key: SKIPPED_FILES_TASK,
        title: "Excluir librerias de terceros",
        description: "Sacar del analisis el codigo vendored/no parseable para enfocar la deuda propia.",
        category: "scope",
        dependsOn: [],
        metric: (s) => s.skippedFiles,
    },
    // Fase 1 — limpieza: menos codigo que proteger y migrar
    ruleTemplate({
        key: "remove-manual-copies",
        title: "Eliminar copias manuales",
        description: "Confirmar cual es la version viva de cada archivo copiado ( - copia, _old, .devel) y borrar el resto.",
        category: "debt",
        dependsOn: [],
    }),
    ruleTemplate({
        key: "remove-unused-files",
        title: "Eliminar archivos sin uso",
        description: "Verificar y borrar los archivos que ningun otro importa, despues de limpiar las copias.",
        category: "debt",
        dependsOn: ["remove-manual-copies"],
    }),
    {
        key: DUPLICATE_FILES_TASK,
        title: "Resolver migraciones a medias (_new)",
        description: "Elegir el archivo canonico entre X y X_new y eliminar el duplicado.",
        category: "debt",
        dependsOn: [],
        metric: (s) => s.duplicatePairs,
    },
    ruleTemplate({
        key: "remove-unused-exports",
        title: "Eliminar exports sin uso",
        description: "Quitar funciones, componentes y constantes exportadas que ningun archivo importa.",
        category: "debt",
        dependsOn: ["remove-unused-files"],
    }),
    dependencyTemplate({
        key: "remove-unused-packages",
        title: "Quitar dependencias sin uso",
        description: "Eliminar paquetes declarados que el codigo no referencia: menos que actualizar.",
        dependsOn: [],
    }),
    // Fase 2 — red de seguridad: todo lo que cambia codigo o versiones espera a esto
    ruleTemplate({
        key: "add-characterization-tests",
        title: "Tests de caracterizacion en lo complejo",
        description: "Cubrir con tests los metodos complejos antes de refactorizar.",
        category: "testing",
        dependsOn: [],
    }),
    ruleTemplate({
        key: "add-component-tests",
        title: "Tests de caracterizacion en componentes complejos",
        description: "Cubrir con tests de componente los componentes mas complejos antes de tocarlos.",
        category: "testing",
        dependsOn: [],
    }),
    // Fase 3 — seguridad del codigo
    ruleTemplate({
        key: "close-sql-injections",
        title: "Cerrar inyecciones SQL",
        description: "Migrar las concatenaciones de SQL con datos dinamicos a sentencias parametrizadas.",
        category: "security",
        dependsOn: ["add-characterization-tests"],
    }),
    ruleTemplate({
        key: "close-code-injection",
        title: "Eliminar ejecucion dinamica de codigo",
        description: "Reemplazar eval / Function() por logica explicita: compilan codigo desde strings.",
        category: "security",
        dependsOn: ["add-characterization-tests", "add-component-tests"],
    }),
    ruleTemplate({
        key: "close-xss-sinks",
        title: "Cerrar vectores de XSS",
        description: "Reemplazar dangerouslySetInnerHTML / innerHTML por render de React o HTML sanitizado.",
        category: "security",
        dependsOn: ["add-component-tests"],
    }),
    // Fase 4 — arquitectura
    ruleTemplate({
        key: "break-import-cycles",
        title: "Romper ciclos de dependencias",
        description: "Cortar cada ciclo de imports extrayendo lo compartido o invirtiendo la dependencia con un contrato.",
        category: "architecture",
        dependsOn: ["add-characterization-tests", "add-component-tests"],
    }),
    // Fase 5 — APIs legacy con reemplazo en la version actual (antes de subir versiones)
    ruleTemplate({
        key: "apply-legacy-codemods",
        title: "Aplicar codemods compatibles (antes de actualizar)",
        description: "Con los tests en verde: lifecycles, string refs, findDOMNode y funciones PHP eliminadas tienen reemplazo en la version actual.",
        category: "legacy_api",
        dependsOn: ["add-characterization-tests", "add-component-tests"],
    }),
    ruleTemplate({
        key: "migrate-deprecated-apis",
        title: "Migrar APIs y librerias deprecadas",
        description: "withRouter, moment/request/react-ga, utf8_encode: migracion manual guiada por el panel Codemods, antes de subir versiones.",
        category: "legacy_api",
        dependsOn: ["apply-legacy-codemods", "add-characterization-tests", "add-component-tests"],
    }),
    // Fase 6 — desacople y capas
    ruleTemplate({
        key: "isolate-http-layer",
        title: "Aislar las llamadas HTTP en una capa de servicios",
        description: "Mover fetch/ajax/Crud de los componentes a servicios de API con endpoints configurables.",
        category: "api_access",
        dependsOn: ["add-component-tests"],
    }),
    ruleTemplate({
        key: "remove-jquery",
        title: "Sacar jQuery y el acceso directo al DOM",
        description: "Reemplazar $(...) y document.* por estado, refs y eventos de React.",
        category: "coupling",
        dependsOn: ["add-component-tests"],
    }),
    ruleTemplate({
        key: "replace-base-class-inheritance",
        title: "Reemplazar la herencia de la base comun por composicion",
        description: "Pasar de class X extends Base a hooks/servicios inyectados, una vez aislada la capa HTTP.",
        category: "coupling",
        dependsOn: ["add-component-tests", "isolate-http-layer"],
    }),
    ruleTemplate({
        key: "reduce-n-plus-one",
        title: "Reducir consultas N+1",
        description: "Sacar las queries de los loops para mejorar el rendimiento.",
        category: "database",
        dependsOn: ["add-characterization-tests"],
    }),
    ruleTemplate({
        key: "extract-data-layer",
        title: "Extraer capa de acceso a datos",
        description: "Centralizar el SQL crudo y duplicado en una capa de datos reutilizable.",
        category: "database",
        dependsOn: ["add-characterization-tests", "close-sql-injections"],
    }),
    // Fase 7 — paquetes que no rompen: siempre con tests y con las APIs ya migradas
    dependencyTemplate({
        key: "fix-vulnerable-packages",
        title: "Corregir paquetes vulnerables",
        description: "Subir cada paquete con vulnerabilidades conocidas (OSV) a la version que las corrige.",
        dependsOn: ["add-characterization-tests", "add-component-tests", "apply-legacy-codemods", "migrate-deprecated-apis"],
    }),
    dependencyTemplate({
        key: "apply-safe-updates",
        title: "Aplicar actualizaciones patch y minor",
        description: "Subir en bloque lo que no rompe compatibilidad, con los tests como red.",
        dependsOn: ["fix-vulnerable-packages", "remove-unused-packages", "add-characterization-tests", "add-component-tests", "apply-legacy-codemods", "migrate-deprecated-apis"],
    }),
    // Fase 8 — runtime y majors, un salto a la vez
    dependencyTemplate({
        key: "update-unsupported-runtime",
        title: "Actualizar runtime sin soporte",
        description: "Llevar PHP / Node a un ciclo con soporte de seguridad antes de los saltos grandes.",
        dependsOn: ["apply-safe-updates", "add-characterization-tests", "add-component-tests", "apply-legacy-codemods", "migrate-deprecated-apis"],
    }),
    dependencyTemplate({
        key: "upgrade-major-versions",
        title: "Migrar versiones major",
        description: "Un grupo a la vez (react, eslint, jest...), siguiendo su guia de migracion.",
        dependsOn: ["apply-safe-updates", "update-unsupported-runtime", "add-characterization-tests", "add-component-tests"],
    }),
    dependencyTemplate({
        key: "replace-abandoned-packages",
        title: "Reemplazar paquetes abandonados o deprecated",
        description: "Migrar a su reemplazo (o a una alternativa mantenida) con tests que cubran el uso actual.",
        dependsOn: ["apply-safe-updates", "add-characterization-tests", "add-component-tests"],
    }),
    // Fase 9 — lo que solo existe en la version nueva
    ruleTemplate({
        key: "apply-post-upgrade-codemods",
        title: "Aplicar codemods de la version nueva",
        description: "Despues de subir React: ReactDOM.render / hydrate → createRoot.",
        category: "legacy_api",
        dependsOn: ["upgrade-major-versions", MAJOR_STEPS, "add-component-tests"],
    }),
    // Fase 10 — complejidad (validate se agrega al final)
    ruleTemplate({
        key: "break-god-classes",
        title: "Romper clases gigantes",
        description: "Dividir incrementalmente las clases enormes en unidades mas pequenas y testeables.",
        category: "complexity",
        dependsOn: ["add-characterization-tests", "add-component-tests"],
    }),
    ruleTemplate({
        key: "split-large-components",
        title: "Partir componentes gigantes",
        description: "Dividir los componentes con render y estado enormes en componentes chicos y testeables.",
        category: "complexity",
        dependsOn: ["add-component-tests"],
    }),
];
// Stryker restore ArrayDeclaration
// Plantilla de actualizacion de paquetes: su metrica la calcula el modulo dependencies.
function dependencyTemplate(template) {
    return { ...template, category: "dependencies", metric: (signals) => signals.dependencies?.counts[template.key] ?? 0 };
}
// Plantilla cuya metrica es la cantidad de hallazgos que coinciden con sus selectores.
function ruleTemplate(template) {
    return { ...template, metric: (signals) => countSelected(signals, TASK_RULES[template.key]) };
}
// XRay X6: con pasos de major, la tarea unica se reemplaza por un paso por grupo, encadenados.
function majorStepTemplates(dependencies, steps) {
    return steps.map((key, index) => {
        // Cada paso trae sus items (contrato de dependencyReportToSignals).
        const jumps = dependencies.items[key].map((finding) => finding.message.split(" (grupo ")[0]);
        const rest = jumps.length - SHOWN_JUMPS;
        const group = key.slice(MAJOR_STEP_PREFIX.length);
        return {
            key,
            title: group === "otros" ? "Migrar majors sueltos" : `Migrar major: ${group}`,
            description: `${jumps.slice(0, SHOWN_JUMPS).join(", ")}${rest > 0 ? ` (+${rest})` : ""}. Un salto a la vez: tests verdes antes y despues.`,
            category: "dependencies",
            dependsOn: [...steps.slice(index - 1, index), "apply-safe-updates", "update-unsupported-runtime", "add-characterization-tests", "add-component-tests"],
            metric: () => jumps.length,
        };
    });
}
function templatesFor(signals) {
    const steps = signals.dependencies?.majorSteps;
    return TEMPLATES.flatMap((template) => (template.key === MAJOR_KEY && steps !== undefined ? majorStepTemplates(signals.dependencies, steps) : [template]));
}
export function generatePlan(signals) {
    const work = templatesFor(signals)
        .map((template) => ({ template, metric: template.metric(signals) }))
        .filter((item) => item.metric > 0);
    if (work.length === 0) {
        return [];
    }
    const includedKeys = new Set(work.map((item) => item.template.key));
    const tasks = work.map(({ template, metric }) => ({
        key: template.key,
        title: template.title,
        description: template.description,
        category: template.category,
        // El comodin se expande a los pasos de major incluidos.
        dependsOn: template.dependsOn
            .flatMap((dependency) => (dependency === MAJOR_STEPS ? [...includedKeys].filter((key) => key.startsWith(MAJOR_STEP_PREFIX)) : [dependency]))
            .filter((dependency) => includedKeys.has(dependency)),
        metric,
    }));
    tasks.push({
        key: VALIDATE_KEY,
        title: "Validar reduccion de riesgo",
        description: "Re-correr la auditoria y confirmar que el riesgo bajo tras los cambios.",
        category: "validation",
        dependsOn: tasks.map((task) => task.key),
        metric: 0,
    });
    return tasks;
}

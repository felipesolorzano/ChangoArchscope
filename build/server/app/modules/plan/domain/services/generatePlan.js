import { DUPLICATE_FILES_TASK, SKIPPED_FILES_TASK, TASK_RULES, countSelected } from "./planTaskRules.js";
const VALIDATE_KEY = "validate-risk-reduction";
// Plantillas de remediacion en orden de roadmap. Cada una se incluye solo si su metrica es > 0.
// Las basadas en reglas miden con sus selectores de TASK_RULES (misma fuente que el panel).
// Stryker disable ArrayDeclaration: equivalente en los `dependsOn: []`. generatePlan poda las
// dependencias a claves de tareas incluidas, asi que agregar una clave inexistente no cambia nada.
const TEMPLATES = [
    {
        key: SKIPPED_FILES_TASK,
        title: "Excluir librerias de terceros",
        description: "Sacar del analisis el codigo vendored/no parseable para enfocar la deuda propia.",
        category: "scope",
        dependsOn: [],
        metric: (s) => s.skippedFiles,
    },
    ruleTemplate({
        key: "close-sql-injections",
        title: "Cerrar inyecciones SQL",
        description: "Migrar las concatenaciones de SQL con datos dinamicos a sentencias parametrizadas.",
        category: "security",
        dependsOn: [],
    }),
    ruleTemplate({
        key: "close-code-injection",
        title: "Eliminar ejecucion dinamica de codigo",
        description: "Reemplazar eval / Function() por logica explicita: compilan codigo desde strings.",
        category: "security",
        dependsOn: [],
    }),
    ruleTemplate({
        key: "close-xss-sinks",
        title: "Cerrar vectores de XSS",
        description: "Reemplazar dangerouslySetInnerHTML / innerHTML por render de React o HTML sanitizado.",
        category: "security",
        dependsOn: [],
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
    ruleTemplate({
        key: "break-god-classes",
        title: "Romper clases gigantes",
        description: "Dividir incrementalmente las clases enormes en unidades mas pequenas y testeables.",
        category: "complexity",
        dependsOn: ["add-characterization-tests", "add-component-tests"],
    }),
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
        key: "split-large-components",
        title: "Partir componentes gigantes",
        description: "Dividir los componentes con render y estado enormes en componentes chicos y testeables.",
        category: "complexity",
        dependsOn: ["add-component-tests"],
    }),
];
// Stryker restore ArrayDeclaration
// Plantilla cuya metrica es la cantidad de hallazgos que coinciden con sus selectores.
function ruleTemplate(template) {
    return { ...template, metric: (signals) => countSelected(signals, TASK_RULES[template.key]) };
}
export function generatePlan(signals) {
    const work = TEMPLATES.map((template) => ({ template, metric: template.metric(signals) })).filter((item) => item.metric > 0);
    if (work.length === 0) {
        return [];
    }
    const includedKeys = new Set(work.map((item) => item.template.key));
    const tasks = work.map(({ template, metric }) => ({
        key: template.key,
        title: template.title,
        description: template.description,
        category: template.category,
        dependsOn: template.dependsOn.filter((dependency) => includedKeys.has(dependency)),
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

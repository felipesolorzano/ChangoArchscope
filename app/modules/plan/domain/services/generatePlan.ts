import type { PlanSignals, PlanTask } from "../value-objects/Plan.js";

type PlanTemplate = {
  key: string;
  title: string;
  description: string;
  category: string;
  dependsOn: string[];
  metric: (signals: PlanSignals) => number;
};

const VALIDATE_KEY = "validate-risk-reduction";

// Plantillas de remediacion en orden de roadmap. Cada una se incluye solo si su metrica es > 0.
const TEMPLATES: PlanTemplate[] = [
  {
    key: "exclude-third-party",
    title: "Excluir librerias de terceros",
    description: "Sacar del analisis el codigo vendored/no parseable para enfocar la deuda propia.",
    category: "scope",
    dependsOn: [],
    metric: (s) => s.skippedFiles,
  },
  {
    key: "close-sql-injections",
    title: "Cerrar inyecciones SQL",
    description: "Migrar las concatenaciones de SQL con datos dinamicos a sentencias parametrizadas.",
    category: "security",
    dependsOn: [],
    metric: (s) => s.ruleCounts["sql-concatenation"] ?? 0,
  },
  {
    key: "resolve-duplicate-migrations",
    title: "Resolver migraciones a medias (_new)",
    description: "Elegir el archivo canonico entre X y X_new y eliminar el duplicado.",
    category: "debt",
    dependsOn: [],
    metric: (s) => s.duplicatePairs,
  },
  {
    key: "add-characterization-tests",
    title: "Tests de caracterizacion en lo complejo",
    description: "Cubrir con tests los metodos complejos antes de refactorizar.",
    category: "testing",
    dependsOn: [],
    metric: (s) => s.ruleCounts["untested-complex-method"] ?? 0,
  },
  {
    key: "reduce-n-plus-one",
    title: "Reducir consultas N+1",
    description: "Sacar las queries de los loops para mejorar el rendimiento.",
    category: "database",
    dependsOn: ["add-characterization-tests"],
    metric: (s) => s.ruleCounts["n-plus-one-query"] ?? 0,
  },
  {
    key: "extract-data-layer",
    title: "Extraer capa de acceso a datos",
    description: "Centralizar el SQL crudo y duplicado en una capa de datos reutilizable.",
    category: "database",
    dependsOn: ["add-characterization-tests", "close-sql-injections"],
    metric: (s) => (s.ruleCounts["raw-sql-outside-infrastructure"] ?? 0) + (s.ruleCounts["duplicate-sql"] ?? 0),
  },
  {
    key: "break-god-classes",
    title: "Romper clases gigantes",
    description: "Dividir incrementalmente las clases enormes en unidades mas pequenas y testeables.",
    category: "complexity",
    dependsOn: ["add-characterization-tests"],
    metric: (s) => s.ruleCounts["large-class"] ?? 0,
  },
];

export function generatePlan(signals: PlanSignals): PlanTask[] {
  const work = TEMPLATES.map((template) => ({ template, metric: template.metric(signals) })).filter(
    (item) => item.metric > 0,
  );

  if (work.length === 0) {
    return [];
  }

  const includedKeys = new Set(work.map((item) => item.template.key));

  const tasks: PlanTask[] = work.map(({ template, metric }) => ({
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

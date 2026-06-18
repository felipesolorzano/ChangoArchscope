import type { ArchitectureConfig } from "../../domain/value-objects/ArchitectureConfig.js";

export const defaultConfig: ArchitectureConfig = {
  laravel: {
    modulesPath: "app/modules",
    namespaceRoot: "App\\Modules",
    layers: ["Domain", "Application", "Presentation", "Infrastructure"],
    ignoredPaths: ["**/README.md"],
    forbiddenImports: {
      Domain: [
        {
          pattern: "^Illuminate\\\\",
          message: "Domain no debe conocer Laravel.",
          suggestion: "Mueve esta dependencia a Application o Infrastructure y deja Domain con objetos/reglas puras.",
        },
        {
          pattern: "\\\\Infrastructure\\\\",
          message: "Domain no debe depender de Infrastructure.",
          suggestion: "Invierte la dependencia: Infrastructure puede conocer Domain, no al reves.",
        },
        {
          pattern: "\\\\Presentation\\\\",
          message: "Domain no debe depender de Presentation.",
          suggestion: "Mueve la coordinacion de UI a Presentation o Application.",
        },
      ],
      Application: [
        {
          pattern: "\\\\Infrastructure\\\\",
          message: "Application no debe depender de Infrastructure.",
          suggestion: "Define un contrato en Application y bindea su implementacion en Infrastructure.",
        },
        {
          pattern: "\\\\Presentation\\\\",
          message: "Application no debe depender de Presentation.",
          suggestion: "Presentation debe llamar casos de uso; Application no debe llamar UI/controladores.",
        },
      ],
      Presentation: [
        {
          pattern: "\\\\Infrastructure\\\\Persistence\\\\Eloquent\\\\",
          message: "Presentation no debe consultar modelos Eloquent directamente.",
          suggestion: "Crea un contrato/caso de uso en Application y un adaptador Eloquent en Infrastructure.",
        },
      ],
      Infrastructure: [],
    },
    coupling: {
      enabled: true,
      ignoredModules: ["Shared"],
      allowedDependencies: {},
      message: "El modulo depende directamente de otro modulo.",
      suggestion: "Revisa si conviene pasar por un contrato, evento o adapter para reducir acoplamiento.",
      defaultAssessment: "Revisar.",
      defaultRecommendation: "Decide si es una integracion estable o si conviene invertir la dependencia.",
      defaultAction: "revisar",
    },
  },
  react: {
    modulesPath: "resources/js/react/modules",
    alias: "@modules",
    layers: {
      domain: "Domain",
      application: "Application",
      contracts: "Application",
      infrastructure: "Infrastructure",
      presentation: "Presentation",
      interfaces: "Presentation",
    },
    forbiddenImports: {
      Domain: [
        {
          pattern: "^react$",
          message: "Domain no debe depender de React.",
          suggestion: "Mueve hooks/componentes a presentation y deja Domain con tipos/reglas puras.",
        },
        {
          pattern: "\\/infrastructure\\/",
          message: "Domain no debe depender de Infrastructure.",
          suggestion: "Invierte la dependencia mediante contratos de Application.",
        },
        {
          pattern: "\\/(presentation|interfaces)\\/",
          message: "Domain no debe depender de UI.",
          suggestion: "Mueve esa dependencia a presentation o application.",
        },
      ],
      Application: [
        {
          pattern: "\\/infrastructure\\/",
          message: "Application no debe depender de Infrastructure.",
          suggestion: "Define un contrato en Application e implementalo en Infrastructure.",
        },
        {
          pattern: "\\/(presentation|interfaces)\\/",
          message: "Application no debe depender de presentation/UI.",
          suggestion: "La UI debe llamar casos de uso; Application no debe importar componentes/hooks/store.",
        },
      ],
      Presentation: [],
      Infrastructure: [],
    },
    coupling: {
      enabled: true,
      ignoredModules: [],
      allowedDependencies: {},
      message: "El modulo React depende directamente de otro modulo React.",
      suggestion: "Si la dependencia es compartida, extraela a un contrato, helper compartido o adapter explicito.",
      defaultAssessment: "Revisar.",
      defaultRecommendation: "Los modulos React deberian integrarse por contratos, eventos/props o dependencias compartidas.",
      defaultAction: "revisar",
    },
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};

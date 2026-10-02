export default {
  laravel: {
    modulesPath: "/home/felipe/Desktop/MSRepos/src/mc",
    namespaceRoot: "App\\Modules",
    // Extensiones PHP a escanear. El emparejamiento es por sufijo, asi que
    // soporta extensiones compuestas como ".lib.inc" (distinta de ".inc").
    phpExtensions: [".php", ".inc", ".lib.inc"],
    // Carpetas/archivos a excluir dentro de modulesPath (patrones glob, minimatch).
    // Un nombre de carpeta de primer nivel (p. ej. "sql") deja fuera ese modulo completo.
    ignoredPaths: ["**/README.md", "**/vendor/**", "docs", "Documents", "nbproject", "sql"],
    // Ignora archivos/carpetas ocultos (.git, .idea, .vscode...). Default true; false para escanearlos.
    ignoreHidden: true,
  },
  react: {
   // modulesPath: "resources/js/react/modules",
    modulesPath: "/home/felipe/Desktop/MSRepos/src/brandsites/react_/src",
    alias: "@modules",
    // Carpetas/archivos React a excluir dentro de modulesPath (patrones glob).
    ignoredPaths: ["**/__tests__/**", "**/*.test.*"],
    ignoreHidden: true,
    // Tests fuera de modulesPath: el audit los usa solo como evidencia de testing.
    // brandsites no tiene tests; para ChangoArchscope: ["resources/js/react/tests"].
    testPaths: [],
    // Arbol plano legacy: carpetas de arriba (entrada) hacia abajo (base). Importar una carpeta de
    // mas arriba es una violacion de arquitectura. Un array agrupa carpetas del mismo nivel.
    folderOrder: ["routes", "pages", "partials", ["components", "stripes", "customStripe"], "globals", "languages", "configs"],
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};

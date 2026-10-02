export default {
  laravel: {
    modulesPath: "/home/felipe/Desktop/MSRepos/src/mc",
    namespaceRoot: "App\\Modules",
    // Extensiones PHP a escanear. El emparejamiento es por sufijo, asi que
    // soporta extensiones compuestas como ".lib.inc" (distinta de ".inc").
    phpExtensions: [".php", ".inc", ".lib.inc"],
    // Carpetas/archivos a excluir dentro de modulesPath (patrones glob, minimatch).
    ignoredPaths: ["**/README.md", "**/vendor/**"],
  },
  react: {
    modulesPath: "resources/js/react/modules",
    alias: "@modules",
    // Carpetas/archivos React a excluir dentro de modulesPath (patrones glob).
    ignoredPaths: ["**/__tests__/**", "**/*.test.*"],
    // Tests fuera de modulesPath: el audit los usa solo como evidencia de testing.
    testPaths: ["resources/js/react/tests"],
    // Arbol plano legacy: carpetas de arriba (entrada) hacia abajo (base). Importar una carpeta de
    // mas arriba es una violacion de arquitectura. Un array agrupa carpetas del mismo nivel.
    folderOrder: ["routes", "pages", "partials", ["components", "stripes", "customStripe"], "globals", "languages", "configs"],
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};

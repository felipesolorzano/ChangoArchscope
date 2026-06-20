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
  },
  server: {
    host: "127.0.0.1",
    port: 4590,
  },
};

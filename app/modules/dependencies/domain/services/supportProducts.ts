import type { Ecosystem, RuntimeKind } from "../value-objects/Dependency.js";

const RUNTIME_PRODUCTS: Record<RuntimeKind, string | null> = { php: "php", node: "nodejs", npm: null };

const PACKAGE_PRODUCTS: Record<Ecosystem, Record<string, string>> = {
  npm: {
    react: "react",
    vue: "vue",
    "@angular/core": "angular",
    jquery: "jquery",
    "jquery-ui": "jquery-ui",
    bootstrap: "bootstrap",
    eslint: "eslint",
    express: "express",
    electron: "electron",
    next: "nextjs",
    nuxt: "nuxt",
  },
  composer: {
    "laravel/framework": "laravel",
    "symfony/symfony": "symfony",
    "symfony/http-kernel": "symfony",
    "drupal/core": "drupal",
    "cakephp/cakephp": "cakephp",
  },
};

/** Producto de endoflife.date de un runtime (npm no tiene ciclo publicado). */
export function runtimeProduct(kind: RuntimeKind): string | null {
  return RUNTIME_PRODUCTS[kind];
}

/** Producto de endoflife.date de un paquete conocido; null si no tiene ciclo publicado. */
export function supportProductFor(ecosystem: Ecosystem, name: string): string | null {
  return PACKAGE_PRODUCTS[ecosystem][name] ?? null;
}

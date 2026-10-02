const RUNTIME_PRODUCTS = { php: "php", node: "nodejs", npm: null };
const PACKAGE_PRODUCTS = {
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
export function runtimeProduct(kind) {
    return RUNTIME_PRODUCTS[kind];
}
/** Producto de endoflife.date de un paquete conocido; null si no tiene ciclo publicado. */
export function supportProductFor(ecosystem, name) {
    return PACKAGE_PRODUCTS[ecosystem][name] ?? null;
}

# Imagen propia de Chango Archscope para auditar compatibilidad de version de PHP.
# NO se instala nada dentro del repo escaneado: toda la toolchain vive aqui.
# El repo del cliente se monta en /repo en modo lectura al ejecutar el contenedor.
FROM php:8.3-cli

RUN apt-get update \
    && apt-get install -y --no-install-recommends git unzip zip \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /tools

RUN composer require --no-interaction \
    squizlabs/php_codesniffer \
    phpcompatibility/php-compatibility \
    && ./vendor/bin/phpcs --config-set installed_paths vendor/phpcompatibility/php-compatibility

ENTRYPOINT ["./vendor/bin/phpcs"]

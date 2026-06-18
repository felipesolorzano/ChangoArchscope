# SQLite Migrations

## Objetivo

Ejecutar migraciones SQL versionadas sobre una base SQLite del backend.

## Entradas

- `databasePath`: ruta del archivo SQLite.
- `migrationsDirectory`: carpeta que contiene archivos `.sql`.

## Comportamiento

- La base SQLite debe crearse si no existe.
- La carpeta de migraciones debe crearse si no existe.
- El sistema debe crear una tabla interna `schema_migrations`.
- Las migraciones deben ejecutarse en orden alfabetico por nombre de archivo.
- Las migraciones ya registradas en `schema_migrations` no deben ejecutarse de nuevo.
- Cada migracion debe ejecutarse dentro de una transaccion.
- Si una migracion falla, no debe registrarse como aplicada.

## Salidas

- Lista de migraciones aplicadas durante la ejecucion.

## Criterios de Aceptacion

- La primera ejecucion aplica las migraciones pendientes.
- La segunda ejecucion no reaplica migraciones ya registradas.
- La tabla `schema_migrations` conserva el historial de migraciones aplicadas.

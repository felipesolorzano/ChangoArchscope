# SQLite Connection

## Objetivo

Configurar una conexion SQLite para el backend que pueda abrir una base persistente o una base en memoria para pruebas.

## Entradas

- `databasePath`: ruta del archivo SQLite o `:memory:`.

## Comportamiento

- Si `databasePath` es `:memory:`, la conexion debe abrirse sin crear un archivo de base de datos.
- Si `databasePath` apunta a un archivo, se debe crear el directorio padre cuando no exista.
- La conexion debe permitir ejecutar una consulta simple de verificacion.
- La conexion debe poder cerrarse explicitamente.

## Salidas

- Una instancia abierta de SQLite (`better-sqlite3`).

## Criterios de Aceptacion

- Una consulta `SELECT 1 AS connected` debe devolver `1`.
- La prueba debe poder usar `:memory:` para no depender de archivos persistentes.
- Si se usa una ruta de archivo, el directorio padre debe crearse automaticamente.

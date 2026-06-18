let currentDatabase;
export function setSqliteDatabaseConnection(database) {
    currentDatabase = database;
}
export function getSqliteDatabaseConnection() {
    if (currentDatabase === undefined) {
        throw new Error("SQLite database connection has not been registered.");
    }
    return currentDatabase;
}
export function clearSqliteDatabaseConnection() {
    currentDatabase = undefined;
}

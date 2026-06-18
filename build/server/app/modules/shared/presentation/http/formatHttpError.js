export function formatHttpError(error) {
    return error instanceof Error ? error.message : "Unexpected error.";
}

// none: ni tests ni reportes; high: cobertura >= 80 y mutation >= 70; medium: alguna >= 50; si no low.
export function protectionLevel({ testFiles, coverage, mutation, reports }) {
    if (testFiles === 0 && reports === 0) {
        return "none";
    }
    if ((coverage ?? 0) >= 80 && (mutation ?? 0) >= 70) {
        return "high";
    }
    if ((coverage ?? 0) >= 50 || (mutation ?? 0) >= 50) {
        return "medium";
    }
    return "low";
}

export const ROW_Y = 240;
export const COL_GAP = 260;
export const MIN_NODE_SIZE = 90;
export const MAX_NODE_SIZE = 220;
export const GRID_TOP_Y = 300;
export const GRID_CELL_X = 260;
export const GRID_CELL_Y = 240;
const KNOWN_ACCENTS = [
    "security",
    "database",
    "complexity",
    "testing",
    "dead_code",
    "coupling_low_level",
    "php_compatibility",
];
const TONE_BY_PRIORITY = [
    { severity: "critical", tone: "critical" },
    { severity: "high", tone: "high" },
    { severity: "medium", tone: "medium" },
    { severity: "low", tone: "low" },
];
export function foldSeverityMix(bySeverity) {
    return {
        high: (bySeverity.high ?? 0) + (bySeverity.critical ?? 0),
        medium: bySeverity.medium ?? 0,
        low: bySeverity.low ?? 0,
    };
}
export function dominantAccent(byCategory) {
    const entries = Object.entries(byCategory);
    if (entries.length === 0) {
        return "mixed";
    }
    const maxWeight = Math.max(...entries.map(([, weight]) => weight));
    const winners = entries.filter(([, weight]) => weight === maxWeight).map(([category]) => category);
    if (winners.length !== 1) {
        return "mixed";
    }
    const [winner] = winners;
    return KNOWN_ACCENTS.includes(winner) ? winner : "mixed";
}
export function toneForSeverity(bySeverity) {
    for (const { severity, tone } of TONE_BY_PRIORITY) {
        if ((bySeverity[severity] ?? 0) > 0) {
            return tone;
        }
    }
    return "none";
}
export function sizeForRisk(risk, maxRisk) {
    if (maxRisk <= 0) {
        return MIN_NODE_SIZE;
    }
    const ratio = Math.log10(1 + risk) / Math.log10(1 + maxRisk);
    const size = Math.round(MIN_NODE_SIZE + (MAX_NODE_SIZE - MIN_NODE_SIZE) * ratio);
    return Math.min(MAX_NODE_SIZE, Math.max(MIN_NODE_SIZE, size));
}
export function overviewPositions(count) {
    return Array.from({ length: count }, (_unused, index) => ({
        x: (index - (count - 1) / 2) * COL_GAP,
        y: ROW_Y,
    }));
}
export function gridPositions(count, columns) {
    const cols = Math.min(columns, Math.max(count, 1));
    return Array.from({ length: count }, (_unused, index) => {
        const column = index % cols;
        const row = Math.floor(index / cols);
        return {
            x: (column - (cols - 1) / 2) * GRID_CELL_X,
            y: GRID_TOP_Y + row * GRID_CELL_Y,
        };
    });
}

// Ciclo de vida de la version: el ciclo mas largo que la contiene por segmentos ("8.3" para 8.3.6).
export function supportStatus(product, version, cycles, today) {
    if (version === null) {
        return null;
    }
    const matching = cycles.filter((cycle) => version === cycle.cycle || version.startsWith(`${cycle.cycle}.`));
    const cycle = matching.sort((a, b) => b.cycle.length - a.cycle.length)[0];
    if (!cycle) {
        return null;
    }
    return { product, cycle: cycle.cycle, eol: cycle.eol, isEol: isPast(cycle.eol, today), latestInCycle: cycle.latest };
}
export function isPast(eol, today) {
    return typeof eol === "string" ? eol <= today : eol;
}

import type { Player } from 'container-engine';

/** Island-only score if the game ended now; never infer a hidden value card. */
export function islandValue(player: Player): number | undefined {
    const values = player.pointCard?.containerValues;
    if (!values) return undefined;
    const counts = new Map<string, number>();
    player.containersOnIsland.forEach(({ color }) => counts.set(color, (counts.get(color) || 0) + 1));
    if (!counts.size) return 0;

    // Match final scoring: discard the most numerous colour, preferring the
    // $5/10 colour on ties, then the lowest base value among the tied colours.
    const most = Math.max(...counts.values());
    const tied = values.filter((value) => counts.get(value.containerColor) === most);
    const discarded =
        tied.find((value) => value === values[1]) ||
        tied.reduce((lowest, value) => (value.baseValue < lowest.baseValue ? value : lowest));
    const completeSet = counts.size === 5;
    return values.reduce(
        (total, value) =>
            total +
            (value === discarded
                ? 0
                : (counts.get(value.containerColor) || 0) * (completeSet ? value.specialValue : value.baseValue)),
        0
    );
}

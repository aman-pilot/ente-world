export const MAX_PLAYER_MARKERS = 4;

// Keep the most front-facing players, with a stable tie-break when they overlap.
// Count your own visible marker toward the cap and ignore off-screen players.
export function visiblePlayerMarkers(candidates, {width, height, ownVisible = false}) {
  return candidates.filter(({p, alpha}) => alpha > .01 && p.x >= 0 && p.x <= width && p.y >= 0 && p.y <= height)
    .sort((a, b) => b.p.face - a.p.face || String(a.player.id).localeCompare(String(b.player.id)))
    .slice(0, MAX_PLAYER_MARKERS - Number(ownVisible));
}

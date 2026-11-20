/** Cycle in the menu's order; an unlisted/custom patch enters at either end. */
export function adjacentPreset(
  options: readonly string[],
  current: string | undefined,
  direction: -1 | 1,
): string | undefined {
  if (options.length === 0) return undefined;
  const index = current === undefined ? -1 : options.indexOf(current);
  if (index < 0) return direction === 1 ? options[0] : options[options.length - 1];
  return options[(index + direction + options.length) % options.length];
}

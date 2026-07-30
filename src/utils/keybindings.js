/**
 * Resolves a KeyboardEvent to an action name ('answer1'..'answer4', 'bossMode', 'pause')
 * based on the user's configured shortcuts, or null if the key doesn't match anything.
 */
export function resolveAction(event, shortcuts) {
  for (const [action, key] of Object.entries(shortcuts)) {
    if (event.key === key) return action;
  }
  return null;
}

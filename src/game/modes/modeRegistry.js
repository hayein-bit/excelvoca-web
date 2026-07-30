// Extension point for future game modes (typing mode, mail-sorting mode, etc).
// Each mode factory must return an object shaped like: { start, nextQuestion, submitAnswer, getRenderState }
const modes = new Map();

export function registerMode(name, factory) {
  modes.set(name, factory);
}

export function getMode(name) {
  const factory = modes.get(name);
  if (!factory) throw new Error(`Unknown game mode: ${name}`);
  return factory;
}

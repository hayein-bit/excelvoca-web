export function createComboState() {
  return { combo: 0, longestCombo: 0 };
}

export function onCorrect(state) {
  state.combo += 1;
  if (state.combo > state.longestCombo) state.longestCombo = state.combo;
  return state;
}

export function onWrong(state) {
  state.combo = 0;
  return state;
}

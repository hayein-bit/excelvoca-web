import { registerMode, getMode } from './modes/modeRegistry.js';
import { createClassicMode } from './modes/classicMode.js';

registerMode('classic', createClassicMode);

/**
 * Thin coordinator around the active game mode: owns the boss-mode flag
 * (Tab toggles it, 1-4 input is ignored while it's on) and exposes a single
 * API surface to the renderer regardless of which mode is active.
 */
export function createGameEngine({ words, progress, modeName = 'classic' }) {
  const mode = getMode(modeName)({ words, progress });
  let bossMode = false;

  function init(restoreState) {
    mode.start(restoreState);
    if (restoreState && typeof restoreState.bossMode === 'boolean') {
      bossMode = restoreState.bossMode;
    }
    return getState();
  }

  function submitAnswer(choiceIndex) {
    if (bossMode) return null;
    return mode.submitAnswer(choiceIndex);
  }

  function submitDontKnow() {
    if (bossMode) return null;
    return mode.submitDontKnow();
  }

  function advance() {
    if (bossMode) return getState();
    mode.nextQuestion();
    return getState();
  }

  function toggleBossMode() {
    bossMode = !bossMode;
    return getState();
  }

  function clearSheet() {
    if (bossMode) return getState();
    mode.resetSheet();
    return getState();
  }

  function getState() {
    return { ...mode.getRenderState(), bossMode };
  }

  return { init, submitAnswer, submitDontKnow, advance, toggleBossMode, clearSheet, getState };
}

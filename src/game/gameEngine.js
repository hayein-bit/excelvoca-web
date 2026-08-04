import { registerMode, getMode } from './modes/modeRegistry.js';
import { createClassicMode } from './modes/classicMode.js';
import { createExampleMode } from './modes/exampleMode.js';
import { createTypingMode } from './modes/typingMode.js';
import { createMatchingMode } from './modes/matchingMode.js';
import { createComboState } from './comboTracker.js';

registerMode('classic', createClassicMode);
registerMode('example', createExampleMode);
registerMode('typing', createTypingMode);
registerMode('matching', createMatchingMode);

/**
 * Thin coordinator around the active game mode: owns the boss-mode flag
 * (Tab toggles it, 1-4 input is ignored while it's on) and exposes a single
 * API surface to the renderer regardless of which mode is active.
 */
export function createGameEngine({ words, progress, modeName = 'classic' }) {
  let currentModeName = modeName;
  // One combo tracker shared by every mode instance, so the current-combo
  // streak carries across a mode switch instead of restarting per mode.
  // Lifetime "position" (카운팅) lives on progress.stats instead (see
  // progressStore.js) for the same reason, since it must also persist to disk.
  const comboState = createComboState();
  function buildMode(name) {
    return getMode(name)({ words, progress, comboState });
  }
  // Each mode's instance (and its closure state: sheet/history/phase) is
  // created once and kept for the engine's lifetime, so switching modes and
  // back doesn't lose an in-progress example question or classic's sheet history.
  const modeInstances = new Map([[modeName, buildMode(modeName)]]);
  let mode = modeInstances.get(modeName);
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

  /** Ends an example-mode question's reading pause and reveals its choices. No-op for modes without it. */
  function revealChoices() {
    if (bossMode) return getState();
    if (mode.revealChoices) mode.revealChoices();
    return getState();
  }

  /**
   * Switches to a different registered mode, e.g. classic <-> example. Only
   * disk persistence is ephemeral (see renderer.js's persistAll) — in memory,
   * each mode's instance is reused, so switching back and forth within the
   * same run preserves that mode's own position/combo/sheet/history exactly
   * as it was left. A mode is only ever `start()`ed once, the first time it's
   * entered.
   */
  function switchMode(name) {
    if (bossMode) return getState();
    currentModeName = name;
    if (!modeInstances.has(name)) {
      const instance = buildMode(name);
      instance.start();
      modeInstances.set(name, instance);
    }
    mode = modeInstances.get(name);
    return getState();
  }

  function getState() {
    return { ...mode.getRenderState(), bossMode, modeName: currentModeName };
  }

  return { init, submitAnswer, submitDontKnow, advance, toggleBossMode, clearSheet, revealChoices, switchMode, getState };
}

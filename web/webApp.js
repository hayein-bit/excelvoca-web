// Everything here is reused unmodified from the desktop app — only the storage
// backend (./githubStorage.js, imported for its window.excelvoca side effect)
// and the UI wiring (no grid/ribbon/Boss Mode, just the quiz + stats panels)
// differ from src/renderer.js.
import './githubStorage.js';
import * as githubStorage from './githubStorage.js';
import { loadWords } from '../src/data/wordRepository.js';
import {
  loadProgress,
  saveProgress,
  countMastered,
  countNeedsReview,
  resetTodayStats,
  resetAllProgress
} from '../src/storage/progressStore.js';
import { loadSession, saveSession, clearSession, hasResumableState } from '../src/storage/sessionStore.js';
import { loadSettings, saveSettings } from '../src/storage/settingsStore.js';
import { upsertDailyLog } from '../src/storage/dailyLogStore.js';
import { createGameEngine } from '../src/game/gameEngine.js';
import { computeRank } from '../src/game/rankSystem.js';
import {
  renderQuestion,
  renderReadingPhase,
  showTranslationReveal,
  markChoiceResult,
  highlightCorrectChoice,
  switchDontKnowToContinue
} from '../src/ui/game/quizPanel.js';
import { renderStats } from '../src/ui/game/statsPanel.js';
import { showResumeDialog } from '../src/ui/dialogs/resumeDialog.js';
import { resolveAction } from '../src/utils/keybindings.js';

const CORRECT_ADVANCE_DELAY_MS = 150;
const WRONG_ADVANCE_DELAY_MS = 1000;

function setConnectStatus(text) {
  const el = document.getElementById('connect-status');
  if (el) el.textContent = text;
}

function showConnectOverlay() {
  const overlay = document.getElementById('connect-overlay');
  const isUnlock = githubStorage.hasStoredToken();
  document.getElementById('token-setup-fields').classList.toggle('hidden', isUnlock);
  document.getElementById('pin-unlock-fields').classList.toggle('hidden', !isUnlock);
  overlay.classList.remove('hidden');

  document.getElementById('connect-btn').addEventListener(
    'click',
    async () => {
      if (isUnlock) {
        const pin = document.getElementById('pin-unlock-input').value.trim();
        const ok = await githubStorage.unlock(pin);
        if (!ok) {
          setConnectStatus('PIN이 틀렸습니다.');
          return;
        }
      } else {
        const token = document.getElementById('token-input').value;
        const pin = document.getElementById('pin-setup-input').value.trim() || '0000';
        if (!token.trim()) {
          setConnectStatus('토큰을 입력해주세요.');
          return;
        }
        await githubStorage.setupToken(token, pin);
      }
      overlay.classList.add('hidden');
      main().catch((err) => {
        setConnectStatus(`오류: ${err.message}`);
        overlay.classList.remove('hidden');
      });
    },
    { once: true }
  );
}

async function boot() {
  if (!githubStorage.isSignedIn()) {
    showConnectOverlay();
    return;
  }

  document.getElementById('connect-overlay').classList.add('hidden');
  try {
    await main();
  } catch (err) {
    setConnectStatus(`오류: ${err.message}`);
    showConnectOverlay();
  }
}

async function main() {
  const [words, progress, session, settings] = await Promise.all([
    loadWords(),
    loadProgress(),
    loadSession(),
    loadSettings()
  ]);

  let restoreState = null;
  if (hasResumableState(session)) {
    if (settings.autoResume) {
      restoreState = session;
    } else {
      const { resume, autoResume } = await showResumeDialog(settings.autoResume);
      if (autoResume !== settings.autoResume) {
        settings.autoResume = autoResume;
        saveSettings(settings);
      }
      if (resume) restoreState = session;
      else await clearSession();
    }
  }

  const engine = createGameEngine({ words, progress });
  engine.init(restoreState);

  // Same input-lock pattern as src/renderer.js — see that file's comment for why.
  let awaitingAdvance = false;
  let pendingContinue = false;
  // Example mode's reading phase: any key/tap reveals the choices for the same question.
  let pendingReveal = false;

  function updateStatsPanel(state) {
    const { todayStudied, todayCorrect } = progress.stats;
    const accuracy = todayStudied > 0 ? Math.round((todayCorrect / todayStudied) * 100) : 0;
    const mastered = countMastered(progress);
    const rank = computeRank(progress, words);

    renderStats({
      accuracy,
      studied: todayStudied,
      combo: state.combo,
      longestCombo: state.longestCombo,
      mastered,
      needsReview: countNeedsReview(progress),
      position: state.position,
      rank
    });
  }

  function renderCurrentQuestion(state) {
    if (!state.question) return;
    document.getElementById('word-display').textContent = state.question.display;
    if (state.modeName === 'example' && state.phase === 'reading') {
      pendingReveal = true;
      renderReadingPhase(state.question, continueToReveal);
    } else {
      pendingReveal = false;
      renderQuestion(state.question, handleChoiceClick, handleDontKnowClick, {
        showSentence: state.modeName === 'example'
      });
    }
    updateStatsPanel(state);
  }

  /** Ends example mode's reading pause and reveals the choices for the same question. */
  function continueToReveal() {
    if (!pendingReveal) return;
    const state = engine.revealChoices();
    renderCurrentQuestion(state);
  }

  /** Toggles classic <-> example, mirroring src/renderer.js's ribbon-button handler. */
  function handleToggleExampleMode() {
    pendingContinue = false;
    pendingReveal = false;
    awaitingAdvance = false;

    const nextModeName = engine.getState().modeName === 'example' ? 'classic' : 'example';
    const state = engine.switchMode(nextModeName);
    document.getElementById('mode-toggle-btn').classList.toggle('active', state.modeName === 'example');
    renderCurrentQuestion(state);
    persistAll();
  }

  function buildDailySummary() {
    const { todayDate, todayStudied, todayCorrect, longestCombo } = progress.stats;
    const accuracy = todayStudied > 0 ? Math.round((todayCorrect / todayStudied) * 100) : 0;
    return {
      date: todayDate,
      studied: todayStudied,
      correct: todayCorrect,
      accuracy,
      longestCombo,
      mastered: countMastered(progress),
      needsReview: countNeedsReview(progress),
      rank: computeRank(progress, words).title
    };
  }

  function persistAll() {
    const state = engine.getState();
    saveProgress(progress);
    // Example mode is ephemeral (see src/renderer.js's persistAll for why) —
    // only classic mode's question/sheet/history is ever saved as the
    // resumable session, so a reload always comes back into classic mode.
    if (state.modeName === 'classic') {
      saveSession({
        question: state.question,
        combo: state.combo,
        longestCombo: state.longestCombo,
        position: state.position,
        cellIndex: state.cellIndex,
        sheetIndex: state.sheetIndex,
        historyBySheet: state.historyBySheet,
        bossMode: false
      });
    }
    upsertDailyLog(buildDailySummary());
  }

  function handleChoiceClick(choiceIndex) {
    if (awaitingAdvance) return;
    const result = engine.submitAnswer(choiceIndex);
    if (!result) return;
    awaitingAdvance = true;

    const state = engine.getState();
    markChoiceResult(result.chosenIndex, result.wasCorrect);
    if (!result.wasCorrect) highlightCorrectChoice(result.correctIndex);
    if (state.modeName === 'example') showTranslationReveal(state.question.exampleKo);
    updateStatsPanel(state);
    persistAll();

    const delay = result.wasCorrect ? CORRECT_ADVANCE_DELAY_MS : WRONG_ADVANCE_DELAY_MS;
    setTimeout(() => {
      const nextState = engine.advance();
      renderCurrentQuestion(nextState);
      persistAll();
      awaitingAdvance = false;
    }, delay);
  }

  function handleDontKnowClick() {
    if (awaitingAdvance) return;
    const result = engine.submitDontKnow();
    if (!result) return;
    awaitingAdvance = true;
    pendingContinue = true;

    const state = engine.getState();
    highlightCorrectChoice(result.correctIndex);
    if (state.modeName === 'example') showTranslationReveal(state.question.exampleKo);
    switchDontKnowToContinue(continueAfterDontKnow);
    updateStatsPanel(state);
    persistAll();
  }

  function continueAfterDontKnow() {
    if (!pendingContinue) return;
    pendingContinue = false;

    const nextState = engine.advance();
    renderCurrentQuestion(nextState);
    persistAll();
    awaitingAdvance = false;
  }

  function handleKeydown(event) {
    const action = resolveAction(event, settings.shortcuts);

    if (pendingReveal) {
      event.preventDefault();
      continueToReveal();
      return;
    }
    if (pendingContinue) {
      event.preventDefault();
      continueAfterDontKnow();
      return;
    }
    if (!action) return;

    if (action.startsWith('answer')) {
      event.preventDefault();
      handleChoiceClick(parseInt(action.replace('answer', ''), 10) - 1);
    } else if (action === 'dontKnow') {
      event.preventDefault();
      handleDontKnowClick();
    }
  }

  function setupManageUI() {
    const overlay = document.getElementById('manage-overlay');
    document.getElementById('manage-btn').addEventListener('click', () => overlay.classList.remove('hidden'));
    document.getElementById('manage-close-btn').addEventListener('click', () => overlay.classList.add('hidden'));

    document.getElementById('reset-today-btn').addEventListener('click', () => {
      if (!confirm('오늘 학습한 단어 수/정답 수를 초기화할까요? (단어별 기록은 그대로 남습니다)')) return;
      resetTodayStats(progress);
      updateStatsPanel(engine.getState());
      persistAll();
      overlay.classList.add('hidden');
    });

    document.getElementById('reset-all-btn').addEventListener('click', () => {
      if (!confirm('정말 전체 학습 기록을 초기화할까요? 모든 단어의 정답/오답/스트릭이 사라지고 되돌릴 수 없습니다.')) return;
      resetAllProgress(progress);
      updateStatsPanel(engine.getState());
      persistAll();
      overlay.classList.add('hidden');
    });
  }

  setupManageUI();
  document.getElementById('mode-toggle-btn').addEventListener('click', handleToggleExampleMode);
  renderCurrentQuestion(engine.getState());
  persistAll();
  window.addEventListener('keydown', handleKeydown);
}

boot();

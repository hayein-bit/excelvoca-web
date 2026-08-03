import { loadWords } from './data/wordRepository.js';
import {
  loadProgress,
  saveProgress,
  countMastered,
  countNeedsReview,
  resetTodayStats,
  resetAllProgress
} from './storage/progressStore.js';
import { loadSession, saveSession, clearSession, hasResumableState } from './storage/sessionStore.js';
import { loadSettings, saveSettings } from './storage/settingsStore.js';
import { upsertDailyLog } from './storage/dailyLogStore.js';
import { createGameEngine } from './game/gameEngine.js';
import { computeRank } from './game/rankSystem.js';
import { initGrid, nextWordCellPosition, EXAMPLE_WORDS_PER_ROW } from './ui/excelShell/grid.js';
import { initRibbon, setExampleModeActive } from './ui/excelShell/ribbon.js';
import { initSheetTabs, setActiveSheetTab } from './ui/excelShell/sheetTabs.js';
import { setStatusLeft, setStatusRight } from './ui/excelShell/statusBar.js';
import {
  renderQuestion,
  renderReadingPhase,
  showTranslationReveal,
  markChoiceResult,
  highlightCorrectChoice,
  switchDontKnowToContinue
} from './ui/game/quizPanel.js';
import { renderStats } from './ui/game/statsPanel.js';
import { showWordInCell, showAnswerFeedback, replayHistory } from './ui/game/feedback.js';
import { enterBossMode, exitBossMode } from './ui/bossMode/bossMode.js';
import { showResumeDialog } from './ui/dialogs/resumeDialog.js';
import { showManageDialog } from './ui/dialogs/manageDialog.js';
import { resolveAction } from './utils/keybindings.js';

const CORRECT_ADVANCE_DELAY_MS = 150;
const WRONG_ADVANCE_DELAY_MS = 1000;

/** Example mode's sentences get one per row instead of classic's 5-across (see grid.js). */
function wordsPerRowFor(state) {
  return state.modeName === 'example' ? EXAMPLE_WORDS_PER_ROW : undefined;
}

function cellPositionFor(state) {
  return nextWordCellPosition(state.cellIndex, wordsPerRowFor(state));
}

async function main() {
  initRibbon({
    onClearSheet: handleClearSheet,
    onManageWorkbook: handleManageWorkbook,
    onToggleExampleMode: handleToggleExampleMode
  });
  initSheetTabs(handleSheetTabClick);
  const grid = initGrid();
  setStatusLeft('준비');

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
      if (resume) {
        restoreState = session;
      } else {
        await clearSession();
      }
    }
  }

  const engine = createGameEngine({ words, progress });
  engine.init(restoreState);

  // While an answer's feedback is on screen (up to WRONG_ADVANCE_DELAY_MS), further
  // answer input is ignored — otherwise rapid key-mashing during that window submits
  // multiple answers for the same still-current question before it advances.
  let awaitingAdvance = false;
  // After "모르겠다", the meaning stays up until the user presses something —
  // handleKeydown treats any key as "continue" while this is true.
  let pendingContinue = false;
  // Example mode's reading phase: the sentence is up with no choices yet, and
  // handleKeydown treats any key as "reveal the choices" while this is true.
  let pendingReveal = false;
  // Tracks which sheet tab is currently drawn, so renderCurrentQuestion can tell
  // when classicMode has advanced to a new sheet and needs to clear the grid first.
  let lastRenderedSheetIndex = null;
  // True while the grid is showing a non-live sheet's archived history (the user
  // clicked an old tab) — game input is blocked until they click back to the live tab.
  let viewingArchivedSheet = false;

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

    setStatusRight(`${rank.title} · Combo x${state.combo}`);
  }

  /**
   * Example mode's questions have a reading phase (sentence only, no choices
   * yet) before the choices phase — classic mode's `state.phase` is always
   * undefined, so it always takes the normal `renderQuestion` branch.
   */
  function renderQuizPanelForState(state) {
    if (state.modeName === 'example' && state.phase === 'reading') {
      pendingReveal = true;
      renderReadingPhase(state.question, continueToReveal);
    } else {
      pendingReveal = false;
      renderQuestion(state.question, handleChoiceClick, handleDontKnowClick, {
        showSentence: state.modeName === 'example'
      });
    }
  }

  function renderCurrentQuestion(state) {
    if (state.bossMode || !state.question) return;

    // Sheet changed since the last render (filled up, or manually cleared) —
    // wipe the grid, switch tabs, and redraw that (now-live) sheet's own
    // history before placing the current question.
    if (lastRenderedSheetIndex !== null && state.sheetIndex !== lastRenderedSheetIndex) {
      grid.clearAllCells();
      setActiveSheetTab(state.sheetIndex);
      replayHistory(grid, state.historyBySheet[state.sheetIndex] || [], wordsPerRowFor(state));
    }
    lastRenderedSheetIndex = state.sheetIndex;
    viewingArchivedSheet = false;

    const cellPos = cellPositionFor(state);
    showWordInCell(grid, cellPos, state.question.display);
    renderQuizPanelForState(state);
    updateStatsPanel(state);
  }

  /** Ends example mode's reading pause and reveals the choices for the same question. */
  function continueToReveal() {
    if (!pendingReveal) return;
    const state = engine.revealChoices();
    renderCurrentQuestion(state);
  }

  /** Sheet tab click: browse an old sheet's history (read-only) or return to the live one. */
  function handleSheetTabClick(sheetIndexStr) {
    const state = engine.getState();
    if (state.bossMode) return;

    const clickedIndex = parseInt(sheetIndexStr, 10);
    grid.clearAllCells();
    setActiveSheetTab(clickedIndex);
    replayHistory(grid, state.historyBySheet[clickedIndex] || [], wordsPerRowFor(state));
    lastRenderedSheetIndex = clickedIndex;

    if (clickedIndex === state.sheetIndex) {
      viewingArchivedSheet = false;
      const cellPos = cellPositionFor(state);
      showWordInCell(grid, cellPos, state.question.display);
      renderQuizPanelForState(state);
      updateStatsPanel(state);
    } else {
      viewingArchivedSheet = true;
    }
  }

  function buildDailySummary() {
    const { todayDate, todayStudied, todayCorrect, longestCombo } = progress.stats;
    const accuracy = todayStudied > 0 ? Math.round((todayCorrect / todayStudied) * 100) : 0;
    const mastered = countMastered(progress);
    const needsReview = countNeedsReview(progress);
    const rank = computeRank(progress, words);

    return {
      date: todayDate,
      studied: todayStudied,
      correct: todayCorrect,
      accuracy,
      longestCombo,
      mastered,
      needsReview,
      rank: rank.title
    };
  }

  function persistAll() {
    const state = engine.getState();
    saveProgress(progress);
    // Example mode is ephemeral (like Boss Mode) — only classic mode's question/
    // sheet/history is ever saved as the resumable session, so restart always
    // comes back into classic mode rather than mid-sentence in example mode.
    if (state.modeName === 'classic') {
      saveSession({
        question: state.question,
        combo: state.combo,
        longestCombo: state.longestCombo,
        position: state.position,
        cellIndex: state.cellIndex,
        sheetIndex: state.sheetIndex,
        historyBySheet: state.historyBySheet,
        bossMode: state.bossMode
      });
    }
    upsertDailyLog(buildDailySummary());
  }

  function handleChoiceClick(choiceIndex) {
    const preState = engine.getState();
    if (preState.bossMode || awaitingAdvance || viewingArchivedSheet) return;

    const result = engine.submitAnswer(choiceIndex);
    if (!result) return;
    awaitingAdvance = true;

    const state = engine.getState();
    const cellPos = cellPositionFor(state);
    showAnswerFeedback(grid, cellPos, state.question.display, result.wasCorrect, result.answerText);
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
    const preState = engine.getState();
    if (preState.bossMode || awaitingAdvance || viewingArchivedSheet) return;

    const result = engine.submitDontKnow();
    if (!result) return;
    awaitingAdvance = true;
    pendingContinue = true;

    const state = engine.getState();
    const cellPos = cellPositionFor(state);
    showAnswerFeedback(grid, cellPos, state.question.display, false, result.answerText);
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

  /** "지우기" ribbon button: manually clear the active sheet and move to the next tab. */
  function handleClearSheet() {
    const preState = engine.getState();
    if (preState.bossMode) return;
    pendingContinue = false;
    pendingReveal = false;
    awaitingAdvance = false;

    const state = engine.clearSheet();
    renderCurrentQuestion(state);
    persistAll();
  }

  /** "예문 모드" ribbon button: toggles classic <-> example. Ephemeral, like Boss Mode — no resume state either way. */
  function handleToggleExampleMode() {
    const preState = engine.getState();
    if (preState.bossMode) return;
    pendingContinue = false;
    pendingReveal = false;
    awaitingAdvance = false;
    viewingArchivedSheet = false;

    const nextModeName = preState.modeName === 'example' ? 'classic' : 'example';
    const state = engine.switchMode(nextModeName);
    setExampleModeActive(state.modeName === 'example');

    grid.clearAllCells();
    lastRenderedSheetIndex = state.sheetIndex;
    setActiveSheetTab(state.sheetIndex);
    replayHistory(grid, state.historyBySheet[state.sheetIndex] || [], wordsPerRowFor(state));
    renderCurrentQuestion(state);
    persistAll();
  }

  /** "파일" ribbon tab's "통합 문서 관리" button: the desktop equivalent of the web app's 기록 관리 dialog. */
  function handleManageWorkbook() {
    if (engine.getState().bossMode) return;
    showManageDialog({
      onResetToday: () => {
        resetTodayStats(progress);
        updateStatsPanel(engine.getState());
        persistAll();
      },
      onResetAll: () => {
        resetAllProgress(progress);
        updateStatsPanel(engine.getState());
        persistAll();
      }
    });
  }

  function toggleBossMode() {
    const state = engine.toggleBossMode();
    if (state.bossMode) {
      enterBossMode(grid);
    } else {
      exitBossMode(grid, () => {
        const restored = engine.getState();
        viewingArchivedSheet = false;
        setActiveSheetTab(restored.sheetIndex);
        replayHistory(grid, restored.historyBySheet[restored.sheetIndex] || [], wordsPerRowFor(restored));
        renderCurrentQuestion(restored);
      });
    }
    persistAll();
  }

  function handleKeydown(event) {
    const action = resolveAction(event, settings.shortcuts);

    if (action === 'bossMode') {
      event.preventDefault();
      toggleBossMode();
      return;
    }

    if (engine.getState().bossMode) return;

    // Let Ctrl/Cmd shortcuts (e.g. copying a cell selection) through untouched.
    if (event.ctrlKey || event.metaKey) return;

    // Browsing an old sheet's history — click back to the live tab to keep playing.
    if (viewingArchivedSheet) return;

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
      const choiceIndex = parseInt(action.replace('answer', ''), 10) - 1;
      handleChoiceClick(choiceIndex);
    } else if (action === 'dontKnow') {
      event.preventDefault();
      handleDontKnowClick();
    }
  }

  const initialState = engine.getState();
  // Set this before the first renderCurrentQuestion() call so it doesn't see a
  // "sheet changed" mismatch and clear the cells replayHistory() just drew.
  lastRenderedSheetIndex = initialState.sheetIndex;
  setActiveSheetTab(initialState.sheetIndex);
  replayHistory(grid, initialState.historyBySheet[initialState.sheetIndex] || [], wordsPerRowFor(initialState));
  renderCurrentQuestion(initialState);
  persistAll();

  window.addEventListener('keydown', handleKeydown);
}

main();

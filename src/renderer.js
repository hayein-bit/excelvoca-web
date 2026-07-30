import { loadWords } from './data/wordRepository.js';
import { loadProgress, saveProgress, countMastered, countNeedsReview } from './storage/progressStore.js';
import { loadSession, saveSession, clearSession, hasResumableState } from './storage/sessionStore.js';
import { loadSettings, saveSettings } from './storage/settingsStore.js';
import { upsertDailyLog } from './storage/dailyLogStore.js';
import { createGameEngine } from './game/gameEngine.js';
import { computeRank } from './game/rankSystem.js';
import { initGrid, nextWordCellPosition } from './ui/excelShell/grid.js';
import { initRibbon } from './ui/excelShell/ribbon.js';
import { initSheetTabs, setActiveSheetTab } from './ui/excelShell/sheetTabs.js';
import { setStatusLeft, setStatusRight } from './ui/excelShell/statusBar.js';
import {
  renderQuestion,
  markChoiceResult,
  highlightCorrectChoice,
  switchDontKnowToContinue
} from './ui/game/quizPanel.js';
import { renderStats } from './ui/game/statsPanel.js';
import { showWordInCell, showAnswerFeedback, replayHistory } from './ui/game/feedback.js';
import { enterBossMode, exitBossMode } from './ui/bossMode/bossMode.js';
import { showResumeDialog } from './ui/dialogs/resumeDialog.js';
import { resolveAction } from './utils/keybindings.js';

const CORRECT_ADVANCE_DELAY_MS = 150;
const WRONG_ADVANCE_DELAY_MS = 1000;

async function main() {
  initRibbon({ onClearSheet: handleClearSheet });
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

  function renderCurrentQuestion(state) {
    if (state.bossMode || !state.question) return;

    // Sheet changed since the last render (filled up, or manually cleared) —
    // wipe the grid, switch tabs, and redraw that (now-live) sheet's own
    // history before placing the current question.
    if (lastRenderedSheetIndex !== null && state.sheetIndex !== lastRenderedSheetIndex) {
      grid.clearAllCells();
      setActiveSheetTab(state.sheetIndex);
      replayHistory(grid, state.historyBySheet[state.sheetIndex] || []);
    }
    lastRenderedSheetIndex = state.sheetIndex;
    viewingArchivedSheet = false;

    const cellPos = nextWordCellPosition(state.cellIndex);
    showWordInCell(grid, cellPos, state.question.display);
    renderQuestion(state.question, handleChoiceClick, handleDontKnowClick);
    updateStatsPanel(state);
  }

  /** Sheet tab click: browse an old sheet's history (read-only) or return to the live one. */
  function handleSheetTabClick(sheetIndexStr) {
    const state = engine.getState();
    if (state.bossMode) return;

    const clickedIndex = parseInt(sheetIndexStr, 10);
    grid.clearAllCells();
    setActiveSheetTab(clickedIndex);
    replayHistory(grid, state.historyBySheet[clickedIndex] || []);
    lastRenderedSheetIndex = clickedIndex;

    if (clickedIndex === state.sheetIndex) {
      viewingArchivedSheet = false;
      const cellPos = nextWordCellPosition(state.cellIndex);
      showWordInCell(grid, cellPos, state.question.display);
      renderQuestion(state.question, handleChoiceClick, handleDontKnowClick);
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
    upsertDailyLog(buildDailySummary());
  }

  function handleChoiceClick(choiceIndex) {
    const preState = engine.getState();
    if (preState.bossMode || awaitingAdvance || viewingArchivedSheet) return;

    const result = engine.submitAnswer(choiceIndex);
    if (!result) return;
    awaitingAdvance = true;

    const state = engine.getState();
    const cellPos = nextWordCellPosition(state.cellIndex);
    showAnswerFeedback(grid, cellPos, state.question.display, result.wasCorrect, result.answerText);
    markChoiceResult(result.chosenIndex, result.wasCorrect);
    if (!result.wasCorrect) highlightCorrectChoice(result.correctIndex);
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
    const cellPos = nextWordCellPosition(state.cellIndex);
    showAnswerFeedback(grid, cellPos, state.question.display, false, result.answerText);
    highlightCorrectChoice(result.correctIndex);
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
    awaitingAdvance = false;

    const state = engine.clearSheet();
    renderCurrentQuestion(state);
    persistAll();
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
        replayHistory(grid, restored.historyBySheet[restored.sheetIndex] || []);
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
  replayHistory(grid, initialState.historyBySheet[initialState.sheetIndex] || []);
  renderCurrentQuestion(initialState);
  persistAll();

  window.addEventListener('keydown', handleKeydown);
}

main();

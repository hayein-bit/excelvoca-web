import { pickNext } from '../spacedRepetition.js';
import { buildTypingQuestion } from '../questionFactory.js';
import { onCorrect, onWrong } from '../comboTracker.js';
import { recordAnswer } from '../../storage/progressStore.js';
import { CELLS_PER_SHEET } from '../../ui/excelShell/grid.js';

/**
 * Typing mode: the Korean meaning is shown in the cell (short text, same
 * 5-across layout as classic mode) and the user types the English word/phrase
 * themselves instead of picking from choices — active recall instead of
 * recognition. `submitAnswer` takes the typed string directly, not an index.
 * Mode switching is ephemeral (like example mode) — `start()` always begins
 * a fresh question, there's no saved-session resume for this mode.
 */
const MAX_HISTORY = CELLS_PER_SHEET;
const TOTAL_SHEETS = 3;

export function createTypingMode({ words, progress, comboState }) {
  let cellIndex = 0; // 1-based slot of currentQuestion on the active sheet
  let sheetIndex = 0;
  let currentQuestion = null;
  let historyBySheet = Array.from({ length: TOTAL_SHEETS }, () => []);

  function currentHistory() {
    return historyBySheet[sheetIndex];
  }

  function nextQuestion() {
    const word = pickNext(words, progress, currentQuestion ? currentQuestion.key : null);
    currentQuestion = buildTypingQuestion(word);
    progress.stats.position = (progress.stats.position || 0) + 1;

    if (cellIndex >= CELLS_PER_SHEET) {
      cellIndex = 0;
      sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
      historyBySheet[sheetIndex] = [];
    }
    cellIndex += 1;

    return getRenderState();
  }

  /** Manual "지우기": clears the active sheet and moves the current question to its first cell. */
  function resetSheet() {
    cellIndex = 1;
    sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
    historyBySheet[sheetIndex] = [];
    return getRenderState();
  }

  function start() {
    nextQuestion();
    return getRenderState();
  }

  /** `typedText` is the raw string the user typed — compared trimmed and case-insensitive. */
  function submitAnswer(typedText) {
    if (!currentQuestion) return null;
    const wasCorrect = (typedText || '').trim().toLowerCase() === currentQuestion.correctAnswer.trim().toLowerCase();

    if (wasCorrect) onCorrect(comboState);
    else onWrong(comboState);

    recordAnswer(progress, currentQuestion.key, wasCorrect, comboState.combo);

    const answerText = currentQuestion.correctAnswer;
    const history = currentHistory();
    history.push({ cellIndex, display: currentQuestion.display, wasCorrect, dontKnow: false, answerText });
    if (history.length > MAX_HISTORY) history.shift();

    return {
      wasCorrect,
      typedText,
      dontKnow: false,
      answerText,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo
    };
  }

  /** "모르겠다" — always counted as a miss, but tagged separately so it's prioritized again later. */
  function submitDontKnow() {
    if (!currentQuestion) return null;

    onWrong(comboState);
    recordAnswer(progress, currentQuestion.key, false, comboState.combo, { dontKnow: true });

    const answerText = currentQuestion.correctAnswer;
    const history = currentHistory();
    history.push({ cellIndex, display: currentQuestion.display, wasCorrect: false, dontKnow: true, answerText });
    if (history.length > MAX_HISTORY) history.shift();

    return {
      wasCorrect: false,
      dontKnow: true,
      answerText,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo
    };
  }

  function getRenderState() {
    return {
      question: currentQuestion,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo,
      position: progress.stats.position || 0,
      cellIndex,
      sheetIndex,
      historyBySheet
    };
  }

  return { start, nextQuestion, submitAnswer, submitDontKnow, resetSheet, getRenderState };
}

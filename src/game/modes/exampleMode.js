import { pickNext } from '../spacedRepetition.js';
import { buildExampleQuestion } from '../questionFactory.js';
import { onCorrect, onWrong } from '../comboTracker.js';
import { recordAnswer } from '../../storage/progressStore.js';
import { EXAMPLE_CELLS_PER_SHEET } from '../../ui/excelShell/grid.js';

/**
 * Example mode: shows a full English example sentence instead of the bare
 * word, and asks for the target word's Korean meaning. Each question has two
 * phases — the sentence appears alone first (`phase: 'reading'`, no choices,
 * self-paced so the user can interpret it before checking), then
 * `revealChoices()` flips to `phase: 'choices'` once they're ready to answer.
 * Progress is recorded on the same `key` as classic mode, so mastery/streak/
 * combo are shared across both modes for the same word sense. Mode switching
 * is ephemeral (like Boss Mode) — `start()` always begins a fresh question,
 * there's no saved-session resume for this mode.
 *
 * Sentences are one-per-row in the grid (see EXAMPLE_CELLS_PER_SHEET/
 * EXAMPLE_WORDS_PER_ROW in grid.js) instead of classic mode's 5-across, since
 * a full sentence needs the room a bare word doesn't.
 */
const MAX_HISTORY = EXAMPLE_CELLS_PER_SHEET;
const TOTAL_SHEETS = 3;

export function createExampleMode({ words, progress, comboState }) {
  // Only words with both an English example and its Korean translation can be
  // quizzed here — skips any future word added before it's translated.
  const pool = words.filter((w) => w.example && w.exampleKo);

  let cellIndex = 0; // 1-based slot of currentQuestion on the active sheet
  let sheetIndex = 0;
  let currentQuestion = null;
  let phase = 'reading';
  let historyBySheet = Array.from({ length: TOTAL_SHEETS }, () => []);

  function currentHistory() {
    return historyBySheet[sheetIndex];
  }

  function nextQuestion() {
    const word = pickNext(pool, progress, currentQuestion ? currentQuestion.key : null);
    currentQuestion = buildExampleQuestion(word);
    phase = 'reading';
    // Lifetime "카운팅" count — shared with classic mode via progress.stats
    // (see gameEngine.js), not a per-mode local variable.
    progress.stats.position = (progress.stats.position || 0) + 1;

    if (cellIndex >= EXAMPLE_CELLS_PER_SHEET) {
      cellIndex = 0;
      sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
      historyBySheet[sheetIndex] = [];
    }
    cellIndex += 1;

    return getRenderState();
  }

  /** Ends the reading pause and shows the 4 meaning choices for the same question. */
  function revealChoices() {
    phase = 'choices';
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

  function submitAnswer(choiceIndex) {
    if (!currentQuestion || phase !== 'choices') return null;
    const wasCorrect = choiceIndex === currentQuestion.correctIndex;

    if (wasCorrect) onCorrect(comboState);
    else onWrong(comboState);

    recordAnswer(progress, currentQuestion.key, wasCorrect, comboState.combo);

    const answerText = currentQuestion.choices[currentQuestion.correctIndex];
    const history = currentHistory();
    history.push({ cellIndex, display: currentQuestion.display, wasCorrect, dontKnow: false, answerText });
    if (history.length > MAX_HISTORY) history.shift();

    return {
      wasCorrect,
      correctIndex: currentQuestion.correctIndex,
      chosenIndex: choiceIndex,
      dontKnow: false,
      answerText,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo
    };
  }

  /** "모르겠다" — always counted as a miss, but tagged separately so it's prioritized again later. */
  function submitDontKnow() {
    if (!currentQuestion || phase !== 'choices') return null;

    onWrong(comboState);
    recordAnswer(progress, currentQuestion.key, false, comboState.combo, { dontKnow: true });

    const answerText = currentQuestion.choices[currentQuestion.correctIndex];
    const history = currentHistory();
    history.push({ cellIndex, display: currentQuestion.display, wasCorrect: false, dontKnow: true, answerText });
    if (history.length > MAX_HISTORY) history.shift();

    return {
      wasCorrect: false,
      correctIndex: currentQuestion.correctIndex,
      chosenIndex: null,
      dontKnow: true,
      answerText,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo
    };
  }

  function getRenderState() {
    return {
      question: currentQuestion,
      phase,
      combo: comboState.combo,
      longestCombo: comboState.longestCombo,
      position: progress.stats.position || 0,
      cellIndex,
      sheetIndex,
      historyBySheet
    };
  }

  return { start, nextQuestion, submitAnswer, submitDontKnow, resetSheet, getRenderState, revealChoices };
}

import { pickNext } from '../spacedRepetition.js';
import { buildQuestion } from '../questionFactory.js';
import { onCorrect, onWrong } from '../comboTracker.js';
import { recordAnswer } from '../../storage/progressStore.js';
import { CELLS_PER_SHEET } from '../../ui/excelShell/grid.js';

/**
 * The MVP game mode: one word per active cell, four multiple-choice meanings,
 * answer with keys 1-4. Implements the shared mode interface (start /
 * nextQuestion / submitAnswer / getRenderState) so future modes can be
 * registered alongside it without touching the engine or the grid.
 */
// A sheet holds at most CELLS_PER_SHEET answered cells before it's cleared and
// play moves to the next sheet tab, so history never needs to outlive one sheet.
const MAX_HISTORY = CELLS_PER_SHEET;

// How many sheet tabs to cycle through (matches the static tabs in index.html).
const TOTAL_SHEETS = 3;

// How often a question flips to "see the meaning, pick the English word" instead of the usual direction.
const REVERSE_PROBABILITY = 0.3;

export function createClassicMode({ words, progress, comboState }) {
  let cellIndex = 0; // 1-based slot of currentQuestion on the active sheet
  let sheetIndex = 0;
  let currentQuestion = null;
  // One history bucket per sheet tab, so switching tabs can redraw what was
  // actually on that sheet instead of losing it when play moves to the next one.
  let historyBySheet = Array.from({ length: TOTAL_SHEETS }, () => []);

  function currentHistory() {
    return historyBySheet[sheetIndex];
  }

  function nextQuestion() {
    const word = pickNext(words, progress, currentQuestion ? currentQuestion.key : null);
    // Direction is purely random every time, regardless of how many times this
    // word's been answered correctly before — no forced-reverse escalation.
    const reverse = Math.random() < REVERSE_PROBABILITY;
    currentQuestion = buildQuestion(word, { reverse });
    // Lifetime "카운팅" count — shared with example mode via progress.stats
    // (see gameEngine.js), not a per-mode local variable.
    progress.stats.position = (progress.stats.position || 0) + 1;

    // The sheet is full — move to the next tab and start filling it from its
    // first cell. That tab's own history from last time around (if any) is
    // discarded since it's about to be overwritten; the sheet we're leaving
    // keeps its history so switching back to it still shows what was there.
    if (cellIndex >= CELLS_PER_SHEET) {
      cellIndex = 0;
      sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
      historyBySheet[sheetIndex] = [];
    }
    cellIndex += 1;

    return getRenderState();
  }

  /** Manual "시트 초기화": clears the active sheet and moves the current question to its first cell. */
  function resetSheet() {
    cellIndex = 1;
    sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
    historyBySheet[sheetIndex] = [];
    return getRenderState();
  }

  function start(restoreState) {
    if (restoreState && restoreState.question) {
      comboState.combo = restoreState.combo || 0;
      comboState.longestCombo = restoreState.longestCombo || 0;
      // One-time migration: older sessions tracked "카운팅" in session.json;
      // adopt it into the shared progress.stats.position if that isn't set yet.
      if (!progress.stats.position && restoreState.position) {
        progress.stats.position = restoreState.position;
      }
      // Fall back to `position` for session files saved before cellIndex existed,
      // so an old resumable session doesn't land on the invalid slot 0.
      cellIndex = restoreState.cellIndex || restoreState.position || 1;
      sheetIndex = restoreState.sheetIndex || 0;
      if (restoreState.historyBySheet) {
        historyBySheet = restoreState.historyBySheet;
      } else if (restoreState.history) {
        // Session saved before per-sheet history existed — park it on the
        // sheet it belongs to instead of discarding it.
        historyBySheet[sheetIndex] = restoreState.history;
      }

      // The saved question is a snapshot, not a live reference — if that word
      // was since removed from the CSV, restoring it verbatim would show a
      // question for a word that no longer exists. Skip straight to a fresh one.
      const stillExists = words.some((w) => w.key === restoreState.question.key);
      if (stillExists) {
        currentQuestion = restoreState.question;
      } else {
        nextQuestion();
      }
    } else {
      nextQuestion();
    }
    return getRenderState();
  }

  function submitAnswer(choiceIndex) {
    if (!currentQuestion) return null;
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
    if (!currentQuestion) return null;

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

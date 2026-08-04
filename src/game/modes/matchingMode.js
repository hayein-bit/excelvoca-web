import { pickNext } from '../spacedRepetition.js';
import { formatDisplay } from '../../data/wordRepository.js';
import { shuffle } from '../../utils/shuffle.js';
import { onCorrect, onWrong } from '../comboTracker.js';
import { recordAnswer } from '../../storage/progressStore.js';
import { CELLS_PER_SHEET, WORDS_PER_ROW } from '../../ui/excelShell/grid.js';

/**
 * Matching mode: each round deals `ROUND_SIZE` distinct words as two
 * independently-shuffled lists — English forms in `left` (shown in grid
 * cells) and Korean meanings in `right` (shown as clickable panel rows).
 * `submitAnswer({ side, index })` records a pending selection on that side;
 * once both sides have one, they're compared by the underlying word `key`.
 * There's no single "current question" the way other modes have one — the
 * whole round is the unit, so `question` is always null here and the
 * renderer must branch on `modeName === 'matching'` before touching it.
 * Ephemeral like example/typing mode — no saved-session resume.
 */
const ROUND_SIZE = WORDS_PER_ROW;
const TOTAL_SHEETS = 3;
const MAX_PICK_ATTEMPTS = 200;

export function createMatchingMode({ words, progress, comboState }) {
  let cellIndex = 0; // 1-based start of the CURRENT round's row of ROUND_SIZE cells
  let sheetIndex = 0;
  let left = []; // [{ key, text, matched }], shuffled independently of `right`
  let right = [];
  let pendingLeft = null;
  let pendingRight = null;
  let historyBySheet = Array.from({ length: TOTAL_SHEETS }, () => []);

  function currentHistory() {
    return historyBySheet[sheetIndex];
  }

  /** Picks ROUND_SIZE distinct words with no two sharing a meaning (would make two right-side rows identical/ambiguous). */
  function pickRoundWords() {
    const chosen = [];
    const usedKeys = new Set();
    const usedMeanings = new Set();
    let attempts = 0;
    while (chosen.length < ROUND_SIZE && attempts < MAX_PICK_ATTEMPTS) {
      attempts++;
      const word = pickNext(words, progress, chosen.length ? chosen[chosen.length - 1].key : null);
      if (usedKeys.has(word.key) || usedMeanings.has(word.meaning)) continue;
      usedKeys.add(word.key);
      usedMeanings.add(word.meaning);
      chosen.push(word);
    }
    // Fallback if the pool is too small/repetitive to fill a round by rejection sampling.
    if (chosen.length < ROUND_SIZE) {
      for (const word of words) {
        if (chosen.length >= ROUND_SIZE) break;
        if (usedKeys.has(word.key) || usedMeanings.has(word.meaning)) continue;
        usedKeys.add(word.key);
        usedMeanings.add(word.meaning);
        chosen.push(word);
      }
    }
    return chosen;
  }

  function nextQuestion() {
    const roundWords = pickRoundWords();
    left = shuffle(roundWords.map((w) => ({ key: w.key, text: formatDisplay(w), matched: false })));
    right = shuffle(roundWords.map((w) => ({ key: w.key, text: w.meaning, matched: false })));
    pendingLeft = null;
    pendingRight = null;
    // Each round is one full row's worth of "questions" for the lifetime counter.
    progress.stats.position = (progress.stats.position || 0) + ROUND_SIZE;

    if (cellIndex >= CELLS_PER_SHEET) {
      cellIndex = 0;
      sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
      historyBySheet[sheetIndex] = [];
    }
    cellIndex += ROUND_SIZE;

    return getRenderState();
  }

  /** Manual "지우기": abandons the current round and moves to the next sheet's first row. */
  function resetSheet() {
    cellIndex = ROUND_SIZE;
    sheetIndex = (sheetIndex + 1) % TOTAL_SHEETS;
    historyBySheet[sheetIndex] = [];
    return getRenderState();
  }

  function start() {
    nextQuestion();
    return getRenderState();
  }

  /** `payload` is `{ side: 'left'|'right', index }` — an index into that side's shuffled array. */
  function submitAnswer(payload) {
    if (!payload || left.length === 0) return null;
    const { side, index } = payload;
    const items = side === 'left' ? left : right;
    if (!items[index] || items[index].matched) return null;

    if (side === 'left') pendingLeft = index;
    else pendingRight = index;

    if (pendingLeft === null || pendingRight === null) {
      return { evaluated: false };
    }

    const leftItem = left[pendingLeft];
    const rightItem = right[pendingRight];
    const wasCorrect = leftItem.key === rightItem.key;
    const evaluatedLeft = pendingLeft;
    const evaluatedRight = pendingRight;

    if (wasCorrect) onCorrect(comboState);
    else onWrong(comboState);
    recordAnswer(progress, leftItem.key, wasCorrect, comboState.combo);

    if (wasCorrect) {
      leftItem.matched = true;
      rightItem.matched = true;
      const history = currentHistory();
      history.push({
        cellIndex: cellIndex - ROUND_SIZE + 1 + evaluatedLeft,
        display: leftItem.text,
        wasCorrect: true,
        dontKnow: false,
        answerText: rightItem.text
      });
    }

    pendingLeft = null;
    pendingRight = null;

    return {
      evaluated: true,
      wasCorrect,
      leftIndex: evaluatedLeft,
      rightIndex: evaluatedRight,
      answerText: rightItem.text,
      roundComplete: left.every((it) => it.matched),
      combo: comboState.combo,
      longestCombo: comboState.longestCombo
    };
  }

  /** Not applicable to a batch-matching round — no single "current question" to give up on. */
  function submitDontKnow() {
    return null;
  }

  function getRenderState() {
    return {
      question: null,
      left,
      right,
      pendingLeft,
      pendingRight,
      roundComplete: left.length > 0 && left.every((it) => it.matched),
      combo: comboState.combo,
      longestCombo: comboState.longestCombo,
      position: progress.stats.position || 0,
      cellIndex,
      // 1-based cell position of left[0] — left[i] lives at roundStartCellIndex + i.
      roundStartCellIndex: cellIndex - ROUND_SIZE + 1,
      sheetIndex,
      historyBySheet
    };
  }

  return { start, nextQuestion, submitAnswer, submitDontKnow, resetSheet, getRenderState };
}

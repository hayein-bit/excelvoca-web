import { setFormulaValue } from '../excelShell/formulaBar.js';
import { nextWordCellPosition } from '../excelShell/grid.js';

/** Places the current word (as "word (pos)") into its grid cell and selects it. */
export function showWordInCell(grid, cellPos, displayText) {
  grid.selectCell(cellPos.col, cellPos.row);
  grid.setCellText(cellPos.col, cellPos.row, displayText);
  setFormulaValue(displayText);
}

/**
 * Colors the word cell green (correct) or red (wrong/don't-know) — no separate
 * status tag — and writes the correct answer, plain/uncolored, into the cell
 * directly below it.
 */
export function showAnswerFeedback(grid, cellPos, displayText, wasCorrect, answerText) {
  const stateClass = wasCorrect ? 'correct' : 'wrong';
  grid.setCellText(cellPos.col, cellPos.row, displayText, stateClass);
  if (answerText) grid.setCellText(cellPos.col, cellPos.answerRow, answerText);
}

/**
 * Redraws every answered cell from `history` — used after Boss Mode / on resume.
 * `wordsPerRow` must match whichever mode's history this is (classic's 5-across
 * vs example mode's one-per-row), or cells will land in the wrong place.
 */
export function replayHistory(grid, history, wordsPerRow) {
  history.forEach(({ cellIndex, display, wasCorrect, answerText }) => {
    const cellPos = nextWordCellPosition(cellIndex, wordsPerRow);
    showAnswerFeedback(grid, cellPos, display, wasCorrect, answerText);
  });
}

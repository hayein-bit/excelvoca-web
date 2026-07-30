import { renderFakeSheet, updateClockCell } from './fakeData.js';
import { setFormulaValue } from '../excelShell/formulaBar.js';

let clockInterval = null;

function setSidePanelVisible(visible) {
  const sidePanel = document.getElementById('side-panel');
  const sheetArea = document.getElementById('sheet-area');
  if (!sidePanel || !sheetArea) return;
  sidePanel.classList.toggle('hidden', !visible);
  sheetArea.style.gridTemplateColumns = visible ? '40px 1fr 260px' : '40px 1fr';
}

/** Instantly swaps the grid to a fake business dashboard and hides the quiz/stats panel. */
export function enterBossMode(grid) {
  setSidePanelVisible(false);
  grid.selectCell(0, 0);
  setFormulaValue('');
  renderFakeSheet(grid);
  clockInterval = setInterval(() => updateClockCell(grid), 1000);
}

/** Clears the fake sheet and hands control back to `restoreGame` to redraw the real state. */
export function exitBossMode(grid, restoreGame) {
  if (clockInterval) {
    clearInterval(clockInterval);
    clockInterval = null;
  }
  grid.clearAllCells();
  setSidePanelVisible(true);
  restoreGame();
}

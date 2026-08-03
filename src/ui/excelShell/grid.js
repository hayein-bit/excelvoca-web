const COLS_COUNT = 20;
const ROWS_COUNT = 40;
const DEFAULT_COL_WIDTH = 96;
const MIN_COL_WIDTH = 50;

// Words fill straight across these columns, one per cell, then wrap to the next
// row-pair (word row + the answer row directly below it). A sheet holds
// CELLS_PER_SHEET words before classicMode.js clears it and moves to the next
// sheet tab, so ROW_COUNT row-pairs never actually needs to wrap within a sheet
// in normal play — the modulo below is just a defensive fallback.
const WORD_COL_START = 2; // C
const WORDS_PER_ROW = 5; // C, D, E, F, G
const ROW_START = 2; // row index 2 == displayed row "3"
const ROW_COUNT = 18; // last word row lands on displayed row 36 (2 + (18-1)*2 == 36)

export const CELLS_PER_SHEET = WORDS_PER_ROW * ROW_COUNT;

// Example-mode sentences are much longer than a bare word, so they get one
// per row-pair instead of 5 crammed across — same ROW_COUNT row-pairs per
// sheet, just one question filling each instead of five.
export const EXAMPLE_WORDS_PER_ROW = 1;
export const EXAMPLE_CELLS_PER_SHEET = EXAMPLE_WORDS_PER_ROW * ROW_COUNT;

function colLabel(index) {
  return String.fromCharCode(65 + index);
}

export function cellRef(c, r) {
  return `${colLabel(c)}${r + 1}`;
}

/**
 * Deterministic "next cell to fill" for a given 1-based question position.
 * `wordsPerRow` defaults to the classic-mode layout (5 across); pass
 * `EXAMPLE_WORDS_PER_ROW` for example mode's one-per-row layout.
 */
export function nextWordCellPosition(position, wordsPerRow = WORDS_PER_ROW) {
  const idx = position - 1;
  const colOffset = idx % wordsPerRow;
  const pairOffset = Math.floor(idx / wordsPerRow) % ROW_COUNT;
  const row = ROW_START + pairOffset * 2;
  return { col: WORD_COL_START + colOffset, row, answerRow: row + 1 };
}

export function initGrid({ onCellClick } = {}) {
  const colHeaders = document.getElementById('col-headers');
  const rowHeaders = document.getElementById('row-headers');
  const grid = document.getElementById('grid');
  const gridScroll = document.getElementById('grid-scroll');

  // Scroll-sync note: the transform that simulates scrolling must go on an INNER
  // track element, never on the clipping (overflow:hidden) container itself —
  // transforming the clipped element moves its own clip window along with it,
  // which vacates the far side of the viewport instead of sliding the content
  // within a fixed window. Same fix applies to row-headers below.
  const colHeadersTrack = document.createElement('div');
  colHeadersTrack.className = 'col-headers-track';
  colHeaders.appendChild(colHeadersTrack);

  const rowHeadersTrack = document.createElement('div');
  rowHeadersTrack.className = 'row-headers-track';
  rowHeaders.appendChild(rowHeadersTrack);

  const colWidths = new Array(COLS_COUNT).fill(DEFAULT_COL_WIDTH);
  const colHeaderElements = [];

  function applyColumnWidths() {
    grid.style.gridTemplateColumns = colWidths.map((w) => `${w}px`).join(' ');
    colHeaderElements.forEach((el, i) => {
      el.style.width = `${colWidths[i]}px`;
    });
  }

  grid.style.gridTemplateRows = `repeat(${ROWS_COUNT}, 24px)`;

  for (let c = 0; c < COLS_COUNT; c++) {
    const el = document.createElement('div');
    el.className = 'col-header-cell';

    const labelEl = document.createElement('span');
    labelEl.textContent = colLabel(c);
    el.appendChild(labelEl);

    // Drag this handle sideways to resize the column, like real Excel.
    const handle = document.createElement('div');
    handle.className = 'col-resize-handle';
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const startX = event.clientX;
      const startWidth = colWidths[c];

      function onMouseMove(moveEvent) {
        colWidths[c] = Math.max(MIN_COL_WIDTH, startWidth + (moveEvent.clientX - startX));
        applyColumnWidths();
      }
      function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });
    el.appendChild(handle);

    colHeadersTrack.appendChild(el);
    colHeaderElements.push(el);
  }
  applyColumnWidths();

  for (let r = 0; r < ROWS_COUNT; r++) {
    const el = document.createElement('div');
    el.className = 'row-header-cell';
    el.textContent = String(r + 1);
    rowHeadersTrack.appendChild(el);
  }

  const cellElements = new Map();
  let selectionAnchor = null;
  let selectionFocus = null;
  let isDragging = false;

  function cellsInRange(a, b) {
    const minC = Math.min(a.c, b.c);
    const maxC = Math.max(a.c, b.c);
    const minR = Math.min(a.r, b.r);
    const maxR = Math.max(a.r, b.r);
    const cells = [];
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) cells.push({ c, r });
    }
    return cells;
  }

  function updateSelectionVisual() {
    cellElements.forEach((el) => el.classList.remove('selected'));
    if (!selectionAnchor || !selectionFocus) return;
    cellsInRange(selectionAnchor, selectionFocus).forEach(({ c, r }) => {
      const el = cellElements.get(`${c}:${r}`);
      if (el) el.classList.add('selected');
    });
    const nameBox = document.getElementById('name-box');
    if (nameBox) {
      const isSingleCell = selectionAnchor.c === selectionFocus.c && selectionAnchor.r === selectionFocus.r;
      nameBox.textContent = isSingleCell
        ? cellRef(selectionAnchor.c, selectionAnchor.r)
        : `${cellRef(selectionAnchor.c, selectionAnchor.r)}:${cellRef(selectionFocus.c, selectionFocus.r)}`;
    }
  }

  function selectCell(c, r) {
    selectionAnchor = { c, r };
    selectionFocus = { c, r };
    updateSelectionVisual();
    return cellRef(c, r);
  }

  function getSelectedText() {
    if (!selectionAnchor || !selectionFocus) return '';
    const minC = Math.min(selectionAnchor.c, selectionFocus.c);
    const maxC = Math.max(selectionAnchor.c, selectionFocus.c);
    const minR = Math.min(selectionAnchor.r, selectionFocus.r);
    const maxR = Math.max(selectionAnchor.r, selectionFocus.r);
    const rows = [];
    for (let r = minR; r <= maxR; r++) {
      const cols = [];
      for (let c = minC; c <= maxC; c++) {
        const el = cellElements.get(`${c}:${r}`);
        cols.push(el ? el.textContent : '');
      }
      rows.push(cols.join('\t'));
    }
    return rows.join('\n');
  }

  for (let r = 0; r < ROWS_COUNT; r++) {
    for (let c = 0; c < COLS_COUNT; c++) {
      const el = document.createElement('div');
      el.className = 'grid-cell';
      el.dataset.col = String(c);
      el.dataset.row = String(r);

      // Click-and-drag across cells selects a range, like real Excel.
      el.addEventListener('mousedown', (event) => {
        if (event.button !== 0) return;
        isDragging = true;
        selectionAnchor = { c, r };
        selectionFocus = { c, r };
        updateSelectionVisual();
        if (onCellClick) onCellClick(c, r);
      });
      el.addEventListener('mouseenter', () => {
        if (!isDragging) return;
        selectionFocus = { c, r };
        updateSelectionVisual();
      });

      grid.appendChild(el);
      cellElements.set(`${c}:${r}`, el);
    }
  }

  document.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Ctrl+C copies the selected range as tab/newline-separated text, so it pastes into real Excel.
  document.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
      const text = getSelectedText();
      if (text) navigator.clipboard.writeText(text).catch(() => {});
    }
  });

  gridScroll.addEventListener('scroll', () => {
    colHeadersTrack.style.transform = `translateX(${-gridScroll.scrollLeft}px)`;
    rowHeadersTrack.style.transform = `translateY(${-gridScroll.scrollTop}px)`;
  });

  function setCellText(c, r, text, extraClass) {
    const el = cellElements.get(`${c}:${r}`);
    if (!el) return;
    el.textContent = text;
    el.className = 'grid-cell';
    if (extraClass) {
      extraClass
        .split(' ')
        .filter(Boolean)
        .forEach((cls) => el.classList.add(cls));
    }
    if (
      selectionAnchor &&
      selectionFocus &&
      cellsInRange(selectionAnchor, selectionFocus).some((cell) => cell.c === c && cell.r === r)
    ) {
      el.classList.add('selected');
    }
  }

  function clearAllCells() {
    cellElements.forEach((el) => {
      el.textContent = '';
      el.className = 'grid-cell';
    });
    updateSelectionVisual();
  }

  return {
    selectCell,
    setCellText,
    clearAllCells,
    COLS_COUNT,
    ROWS_COUNT
  };
}

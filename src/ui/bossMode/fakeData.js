const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
const REGIONS = ['North', 'South', 'East', 'West', 'Central'];

// Fixed so the live clock can be updated in-place without re-rendering everything.
export const CLOCK_CELL = { col: 2, row: 8 };

function formatNow() {
  return new Date().toLocaleString('ko-KR', { hour12: false });
}

/** Renders a plausible-looking sales dashboard into the real grid cells. */
export function renderFakeSheet(grid) {
  grid.clearAllCells();

  grid.setCellText(1, 0, 'Quarterly Revenue Dashboard', 'fake-title');

  MONTHS.forEach((month, i) => grid.setCellText(2 + i, 1, month, 'fake-header'));

  REGIONS.forEach((region, r) => {
    grid.setCellText(1, 2 + r, region, 'fake-header');
    MONTHS.forEach((month, i) => {
      const value = Math.floor(Math.random() * 9000 + 1000);
      grid.setCellText(2 + i, 2 + r, value.toLocaleString());
    });
  });

  grid.setCellText(1, 2 + REGIONS.length, 'Total', 'fake-header');
  MONTHS.forEach((month, i) => {
    const total = Math.floor(Math.random() * 30000 + 10000);
    grid.setCellText(2 + i, 2 + REGIONS.length, total.toLocaleString(), 'fake-title');
  });

  grid.setCellText(1, CLOCK_CELL.row, '갱신 시각', 'fake-header');
  updateClockCell(grid);
}

export function updateClockCell(grid) {
  grid.setCellText(CLOCK_CELL.col, CLOCK_CELL.row, formatNow());
}

/** Upserts today's row in data/study_log.csv — the Excel-openable daily summary log. */
export function upsertDailyLog(row) {
  return window.excelvoca.upsertDailyLog(row);
}

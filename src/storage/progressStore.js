function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function defaultProgress() {
  return {
    words: {},
    stats: {
      todayDate: todayKey(),
      todayStudied: 0,
      todayCorrect: 0,
      longestCombo: 0
    }
  };
}

/** Loads progress.json (or a fresh default shape if none exists yet). */
export async function loadProgress() {
  const stored = await window.excelvoca.loadProgress();
  if (!stored) return defaultProgress();

  const progress = { ...defaultProgress(), ...stored };
  progress.words = stored.words || {};
  progress.stats = { ...defaultProgress().stats, ...(stored.stats || {}) };

  // Roll over "today" stats if the app wasn't opened on the same calendar day.
  if (progress.stats.todayDate !== todayKey()) {
    progress.stats.todayDate = todayKey();
    progress.stats.todayStudied = 0;
    progress.stats.todayCorrect = 0;
  }
  return progress;
}

export function saveProgress(progress) {
  return window.excelvoca.saveProgress(progress);
}

export function getWordStat(progress, word) {
  return (
    progress.words[word] || {
      correct: 0,
      wrong: 0,
      total: 0,
      lastStudied: null,
      streak: 0,
      dontKnow: false
    }
  );
}

/**
 * Mutates `progress` in place with the result of answering `word`, and returns it.
 * `options.dontKnow` marks the word as explicitly "모르겠다" — it's cleared again
 * the next time the word is answered correctly.
 */
export function recordAnswer(progress, word, wasCorrect, comboAfterAnswer, options = {}) {
  const stat = getWordStat(progress, word);
  stat.total += 1;
  if (wasCorrect) {
    stat.correct += 1;
    stat.streak += 1;
    stat.dontKnow = false;
  } else {
    stat.wrong += 1;
    stat.streak = 0;
    if (options.dontKnow) stat.dontKnow = true;
  }
  stat.lastStudied = new Date().toISOString();
  progress.words[word] = stat;

  progress.stats.todayStudied += 1;
  if (wasCorrect) progress.stats.todayCorrect += 1;
  if (comboAfterAnswer > progress.stats.longestCombo) {
    progress.stats.longestCombo = comboAfterAnswer;
  }

  return progress;
}

/** A word counts as "아는 단어" (mastered) once it's been answered correctly 10 times in a row. */
export function isMastered(stat) {
  return stat.streak >= 10;
}

export function isNeedsReview(stat) {
  return stat.total > 0 && stat.wrong > 0 && stat.streak === 0;
}

export function isDontKnow(stat) {
  return Boolean(stat.dontKnow);
}

export function countMastered(progress) {
  return Object.values(progress.words).filter(isMastered).length;
}

export function countNeedsReview(progress) {
  return Object.values(progress.words).filter(isNeedsReview).length;
}

/** Resets just today's studied/correct counts — per-word stats and the all-time longest combo are untouched. */
export function resetTodayStats(progress) {
  progress.stats.todayStudied = 0;
  progress.stats.todayCorrect = 0;
  return progress;
}

/** Wipes every word's progress and all stats — a full, unrecoverable restart. */
export function resetAllProgress(progress) {
  progress.words = {};
  progress.stats = defaultProgress().stats;
  return progress;
}

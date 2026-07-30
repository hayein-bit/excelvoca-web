import { getWordStat, isMastered } from '../storage/progressStore.js';

// Rank thresholds are expressed as a fraction of the total word list mastered,
// so the ladder scales automatically with however many rows are in the CSV.
const RANKS = [
  { title: 'Intern', min: 0 },
  { title: 'Junior Analyst', min: 0.05 },
  { title: 'Analyst', min: 0.12 },
  { title: 'Senior Analyst', min: 0.22 },
  { title: 'Manager', min: 0.35 },
  { title: 'Director', min: 0.5 },
  { title: 'Executive', min: 0.7 },
  { title: 'CEO', min: 0.9 }
];

/**
 * @param {number} masteredWeight
 * @param {number} totalWeight
 * @returns {{title:string, index:number, nextTitle:string|null, progressToNext:number,
 *            masteredWeight:number, totalWeight:number, nextThresholdWeight:number|null}}
 */
export function getRank(masteredWeight, totalWeight) {
  const ratio = totalWeight > 0 ? masteredWeight / totalWeight : 0;

  let rankIndex = 0;
  for (let i = 0; i < RANKS.length; i++) {
    if (ratio >= RANKS[i].min) rankIndex = i;
  }

  const current = RANKS[rankIndex];
  const next = RANKS[rankIndex + 1] || null;
  let progressToNext = 1;
  if (next) {
    const span = next.min - current.min;
    progressToNext = span > 0 ? (ratio - current.min) / span : 0;
  }

  return {
    title: current.title,
    index: rankIndex,
    nextTitle: next ? next.title : null,
    progressToNext: Math.max(0, Math.min(1, progressToNext)),
    masteredWeight,
    totalWeight,
    nextThresholdWeight: next ? Math.ceil(next.min * totalWeight) : null
  };
}

/**
 * Rank uses difficulty-weighted mastery, not a plain word count — mastering a
 * level-3 word counts 3x toward the ladder as mastering a level-1 word.
 */
export function computeRank(progress, words) {
  let masteredWeight = 0;
  let totalWeight = 0;
  for (const word of words) {
    totalWeight += word.level;
    if (isMastered(getWordStat(progress, word.key))) masteredWeight += word.level;
  }
  return getRank(masteredWeight, totalWeight);
}

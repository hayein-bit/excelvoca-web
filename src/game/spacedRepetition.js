import { weightedPick } from '../utils/shuffle.js';
import { getWordStat, isMastered } from '../storage/progressStore.js';
import { computeRank } from './rankSystem.js';

// Floor applied to mastered words' weight so they occasionally resurface as a
// spot-check instead of the streak term driving them down toward the general
// 0.1 floor forever. Still well below a normally-studied word's weight (~1+),
// so review stays occasional rather than frequent.
const MASTERED_REVIEW_WEIGHT = 0.5;

function isSameDay(isoDate) {
  if (!isoDate) return false;
  return isoDate.slice(0, 10) === new Date().toISOString().slice(0, 10);
}

// [level1..level5] TARGET SHARE of quiz picks per rank index (0=Intern..7=CEO)
// — not a per-word weight. Level pools are wildly uneven in size (level 3 has
// ~2.6x as many words as level 1), so a merely *equal* per-word weight
// between two levels still lets the bigger pool dominate the actual pick
// distribution — that's what let level 2/3 outnumber level 1 in practice even
// at low rank, despite level 1's per-word weight already being higher.
// `levelWeight` below divides each share by that level's real word count
// (computed at runtime from `words`) to get the actual per-word weight, so
// the resulting pick distribution matches this table regardless of how
// lopsided the pools are or how many words get added/removed later.
// Rows don't need to sum to 1 (only relative weight within a row matters),
// but keeping them near 1 makes the intended shape easy to read at a glance.
// Low rank favors easy words heavily (level 1 overwhelmingly dominant); the
// balance shifts to harder words as rank rises.
const LEVEL_SHARE_BY_RANK = [
  [0.7, 0.18, 0.08, 0.03, 0.01], // Intern
  [0.55, 0.25, 0.13, 0.05, 0.02], // Junior Analyst
  [0.35, 0.3, 0.2, 0.1, 0.05], // Analyst
  [0.22, 0.28, 0.27, 0.15, 0.08], // Senior Analyst
  [0.12, 0.2, 0.3, 0.23, 0.15], // Manager
  [0.07, 0.14, 0.27, 0.28, 0.24], // Director
  [0.04, 0.09, 0.2, 0.32, 0.35], // Executive
  [0.02, 0.05, 0.13, 0.3, 0.5] // CEO
];

function levelWeight(level, rankIndex, levelCounts) {
  const row = LEVEL_SHARE_BY_RANK[Math.min(rankIndex, LEVEL_SHARE_BY_RANK.length - 1)];
  const levelIdx = Math.min(Math.max(level, 1), 5) - 1;
  const count = levelCounts[levelIdx] || 1;
  return row[levelIdx] / count;
}

/**
 * Weighted-random pick of the next quiz item (a word+sense `key`) to study:
 * senses that are wrong more often, or have a short correct streak, are more
 * likely to come up. Senses already studied today (or that were just asked)
 * are heavily de-weighted so the same one doesn't repeat back-to-back. Word
 * difficulty (`level`) is also weighted by the player's current rank — low
 * rank sees mostly easy words, high rank sees mostly hard ones.
 */
export function pickNext(words, progress, excludeKey) {
  if (words.length === 0) return null;
  if (words.length === 1) return words[0];

  const rank = computeRank(progress, words);

  const levelCounts = [0, 0, 0, 0, 0];
  for (const word of words) {
    const idx = Math.min(Math.max(word.level, 1), 5) - 1;
    levelCounts[idx]++;
  }

  const weighted = words.map((word) => {
    const stat = getWordStat(progress, word.key);
    let weight = 1 + stat.wrong * 2 - Math.min(stat.streak * 0.5, 1.5);
    weight = Math.max(weight, 0.1);

    // A mastered word getting picked and missed drops its streak below the
    // mastery threshold via the normal wrong-answer path (progressStore.isMastered
    // just checks streak >= 10) — no separate "un-master" step needed.
    if (isMastered(stat)) weight = Math.max(weight, MASTERED_REVIEW_WEIGHT);

    weight *= levelWeight(word.level, rank.index, levelCounts);

    // "모르겠다"로 표시한 단어는 우선적으로 다시 나오도록 가중치를 높인다.
    if (stat.dontKnow) weight *= 5;

    if (isSameDay(stat.lastStudied)) weight *= 0.2;
    if (word.key === excludeKey) weight *= 0.05;

    return { item: word, weight };
  });

  return weightedPick(weighted);
}

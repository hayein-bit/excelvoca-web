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

// [level1..level5] weight multipliers per rank index (0=Intern..7=CEO).
// Lower rank favors easy words heavily; the balance shifts to harder words as rank rises.
const LEVEL_WEIGHT_BY_RANK = [
  [3.0, 1.5, 0.6, 0.2, 0.1], // Intern
  [3.0, 1.5, 0.6, 0.2, 0.1], // Junior Analyst
  [1.8, 1.8, 1.0, 0.4, 0.2], // Analyst
  [1.8, 1.8, 1.0, 0.4, 0.2], // Senior Analyst
  [1.0, 1.3, 1.3, 0.9, 0.5], // Manager
  [1.0, 1.3, 1.3, 0.9, 0.5], // Director
  [0.4, 0.8, 1.3, 1.6, 1.6], // Executive
  [0.4, 0.8, 1.3, 1.6, 1.6] // CEO
];

function levelWeight(level, rankIndex) {
  const row = LEVEL_WEIGHT_BY_RANK[Math.min(rankIndex, LEVEL_WEIGHT_BY_RANK.length - 1)];
  const levelIdx = Math.min(Math.max(level, 1), 5) - 1;
  return row[levelIdx];
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

  const weighted = words.map((word) => {
    const stat = getWordStat(progress, word.key);
    let weight = 1 + stat.wrong * 2 - Math.min(stat.streak * 0.5, 1.5);
    weight = Math.max(weight, 0.1);

    // A mastered word getting picked and missed drops its streak below the
    // mastery threshold via the normal wrong-answer path (progressStore.isMastered
    // just checks streak >= 10) — no separate "un-master" step needed.
    if (isMastered(stat)) weight = Math.max(weight, MASTERED_REVIEW_WEIGHT);

    weight *= levelWeight(word.level, rank.index);

    // "모르겠다"로 표시한 단어는 우선적으로 다시 나오도록 가중치를 높인다.
    if (stat.dontKnow) weight *= 5;

    if (isSameDay(stat.lastStudied)) weight *= 0.2;
    if (word.key === excludeKey) weight *= 0.05;

    return { item: word, weight };
  });

  return weightedPick(weighted);
}

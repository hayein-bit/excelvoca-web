import { loadWordsFromCsv } from './csvLoader.js';

let words = [];
let byKey = new Map();

/** Reads data/teps_words.csv fresh (via main process) and rebuilds the in-memory store. */
export async function loadWords() {
  const csvText = await window.excelvoca.loadWords();
  words = loadWordsFromCsv(csvText);
  byKey = new Map(words.map((w) => [w.key, w]));
  return words;
}

export function getAllWords() {
  return words;
}

/** Looks up a specific sense by its `key` (word+pos+meaning) — a word can have several. */
export function getWordByKey(key) {
  return byKey.get(key);
}

/** "word (pos)" for display — phrases (pos "phr") skip the suffix since they're long enough already. */
export function formatDisplay(wordObj) {
  return wordObj.pos && wordObj.pos !== 'phr' ? `${wordObj.word} (${wordObj.pos})` : wordObj.word;
}

/**
 * Fills `result` (up to `count`, deduped by whatever `keyFor` returns) from
 * `pool` in random order. Used to prefer a same-pos pool first and only spill
 * into a wider fallback pool if that pos doesn't have enough distinct items.
 */
function fillRandom(pool, count, keyFor, seen, result) {
  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const w of shuffled) {
    if (result.length >= count) break;
    const k = keyFor(w);
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(w);
  }
}

/**
 * Returns `count` random meanings from words other than `excludeWord`, with
 * no duplicate meanings. Distractors are drawn from words sharing `pos` with
 * the correct answer first (falling back to any pos only if that's not
 * enough to fill `count`) — otherwise a Korean meaning's own grammatical
 * ending (품사) can give away which choice is correct without knowing the
 * word at all, since the choices would visibly mix noun/verb/adjective forms.
 */
export function getRandomOtherMeanings(excludeWord, count, pos) {
  const basePool = words.filter((w) => w.word !== excludeWord);
  const seen = new Set();
  const result = [];
  if (pos) fillRandom(basePool.filter((w) => w.pos === pos), count, (w) => w.meaning, seen, result);
  fillRandom(basePool, count, (w) => w.meaning, seen, result);
  return result.map((w) => w.meaning);
}

/**
 * Reverse-mode distractors: `count` random other words' display text (e.g.
 * "grave (n)"), no duplicates. Same same-pos-first preference as
 * `getRandomOtherMeanings` and for the same reason — here the pos suffix is
 * shown directly on every choice, so mixed pos would leak the answer even
 * more directly.
 */
export function getRandomOtherWordDisplays(excludeWord, count, pos) {
  const basePool = words.filter((w) => w.word !== excludeWord);
  const seen = new Set();
  const result = [];
  if (pos) fillRandom(basePool.filter((w) => w.pos === pos), count, formatDisplay, seen, result);
  fillRandom(basePool, count, formatDisplay, seen, result);
  return result.map((w) => formatDisplay(w));
}

export function filterByLevel(level) {
  return words.filter((w) => w.level === level);
}

export function filterByPos(pos) {
  return words.filter((w) => w.pos === pos);
}

export function searchWords(query) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return words.filter(
    (w) => w.word.toLowerCase().includes(q) || w.meaning.includes(q)
  );
}

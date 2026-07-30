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

/** Returns `count` random meanings from words other than `excludeWord`, with no duplicate meanings. */
export function getRandomOtherMeanings(excludeWord, count) {
  const pool = words.filter((w) => w.word !== excludeWord);
  const seenMeanings = new Set();
  const result = [];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const w of shuffled) {
    if (result.length >= count) break;
    if (seenMeanings.has(w.meaning)) continue;
    seenMeanings.add(w.meaning);
    result.push(w.meaning);
  }
  return result;
}

/** Reverse-mode distractors: `count` random other words' display text (e.g. "grave (n)"), no duplicates. */
export function getRandomOtherWordDisplays(excludeWord, count) {
  const pool = words.filter((w) => w.word !== excludeWord);
  const seenDisplays = new Set();
  const result = [];

  const shuffled = [...pool].sort(() => Math.random() - 0.5);
  for (const w of shuffled) {
    if (result.length >= count) break;
    const display = formatDisplay(w);
    if (seenDisplays.has(display)) continue;
    seenDisplays.add(display);
    result.push(display);
  }
  return result;
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

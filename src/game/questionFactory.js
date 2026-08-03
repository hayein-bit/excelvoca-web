import { shuffle } from '../utils/shuffle.js';
import { getRandomOtherMeanings, getRandomOtherWordDisplays, formatDisplay } from '../data/wordRepository.js';

/**
 * Builds a 4-choice question for `wordObj`. Normally: word shown in the cell,
 * choices are meanings (3 distractors + the correct one). In `reverse` mode
 * this flips — the Korean meaning is shown in the cell and the choices are
 * English word/phrase forms instead — so it isn't always "guess the meaning."
 */
export function buildQuestion(wordObj, { reverse = false } = {}) {
  const wordDisplay = formatDisplay(wordObj);

  if (reverse) {
    const distractors = getRandomOtherWordDisplays(wordObj.word, 3);
    const choices = shuffle([wordDisplay, ...distractors]);
    const correctIndex = choices.indexOf(wordDisplay);

    return {
      key: wordObj.key,
      word: wordObj.word,
      pos: wordObj.pos,
      display: wordObj.meaning,
      reverse: true,
      example: wordObj.example,
      level: wordObj.level,
      choices,
      correctIndex
    };
  }

  const distractors = getRandomOtherMeanings(wordObj.word, 3);
  const choices = shuffle([wordObj.meaning, ...distractors]);
  const correctIndex = choices.indexOf(wordObj.meaning);

  return {
    key: wordObj.key,
    word: wordObj.word,
    pos: wordObj.pos,
    display: wordDisplay,
    reverse: false,
    example: wordObj.example,
    level: wordObj.level,
    choices,
    correctIndex
  };
}

/**
 * Builds a question for example mode: the full English example sentence is
 * shown (instead of the bare word), and the choices are Korean meanings —
 * same distractor pool as the forward direction of `buildQuestion`. Always
 * forward (read sentence -> pick meaning); there's no reverse variant.
 * `exampleKo` (the sentence's own Korean translation) rides along on the
 * question object purely for the answer-reveal step.
 */
export function buildExampleQuestion(wordObj) {
  const distractors = getRandomOtherMeanings(wordObj.word, 3);
  const choices = shuffle([wordObj.meaning, ...distractors]);
  const correctIndex = choices.indexOf(wordObj.meaning);

  return {
    key: wordObj.key,
    word: wordObj.word,
    pos: wordObj.pos,
    display: wordObj.example,
    reverse: false,
    example: wordObj.example,
    exampleKo: wordObj.exampleKo,
    level: wordObj.level,
    choices,
    correctIndex
  };
}

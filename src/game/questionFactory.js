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

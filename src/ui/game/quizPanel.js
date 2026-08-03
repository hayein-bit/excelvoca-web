const CIRCLED_DIGITS = ['①', '②', '③', '④'];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Wraps the target word in <b> within `sentence`, HTML-escaping everything
 * else. Matches case-insensitively and allows a trailing inflection suffix
 * (e.g. "abandon" also bolds "abandoned") since example sentences conjugate
 * verbs/pluralize nouns rather than using the bare dictionary form. Falls
 * back to the plain escaped sentence if no match is found.
 */
function boldedSentenceHtml(sentence, word) {
  const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = sentence.match(new RegExp(`\\b${escapedWord}\\w*`, 'i'));
  if (!match) return escapeHtml(sentence);
  const before = escapeHtml(sentence.slice(0, match.index));
  const matched = escapeHtml(match[0]);
  const after = escapeHtml(sentence.slice(match.index + match[0].length));
  return `${before}<b>${matched}</b>${after}`;
}

/** Example mode only: shows the example sentence with the tested word bolded, so the choices alone don't leave the user guessing which word they're answering for. */
function appendExampleSentence(panel, question) {
  const el = document.createElement('div');
  el.className = 'quiz-example-sentence';
  el.innerHTML = boldedSentenceHtml(question.example, question.word);
  panel.appendChild(el);
}

export function renderQuestion(question, onChoiceClick, onDontKnow, { showSentence = false } = {}) {
  const panel = document.getElementById('quiz-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '빠른 분석';
  panel.appendChild(header);

  if (showSentence) appendExampleSentence(panel, question);

  const choicesEl = document.createElement('div');
  choicesEl.className = 'quiz-choices';

  question.choices.forEach((choice, index) => {
    const el = document.createElement('div');
    el.className = 'quiz-choice';
    el.dataset.index = String(index);

    const numEl = document.createElement('span');
    numEl.className = 'choice-num';
    numEl.textContent = CIRCLED_DIGITS[index];

    const textEl = document.createElement('span');
    textEl.className = 'choice-text';
    textEl.textContent = choice;

    el.appendChild(numEl);
    el.appendChild(textEl);
    el.addEventListener('click', () => onChoiceClick(index));
    choicesEl.appendChild(el);
  });

  panel.appendChild(choicesEl);

  const dontKnowEl = document.createElement('div');
  dontKnowEl.className = 'quiz-dontknow';

  const numEl = document.createElement('span');
  numEl.className = 'choice-num';
  numEl.textContent = '⑤';

  const textEl = document.createElement('span');
  textEl.className = 'choice-text';
  textEl.textContent = '모르겠다 (뜻 보기)';

  dontKnowEl.appendChild(numEl);
  dontKnowEl.appendChild(textEl);
  dontKnowEl.onclick = () => onDontKnow();
  panel.appendChild(dontKnowEl);
}

export function markChoiceResult(index, wasCorrect) {
  const el = document.querySelector(`#quiz-panel .quiz-choice[data-index="${index}"]`);
  if (el) el.classList.add(wasCorrect ? 'correct' : 'wrong');
}

export function highlightCorrectChoice(index) {
  const el = document.querySelector(`#quiz-panel .quiz-choice[data-index="${index}"]`);
  if (el) el.classList.add('reveal-correct');
}

/**
 * After "모르겠다" is chosen, the same ⑤ row turns into the "다음 문제" continue
 * button in place — no separate prompt element — so the meaning stays on
 * screen until the user is ready and then clicks/presses a key on that row.
 */
export function switchDontKnowToContinue(onContinue) {
  const el = document.querySelector('#quiz-panel .quiz-dontknow');
  if (!el) return;
  const textEl = el.querySelector('.choice-text');
  if (textEl) textEl.textContent = '다음 문제';
  el.onclick = onContinue;
}

/**
 * Example mode's first phase: the sentence itself is already in the grid
 * cell/formula bar, so the panel just shows a note + a single continue row
 * (mirrors `switchDontKnowToContinue`'s row) that reveals the choices when
 * the user is done reading/interpreting on their own.
 */
export function renderReadingPhase(question, onContinue) {
  const panel = document.getElementById('quiz-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '빠른 분석';
  panel.appendChild(header);

  appendExampleSentence(panel, question);

  const noteEl = document.createElement('div');
  noteEl.className = 'quiz-reading-note';
  noteEl.textContent = '굵게 표시된 단어의 뜻을 먼저 생각해보세요.';
  panel.appendChild(noteEl);

  const continueEl = document.createElement('div');
  continueEl.className = 'quiz-continue';

  const numEl = document.createElement('span');
  numEl.className = 'choice-num';
  numEl.textContent = '▶';

  const textEl = document.createElement('span');
  textEl.className = 'choice-text';
  textEl.textContent = '선택지 보기';

  continueEl.appendChild(numEl);
  continueEl.appendChild(textEl);
  continueEl.onclick = () => onContinue();
  panel.appendChild(continueEl);
}

/** Appends the example sentence's Korean translation to the panel on answer reveal (example mode only). */
export function showTranslationReveal(exampleKo) {
  const panel = document.getElementById('quiz-panel');
  if (!panel || !exampleKo) return;
  let el = panel.querySelector('.quiz-translation');
  if (!el) {
    el = document.createElement('div');
    el.className = 'quiz-translation';
    panel.appendChild(el);
  }
  el.textContent = exampleKo;
}

export function clearQuizPanel() {
  const panel = document.getElementById('quiz-panel');
  if (panel) panel.innerHTML = '';
}

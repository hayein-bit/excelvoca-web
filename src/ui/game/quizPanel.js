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

/**
 * Typing mode: no choices at all — a single text input the user types the
 * English word/phrase into. Auto-focused so play can continue without a
 * mouse click. Enter and the submit row both call `onSubmit(inputValue)`;
 * "모르겠다" stays available exactly like every other mode.
 */
export function renderTypingQuestion(question, onSubmit, onDontKnow) {
  const panel = document.getElementById('quiz-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '빠른 분석';
  panel.appendChild(header);

  const formEl = document.createElement('div');
  formEl.className = 'quiz-typing-form';

  const inputEl = document.createElement('input');
  inputEl.type = 'text';
  inputEl.className = 'quiz-typing-input';
  inputEl.autocomplete = 'off';
  inputEl.spellcheck = false;
  inputEl.placeholder = '영어 단어를 입력하세요';

  const submitEl = document.createElement('button');
  submitEl.type = 'button';
  submitEl.className = 'quiz-typing-submit';
  submitEl.textContent = '확인';

  const submit = () => onSubmit(inputEl.value);
  inputEl.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      submit();
    }
  });
  submitEl.addEventListener('click', submit);

  formEl.appendChild(inputEl);
  formEl.appendChild(submitEl);
  panel.appendChild(formEl);

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

  inputEl.focus();
}

/** Colors the typing input green/red after an answer and locks it until the next question. */
export function markTypingResult(wasCorrect) {
  const el = document.querySelector('#quiz-panel .quiz-typing-input');
  if (!el) return;
  el.classList.add(wasCorrect ? 'correct' : 'wrong');
  el.disabled = true;
}

function buildMatchColumn(items, pendingIndex, onSelect) {
  const listEl = document.createElement('div');
  listEl.className = 'quiz-match-list';

  items.forEach((item, index) => {
    const el = document.createElement('div');
    el.className = 'quiz-match-item';
    el.dataset.index = String(index);
    if (item.matched) el.classList.add('matched');
    if (pendingIndex === index) el.classList.add('selected');

    const textEl = document.createElement('span');
    textEl.className = 'choice-text';
    textEl.textContent = item.text;
    el.appendChild(textEl);

    if (!item.matched) el.addEventListener('click', () => onSelect(index));
    listEl.appendChild(el);
  });

  return listEl;
}

/**
 * Matching mode's panel content. On desktop the round's English half lives in
 * grid cells instead (pass only `onSelectRight`), so just the Korean meanings
 * render here as clickable rows. The web version has no grid to put anything
 * in, so pass `onSelectLeft` too and both columns render side by side here.
 */
export function renderMatchingPanel(matchState, onSelectRight, onSelectLeft) {
  const panel = document.getElementById('quiz-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '빠른 분석';
  panel.appendChild(header);

  const noteEl = document.createElement('div');
  noteEl.className = 'quiz-reading-note';
  noteEl.textContent = onSelectLeft
    ? '왼쪽에서 영단어를, 오른쪽에서 알맞은 뜻을 선택하세요.'
    : '셀에서 영단어를 고른 뒤, 아래에서 알맞은 뜻을 선택하세요.';
  panel.appendChild(noteEl);

  if (onSelectLeft) {
    const columnsEl = document.createElement('div');
    columnsEl.className = 'quiz-match-columns';
    columnsEl.appendChild(buildMatchColumn(matchState.left, matchState.pendingLeft, onSelectLeft));
    columnsEl.appendChild(buildMatchColumn(matchState.right, matchState.pendingRight, onSelectRight));
    panel.appendChild(columnsEl);
  } else {
    panel.appendChild(buildMatchColumn(matchState.right, matchState.pendingRight, onSelectRight));
  }
}

/**
 * Briefly flashes a mismatched panel row red, then clears it. On desktop only
 * the right (Korean) column lives in the panel, so `side` defaults to it; on
 * web, pass `'left'` too since both columns render in the panel there. The
 * desktop's left/grid-cell side flashes separately via renderer.js.
 */
export function flashMatchWrong(index, side = 'right') {
  const columns = document.querySelectorAll('#quiz-panel .quiz-match-list');
  const columnEl = side === 'left' ? columns[0] : columns[columns.length - 1];
  const el = columnEl && columnEl.querySelector(`.quiz-match-item[data-index="${index}"]`);
  if (!el) return;
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 500);
}

export function clearQuizPanel() {
  const panel = document.getElementById('quiz-panel');
  if (panel) panel.innerHTML = '';
}

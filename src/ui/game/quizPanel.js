const CIRCLED_DIGITS = ['①', '②', '③', '④'];

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// A handful of common irregular verbs whose inflected forms share no letter
// prefix with the base word (get/got, pay/paid, ...), so no amount of suffix
// matching finds them — these need to be listed explicitly.
const IRREGULAR_FORMS = {
  get: ['got', 'gotten'],
  take: ['took', 'taken'],
  make: ['made'],
  pay: ['paid'],
  hang: ['hung']
};
// Compound verbs ending in an irregular root (overcome, become, ...) inflect
// by swapping that root's ending the same way the plain root would.
const IRREGULAR_SUFFIXES = { come: 'came' };
// "be" (as in "be drenched in", "be obsessed with") conjugates instead of
// inflecting by suffix, so it needs its own fixed candidate list rather than
// going through stemCandidates.
const BE_FORMS = ['being', 'been', 'were', 'was', 'are', 'am', 'is', 'be'];

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Wraps each `[start, end]` range of `sentence` in <b>, escaping everything else. Returns null if `ranges` is empty. */
function boldRanges(sentence, ranges) {
  if (ranges.length === 0) return null;
  ranges.sort((a, b) => a[0] - b[0]);
  let html = '';
  let cursor = 0;
  for (const [start, end] of ranges) {
    if (start < cursor) continue;
    html += escapeHtml(sentence.slice(cursor, start));
    html += `<b>${escapeHtml(sentence.slice(start, end))}</b>`;
    cursor = end;
  }
  html += escapeHtml(sentence.slice(cursor));
  return html;
}

/**
 * Returns alternative spellings of `word` that a real sentence might use in
 * place of the bare dictionary form, covering the common English spelling
 * changes a plain suffix match misses: silent-e drop before -ing/-ed
 * ("adulterate" -> "adulterat" so "adulterating" matches), consonant+y -> i
 * before -es/-ed ("apply" -> "appli" so "applies" matches), and ie -> y
 * before -ing ("vie" -> "vy" so "vying" matches) — plus the irregular verbs
 * above. Each candidate still gets a trailing \w* when used in the regex, so
 * this only needs to produce the *stem*, not the full inflected form.
 */
function stemCandidates(word) {
  const candidates = new Set([word]);
  if (/[a-z]e$/i.test(word)) candidates.add(word.slice(0, -1));
  if (/[^aeiou]y$/i.test(word)) candidates.add(word.slice(0, -1) + 'i');
  if (/ie$/i.test(word)) candidates.add(word.slice(0, -2) + 'y');

  const lower = word.toLowerCase();
  if (IRREGULAR_FORMS[lower]) IRREGULAR_FORMS[lower].forEach((f) => candidates.add(f));
  for (const [suffix, replacement] of Object.entries(IRREGULAR_SUFFIXES)) {
    if (lower.endsWith(suffix)) candidates.add(lower.slice(0, -suffix.length) + replacement);
  }
  return [...candidates];
}

/**
 * Wraps the target word/phrase in <b> within `sentence`, HTML-escaping
 * everything else. Matches case-insensitively and tries several inflected
 * stems (see stemCandidates) since example sentences conjugate verbs/
 * pluralize nouns rather than using the bare dictionary form. Falls back to
 * the plain escaped sentence if no match is found.
 *
 * For `phr` entries (pos === 'phr'), only the *first* word conjugates
 * ("refer to" -> "refers to", "get rid of" -> "got rid of") or, for a
 * leading "be", "be" itself conjugates while the rest stays fixed ("be
 * drenched in" -> "was drenched in") — so the whole phrase is matched as
 * [conjugated head] + [literal fixed tail], not just the head word alone.
 * Correlative structures (`either ~ or`, `no sooner ~ than`) have a "~"
 * placeholder standing in for whatever comes between the two fixed parts, so
 * those two parts are matched (and bolded) independently instead.
 */
function boldedSentenceHtml(sentence, word, pos) {
  if (pos === 'phr' && word.includes('~')) {
    const parts = word.split('~').map((p) => p.trim()).filter(Boolean);
    const ranges = [];
    for (const part of parts) {
      const pattern = part.split(' ').map(escapeRegex).join('\\s+');
      const match = sentence.match(new RegExp(`\\b${pattern}\\b`, 'i'));
      if (match) ranges.push([match.index, match.index + match[0].length]);
    }
    return boldRanges(sentence, ranges) ?? escapeHtml(sentence);
  }

  let target = word;
  let tailTokens = [];
  if (pos === 'phr') {
    const tokens = word.split(' ');
    target = tokens[0];
    tailTokens = tokens.slice(1);
  }

  const candidates = (target.toLowerCase() === 'be' ? BE_FORMS : stemCandidates(target))
    .map(escapeRegex)
    .sort((a, b) => b.length - a.length);
  const headPattern = `\\b(?:${candidates.join('|')})\\w*`;

  if (tailTokens.length) {
    const tailPattern = tailTokens.map(escapeRegex).join('\\s+');
    const fullMatch = sentence.match(new RegExp(`${headPattern}\\s+${tailPattern}`, 'i'));
    if (fullMatch) return boldRanges(sentence, [[fullMatch.index, fullMatch.index + fullMatch[0].length]]);
  }

  const headMatch = sentence.match(new RegExp(headPattern, 'i'));
  if (!headMatch) return escapeHtml(sentence);
  const headRange = [headMatch.index, headMatch.index + headMatch[0].length];

  // Head and tail aren't adjacent — either an object sits between them
  // ("attributes her success to hard work") or the tail has a placeholder
  // that doesn't literally occur ("take one's time" -> "take your time").
  // Bold the tail's last fixed word wherever it independently occurs after
  // the head, so the collocation pattern is still visible, not just its head.
  if (tailTokens.length) {
    const lastToken = tailTokens[tailTokens.length - 1];
    const tailMatch = sentence.match(new RegExp(`\\b${escapeRegex(lastToken)}\\b`, 'i'));
    if (tailMatch && tailMatch.index >= headRange[1]) {
      return boldRanges(sentence, [headRange, [tailMatch.index, tailMatch.index + tailMatch[0].length]]);
    }
  }

  return boldRanges(sentence, [headRange]);
}

/** Example mode only: shows the example sentence with the tested word bolded, so the choices alone don't leave the user guessing which word they're answering for. */
function appendExampleSentence(panel, question) {
  const el = document.createElement('div');
  el.className = 'quiz-example-sentence';
  el.innerHTML = boldedSentenceHtml(question.example, question.word, question.pos);
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
 * Appends a memory-hook collocation ("impulse purchase → 충동구매") to the
 * panel on answer reveal, in classic/example/typing mode alike — only when
 * that word has one curated (most rows don't, and that's fine; a forced
 * mediocre collocation doesn't help the way a genuinely famous one does).
 */
export function showCollocationHint(collocation, collocationKo) {
  const panel = document.getElementById('quiz-panel');
  if (!panel || !collocation || !collocationKo) return;
  let el = panel.querySelector('.quiz-collocation');
  if (!el) {
    el = document.createElement('div');
    el.className = 'quiz-collocation';
    panel.appendChild(el);
  }
  el.textContent = `💡 연상: ${collocation} (${collocationKo})`;
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

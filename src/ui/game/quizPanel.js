const CIRCLED_DIGITS = ['①', '②', '③', '④'];

export function renderQuestion(question, onChoiceClick, onDontKnow) {
  const panel = document.getElementById('quiz-panel');
  panel.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'panel-header';
  header.textContent = '빠른 분석';
  panel.appendChild(header);

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

export function clearQuizPanel() {
  const panel = document.getElementById('quiz-panel');
  if (panel) panel.innerHTML = '';
}

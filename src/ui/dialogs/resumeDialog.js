/**
 * Shows the Office-style "이전 학습을 이어하시겠습니까?" modal and resolves once
 * the user picks 이어하기 / 새로 시작 (also reporting whether they ticked
 * "다음부터 자동으로 이어하기").
 */
export function showResumeDialog(autoResumeInitial) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('resume-dialog-overlay');
    overlay.innerHTML = '';

    const box = document.createElement('div');
    box.className = 'dialog-box';

    const title = document.createElement('div');
    title.className = 'dialog-title';
    title.textContent = 'Microsoft Excel';

    const body = document.createElement('div');
    body.className = 'dialog-body';

    const message = document.createElement('p');
    message.textContent = '이전 학습을 이어하시겠습니까?';
    body.appendChild(message);

    const label = document.createElement('label');
    label.className = 'dialog-checkbox';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'auto-resume-checkbox';
    checkbox.checked = Boolean(autoResumeInitial);
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode('다음부터 자동으로 이어하기'));
    body.appendChild(label);

    const actions = document.createElement('div');
    actions.className = 'dialog-actions';

    const resumeBtn = document.createElement('button');
    resumeBtn.className = 'dialog-btn primary';
    resumeBtn.textContent = '이어하기';

    const newBtn = document.createElement('button');
    newBtn.className = 'dialog-btn';
    newBtn.textContent = '새로 시작';

    actions.appendChild(newBtn);
    actions.appendChild(resumeBtn);

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(actions);
    overlay.appendChild(box);
    overlay.classList.remove('hidden');

    function finish(resume) {
      overlay.classList.add('hidden');
      overlay.innerHTML = '';
      resolve({ resume, autoResume: checkbox.checked });
    }

    resumeBtn.addEventListener('click', () => finish(true));
    newBtn.addEventListener('click', () => finish(false));
  });
}

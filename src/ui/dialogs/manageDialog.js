/**
 * Shows the "통합 문서 관리" modal (File-tab ribbon action) letting the user
 * reset today's stats or wipe all progress — the desktop equivalent of the
 * web version's 기록 관리 dialog, which this app never had a UI for.
 */
export function showManageDialog({ onResetToday, onResetAll } = {}) {
  const overlay = document.getElementById('manage-dialog-overlay');
  overlay.innerHTML = '';

  const box = document.createElement('div');
  box.className = 'dialog-box';

  const title = document.createElement('div');
  title.className = 'dialog-title';
  title.textContent = '통합 문서 관리';

  const body = document.createElement('div');
  body.className = 'dialog-body';
  const message = document.createElement('p');
  message.textContent = '오늘 통계만 지우거나, 전체 학습 기록을 초기화할 수 있습니다.';
  body.appendChild(message);

  const actions = document.createElement('div');
  actions.className = 'dialog-actions manage-actions';

  const todayBtn = document.createElement('button');
  todayBtn.className = 'dialog-btn';
  todayBtn.textContent = '오늘 기록 초기화';

  const allBtn = document.createElement('button');
  allBtn.className = 'dialog-btn danger';
  allBtn.textContent = '전체 기록 초기화';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'dialog-btn primary';
  closeBtn.textContent = '닫기';

  function close() {
    overlay.classList.add('hidden');
    overlay.innerHTML = '';
  }

  todayBtn.addEventListener('click', () => {
    if (!confirm('오늘 학습한 단어 수/정답 수를 초기화할까요? (단어별 기록은 그대로 남습니다)')) return;
    onResetToday();
    close();
  });

  allBtn.addEventListener('click', () => {
    if (!confirm('정말 전체 학습 기록을 초기화할까요? 모든 단어의 정답/오답/스트릭이 사라지고 되돌릴 수 없습니다.')) return;
    onResetAll();
    close();
  });

  closeBtn.addEventListener('click', close);

  actions.appendChild(todayBtn);
  actions.appendChild(allBtn);
  actions.appendChild(closeBtn);

  box.appendChild(title);
  box.appendChild(body);
  box.appendChild(actions);
  overlay.appendChild(box);
  overlay.classList.remove('hidden');
}

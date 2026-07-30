const HOME_GROUPS = [
  { label: '클립보드', buttons: [{ icon: '📋', text: '붙여넣기' }] },
  {
    label: '글꼴',
    buttons: [
      { icon: '🔤', text: '글꼴' },
      { icon: 'B', text: '굵게' },
      { icon: 'I', text: '기울임' }
    ]
  },
  {
    label: '맞춤',
    buttons: [
      { icon: '▭', text: '맞춤' },
      { icon: '⤵', text: '줄바꿈' }
    ]
  },
  {
    label: '표시 형식',
    buttons: [
      { icon: '%', text: '백분율' },
      { icon: '#,##0', text: '쉼표' }
    ]
  },
  {
    label: '스타일',
    buttons: [
      { icon: '🎨', text: '조건부 서식' },
      { icon: '▦', text: '표 서식' }
    ]
  },
  {
    label: '셀',
    buttons: [
      { icon: '➕', text: '삽입' },
      { icon: '➖', text: '삭제' }
    ]
  },
  {
    label: '편집',
    buttons: [
      { icon: 'Σ', text: '자동 합계' },
      { icon: '🔍', text: '찾기' },
      { icon: '🧹', text: '지우기', action: 'clearSheet' }
    ]
  }
];

export function initRibbon({ onClearSheet } = {}) {
  const tabs = document.querySelectorAll('.ribbon-tab');
  const body = document.getElementById('ribbon-body');
  const actions = { clearSheet: onClearSheet };

  function renderHome() {
    body.innerHTML = '';
    HOME_GROUPS.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'ribbon-group';

      const buttonsEl = document.createElement('div');
      buttonsEl.className = 'ribbon-group-buttons';
      group.buttons.forEach((btn) => {
        const btnEl = document.createElement('div');
        btnEl.className = 'ribbon-btn';
        const iconEl = document.createElement('span');
        iconEl.className = 'ribbon-btn-icon';
        iconEl.textContent = btn.icon;
        const textEl = document.createElement('span');
        textEl.textContent = btn.text;
        btnEl.appendChild(iconEl);
        btnEl.appendChild(textEl);
        if (btn.action && actions[btn.action]) {
          btnEl.addEventListener('click', actions[btn.action]);
        }
        buttonsEl.appendChild(btnEl);
      });

      const labelEl = document.createElement('div');
      labelEl.className = 'ribbon-group-label';
      labelEl.textContent = group.label;

      groupEl.appendChild(buttonsEl);
      groupEl.appendChild(labelEl);
      body.appendChild(groupEl);
    });
  }

  function renderPlaceholder(tabLabel) {
    body.innerHTML = '';
    const groupEl = document.createElement('div');
    groupEl.className = 'ribbon-group';
    const labelEl = document.createElement('div');
    labelEl.className = 'ribbon-group-label';
    labelEl.textContent = tabLabel;
    groupEl.appendChild(document.createElement('div'));
    groupEl.appendChild(labelEl);
    body.appendChild(groupEl);
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (tab.dataset.tab === 'home') renderHome();
      else renderPlaceholder(tab.textContent);
    });
  });

  renderHome();
}

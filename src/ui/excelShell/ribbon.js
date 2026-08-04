const FILE_GROUPS = [
  {
    label: '정보',
    buttons: [{ icon: '🗂', text: '통합 문서 관리', action: 'manageWorkbook' }]
  }
];

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
  },
  {
    label: '모드',
    buttons: [
      { icon: '🔤', text: '클래식', mode: 'classic' },
      { icon: '📖', text: '예문', mode: 'example' },
      { icon: '⌨️', text: '타이핑', mode: 'typing' },
      { icon: '🔗', text: '매칭', mode: 'matching' }
    ]
  }
];

// Tracked at module scope (not per-render) so the "pressed" look survives the
// user clicking away to another ribbon tab and back to Home.
let activeMode = 'classic';

export function initRibbon({ onClearSheet, onManageWorkbook, onSwitchMode } = {}) {
  const tabs = document.querySelectorAll('.ribbon-tab');
  const body = document.getElementById('ribbon-body');
  const actions = { clearSheet: onClearSheet, manageWorkbook: onManageWorkbook };

  function renderGroups(groups) {
    body.innerHTML = '';
    groups.forEach((group) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'ribbon-group';

      const buttonsEl = document.createElement('div');
      buttonsEl.className = 'ribbon-group-buttons';
      group.buttons.forEach((btn) => {
        const btnEl = document.createElement('div');
        btnEl.className = 'ribbon-btn';
        if (btn.mode) {
          btnEl.dataset.mode = btn.mode;
          if (btn.mode === activeMode) btnEl.classList.add('active');
        } else {
          btnEl.dataset.action = btn.action || '';
        }
        const iconEl = document.createElement('span');
        iconEl.className = 'ribbon-btn-icon';
        iconEl.textContent = btn.icon;
        const textEl = document.createElement('span');
        textEl.textContent = btn.text;
        btnEl.appendChild(iconEl);
        btnEl.appendChild(textEl);
        if (btn.mode && onSwitchMode) {
          btnEl.addEventListener('click', () => onSwitchMode(btn.mode));
        } else if (btn.action && actions[btn.action]) {
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

  function renderHome() {
    renderGroups(HOME_GROUPS);
  }

  function renderFile() {
    renderGroups(FILE_GROUPS);
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
      else if (tab.dataset.tab === 'file') renderFile();
      else renderPlaceholder(tab.textContent);
    });
  });

  renderHome();
}

/** Reflects the active mode as a pressed look on the matching ribbon button, if it's currently rendered. */
export function setActiveMode(modeName) {
  activeMode = modeName;
  document.querySelectorAll('.ribbon-btn[data-mode]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.mode === modeName);
  });
}

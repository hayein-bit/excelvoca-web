function defaultSettings() {
  return {
    autoResume: false,
    shortcuts: {
      answer1: '1',
      answer2: '2',
      answer3: '3',
      answer4: '4',
      dontKnow: '5',
      bossMode: 'Tab',
      pause: 'Escape'
    }
  };
}

export async function loadSettings() {
  const stored = await window.excelvoca.loadSettings();
  if (!stored) return defaultSettings();
  return {
    ...defaultSettings(),
    ...stored,
    shortcuts: { ...defaultSettings().shortcuts, ...(stored.shortcuts || {}) }
  };
}

export function saveSettings(settings) {
  return window.excelvoca.saveSettings(settings);
}

export function initSheetTabs(onChange) {
  const tabs = document.querySelectorAll('.sheet-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      if (onChange) onChange(tab.dataset.sheet);
    });
  });
}

/** Programmatically activates the tab matching `index` (e.g. when the game auto-advances sheets). */
export function setActiveSheetTab(index) {
  const tabs = document.querySelectorAll('.sheet-tab');
  tabs.forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.sheet === String(index));
  });
}

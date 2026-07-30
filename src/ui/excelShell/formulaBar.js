export function setFormulaValue(text) {
  const el = document.getElementById('formula-input');
  if (el) el.textContent = text || '';
}

export function setStatusLeft(text) {
  const el = document.getElementById('status-left');
  if (el) el.textContent = text;
}

export function setStatusRight(text) {
  const el = document.getElementById('status-right');
  if (el) el.textContent = text;
}

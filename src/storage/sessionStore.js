/** Loads the autosaved session (current question/combo/position/mode), or null if none. */
export async function loadSession() {
  return window.excelvoca.loadSession();
}

export function saveSession(session) {
  return window.excelvoca.saveSession({ ...session, lastSavedAt: new Date().toISOString() });
}

export function clearSession() {
  return window.excelvoca.clearSession();
}

/** A session is worth offering to resume if it actually captured an in-progress question. */
export function hasResumableState(session) {
  return Boolean(session && session.question && session.question.key);
}

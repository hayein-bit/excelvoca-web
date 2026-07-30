// Fill these in after creating a PRIVATE GitHub repo to hold progress.json/
// session.json (never the public code repo — those files are personal study data).
const REPO_OWNER = 'hayein-bit';
const REPO_NAME = 'excelvoca-data';
const DATA_PATH = 'data'; // folder inside that repo holding progress.json etc.

const TOKEN_BLOB_KEY = 'excelvoca_gh_token_enc';
const SETTINGS_KEY = 'excelvoca_settings';

/**
 * Drop-in replacement for src/main/preload.js's `window.excelvoca` bridge,
 * backed by the GitHub Contents API (a private repo) instead of Electron IPC/
 * fs — so every module under src/ (wordRepository, progressStore, sessionStore,
 * settingsStore, dailyLogStore, and everything in src/game/) works unmodified.
 * See CLAUDE.md's "Web version" section for why GitHub instead of OneDrive.
 *
 * The real GitHub token is entered once (setupToken) and stored PIN-encrypted
 * (AES-GCM via Web Crypto) in localStorage — never in plaintext, and never in
 * the source code, since this repo is public. Every later visit just needs the
 * short PIN (unlock) instead of retyping the long token. This is a convenience
 * gate, not real security: a 4-digit PIN is only 10,000 combinations, so it
 * only protects against a casual glance at the page, not a determined attacker
 * with access to the encrypted blob.
 */

let cachedToken = '';

function getToken() {
  return cachedToken;
}

export function isSignedIn() {
  return Boolean(cachedToken);
}

export function hasStoredToken() {
  return Boolean(localStorage.getItem(TOKEN_BLOB_KEY));
}

async function deriveKey(pin, salt) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveKey'
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** First-time setup: encrypts `token` with `pin` and stores the blob (not the token) in localStorage. */
export async function setupToken(token, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(token.trim()));
  const blob = { salt: Array.from(salt), iv: Array.from(iv), cipher: Array.from(new Uint8Array(cipherBuf)) };
  localStorage.setItem(TOKEN_BLOB_KEY, JSON.stringify(blob));
  cachedToken = token.trim();
}

/** Decrypts the stored blob with `pin`; returns false (without throwing) if the PIN is wrong. */
export async function unlock(pin) {
  const raw = localStorage.getItem(TOKEN_BLOB_KEY);
  if (!raw) return false;
  try {
    const blob = JSON.parse(raw);
    const key = await deriveKey(pin, new Uint8Array(blob.salt));
    const plainBuf = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: new Uint8Array(blob.iv) },
      key,
      new Uint8Array(blob.cipher).buffer
    );
    cachedToken = new TextDecoder().decode(plainBuf);
    return true;
  } catch {
    return false;
  }
}

export function signOut() {
  localStorage.removeItem(TOKEN_BLOB_KEY);
  cachedToken = '';
}

const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${DATA_PATH}`;

async function ghRequest(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${API_BASE}/${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      ...(options.headers || {})
    }
  });
  if (res.status === 401) {
    signOut();
    throw new Error('GitHub 토큰이 잘못됐거나 만료됐습니다. 다시 연결해주세요.');
  }
  return res;
}

function b64EncodeUtf8(str) {
  return btoa(unescape(encodeURIComponent(str)));
}

function b64DecodeUtf8(str) {
  return decodeURIComponent(escape(atob(str.replace(/\n/g, ''))));
}

async function ghGetFile(path) {
  const res = await ghRequest(path);
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${path} failed: ${res.status}`);
  const json = await res.json();
  return { text: b64DecodeUtf8(json.content), sha: json.sha };
}

async function ghPutFile(path, text, message) {
  // Contents API requires the current sha to update an existing file.
  const { sha } = await ghGetFile(path);
  const res = await ghRequest(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || `update ${path}`,
      content: b64EncodeUtf8(text),
      sha: sha || undefined
    })
  });
  if (!res.ok) throw new Error(`GitHub PUT ${path} failed: ${res.status}`);
  return true;
}

async function ghDeleteFile(path, message) {
  const { sha } = await ghGetFile(path);
  if (!sha) return true;
  const res = await ghRequest(path, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || `delete ${path}`, sha })
  });
  if (!res.ok && res.status !== 404) throw new Error(`GitHub DELETE ${path} failed: ${res.status}`);
  return true;
}

async function loadJson(fileName) {
  const { text } = await ghGetFile(fileName);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function saveJson(fileName, data) {
  return ghPutFile(fileName, JSON.stringify(data, null, 2), `update ${fileName}`);
}

window.excelvoca = {
  // Word list is static app content, not personal data — served straight off
  // the public GitHub Pages site instead of the private data repo/API.
  loadWords: async () => {
    const res = await fetch('../data/teps_words.csv');
    if (!res.ok) throw new Error('teps_words.csv를 불러올 수 없습니다.');
    return res.text();
  },
  loadProgress: () => loadJson('progress.json'),
  saveProgress: (data) => saveJson('progress.json', data),
  loadSession: () => loadJson('session.json'),
  saveSession: (data) => saveJson('session.json', data),
  clearSession: () => ghDeleteFile('session.json', 'clear session'),
  // Settings (autoResume, shortcuts) are per-device, not something that needs
  // to follow you between devices, so they just live in this browser's storage.
  loadSettings: async () => {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? JSON.parse(raw) : null;
  },
  saveSettings: (data) => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
    return Promise.resolve(true);
  },
  // study_log.csv is a desktop-only, human-facing export (see CLAUDE.md) — not
  // worth round-tripping through the GitHub API from here.
  upsertDailyLog: () => Promise.resolve(true)
};

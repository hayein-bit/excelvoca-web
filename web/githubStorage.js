// Fill these in after creating a PRIVATE GitHub repo to hold progress.json/
// session.json (never the public code repo — those files are personal study data).
const REPO_OWNER = 'hayein-bit';
const REPO_NAME = 'excelvoca-data';
const DATA_PATH = 'data'; // folder inside that repo holding progress.json etc.

const TOKEN_KEY = 'excelvoca_gh_token';
const SETTINGS_KEY = 'excelvoca_settings';

/**
 * Drop-in replacement for src/main/preload.js's `window.excelvoca` bridge,
 * backed by the GitHub Contents API (a private repo) instead of Electron IPC/
 * fs — so every module under src/ (wordRepository, progressStore, sessionStore,
 * settingsStore, dailyLogStore, and everything in src/game/) works unmodified.
 * See CLAUDE.md's "Web version" section for why GitHub instead of OneDrive.
 */

function getToken() {
  return localStorage.getItem(TOKEN_KEY) || '';
}

export function isSignedIn() {
  return Boolean(getToken());
}

export function signIn(token) {
  localStorage.setItem(TOKEN_KEY, token.trim());
}

export function signOut() {
  localStorage.removeItem(TOKEN_KEY);
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

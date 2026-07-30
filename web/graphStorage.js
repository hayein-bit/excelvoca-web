import { msalConfig, graphScopes } from './msalConfig.js';

/**
 * Drop-in replacement for src/main/preload.js's `window.excelvoca` bridge,
 * backed by Microsoft Graph instead of local Electron IPC/fs — so every module
 * under src/ (wordRepository, progressStore, sessionStore, settingsStore,
 * dailyLogStore, and everything in src/game/) works completely unmodified.
 * Reads/writes the exact same TEPS/data/*.json files the desktop app uses, so
 * the two stay in sync through OneDrive rather than through a separate store.
 */

const msalInstance = new msal.PublicClientApplication(msalConfig);
let account = null;

export async function init() {
  await msalInstance.initialize();
  const response = await msalInstance.handleRedirectPromise();
  if (response && response.account) {
    account = response.account;
  } else {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) account = accounts[0];
  }
  return account;
}

export function isSignedIn() {
  return Boolean(account);
}

export function signIn() {
  return msalInstance.loginRedirect({ scopes: graphScopes });
}

export function signOut() {
  return msalInstance.logoutRedirect();
}

async function getToken() {
  if (!account) throw new Error('Not signed in to OneDrive yet.');
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: graphScopes, account });
    return result.accessToken;
  } catch (err) {
    // Silent refresh failed (e.g. needs re-consent) — fall back to an interactive
    // redirect. This navigates away, so nothing after this call will run.
    await msalInstance.acquireTokenRedirect({ scopes: graphScopes });
    throw err;
  }
}

// Assumes the project folder sits directly under the OneDrive root, matching
// this user's actual path (OneDrive/TEPS/data/...). Adjust if that ever moves.
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0/me/drive/root:/TEPS/data';

async function graphGetText(fileName) {
  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}/${fileName}:/content`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Graph GET ${fileName} failed: ${res.status}`);
  return res.text();
}

async function graphPutText(fileName, text, contentType) {
  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}/${fileName}:/content`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
    body: text
  });
  if (!res.ok) throw new Error(`Graph PUT ${fileName} failed: ${res.status}`);
  return true;
}

async function graphDelete(fileName) {
  const token = await getToken();
  const res = await fetch(`${GRAPH_BASE}/${fileName}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok && res.status !== 404) throw new Error(`Graph DELETE ${fileName} failed: ${res.status}`);
  return true;
}

async function loadJson(fileName) {
  const text = await graphGetText(fileName);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function saveJson(fileName, data) {
  return graphPutText(fileName, JSON.stringify(data, null, 2), 'application/json');
}

// Mirrors src/main/ipc.js's upsertDailyLog exactly (same header/keys/escaping/
// upsert-by-date-column logic) so study_log.csv stays in the same format either
// app writes it in.
const DAILY_LOG_HEADER = ['날짜', '학습단어수', '정답수', '정확도(%)', '최고콤보', '마스터단어수', '복습필요단어수', '직급'];
const DAILY_LOG_KEYS = ['date', 'studied', 'correct', 'accuracy', 'longestCombo', 'mastered', 'needsReview', 'rank'];

function csvEscape(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function upsertDailyLog(row) {
  let raw = await graphGetText('study_log.csv');
  let lines = [];
  if (raw) {
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  }
  if (lines.length === 0) lines = [DAILY_LOG_HEADER.join(',')];

  const newLine = DAILY_LOG_KEYS.map((key) => csvEscape(row[key])).join(',');
  const rowIndex = lines.findIndex((line) => line.startsWith(`${row.date},`));
  if (rowIndex >= 0) lines[rowIndex] = newLine;
  else lines.push(newLine);

  await graphPutText('study_log.csv', `﻿${lines.join('\n')}\n`, 'text/csv');
  return true;
}

window.excelvoca = {
  loadWords: async () => {
    const text = await graphGetText('teps_words.csv');
    if (text === null) throw new Error('OneDrive의 TEPS/data/teps_words.csv를 찾을 수 없습니다.');
    return text;
  },
  loadProgress: () => loadJson('progress.json'),
  saveProgress: (data) => saveJson('progress.json', data),
  loadSession: () => loadJson('session.json'),
  saveSession: (data) => saveJson('session.json', data),
  clearSession: () => graphDelete('session.json'),
  loadSettings: () => loadJson('settings.json'),
  saveSettings: (data) => saveJson('settings.json', data),
  upsertDailyLog
};

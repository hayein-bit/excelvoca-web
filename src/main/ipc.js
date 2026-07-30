const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(app.getAppPath(), 'data');
const WORDS_CSV_PATH = path.join(DATA_DIR, 'teps_words.csv');
const GITHUB_CONFIG_PATH = path.join(DATA_DIR, 'github-sync.json');

// Progress/session/settings live in the project's own data/ folder (next to
// teps_words.csv) rather than the OS per-user profile, so it's all in one
// visible place instead of scattered into %APPDATA%.
function dataFile(name) {
  return path.join(DATA_DIR, name);
}

function readJsonSafe(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

// Write to a temp file then rename, so a crash mid-write can't corrupt the real file.
function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

// --- GitHub sync (progress.json / session.json only) -----------------------
// Lets the web version (web/githubStorage.js, on a phone or a browser with no
// OneDrive access) share the exact same progress/session as this desktop app,
// via a private GitHub repo instead of a second database. Configured by
// hand-editing data/github-sync.json (never committed anywhere) with a
// personal access token + the private repo's owner/name. If that file is
// missing/unfilled, everything falls back to local-file-only behavior exactly
// as before this existed.
function loadGithubConfig() {
  const cfg = readJsonSafe(GITHUB_CONFIG_PATH);
  if (!cfg || !cfg.token || cfg.token.startsWith('YOUR_')) return null;
  return cfg;
}

function githubApiBase(cfg) {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/data`;
}

async function ghRequest(cfg, filePath, options = {}) {
  return fetch(`${githubApiBase(cfg)}/${filePath}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${cfg.token}`,
      Accept: 'application/vnd.github+json',
      ...(options.headers || {})
    }
  });
}

async function ghGetFile(cfg, filePath) {
  const res = await ghRequest(cfg, filePath);
  if (res.status === 404) return { text: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET ${filePath} failed: ${res.status}`);
  const json = await res.json();
  return { text: Buffer.from(json.content, 'base64').toString('utf-8'), sha: json.sha };
}

async function ghPutFileOnce(cfg, filePath, text, message) {
  const { sha } = await ghGetFile(cfg, filePath);
  const res = await ghRequest(cfg, filePath, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: message || `update ${filePath}`,
      content: Buffer.from(text, 'utf-8').toString('base64'),
      sha: sha || undefined
    })
  });
  if (!res.ok) {
    const err = new Error(`GitHub PUT ${filePath} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
}

async function ghDeleteFileOnce(cfg, filePath, message) {
  const { sha } = await ghGetFile(cfg, filePath);
  if (!sha) return;
  const res = await ghRequest(cfg, filePath, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message || `delete ${filePath}`, sha })
  });
  if (!res.ok && res.status !== 404) {
    const err = new Error(`GitHub DELETE ${filePath} failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
}

// The Contents API does a read-modify-write commit per call, so two writes to
// the same repo close together (e.g. progress.json and session.json saved in
// the same persistAll()) can race and one gets HTTP 409 (stale sha) even
// though each call individually re-fetches the sha first. Two defenses:
// serialize all GitHub calls from this process through one queue (this alone
// fixed the observed 409s from persistAll()'s near-simultaneous saves), and
// retry once on 409 in case another *process* (e.g. the web app) wins a race.
let githubQueue = Promise.resolve();

function enqueueGithub(task) {
  const run = githubQueue.then(task, task);
  githubQueue = run.then(
    () => {},
    () => {}
  );
  return run;
}

async function withRetryOn409(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err.status !== 409) throw err;
    return fn();
  }
}

function ghPutFile(cfg, filePath, text, message) {
  return enqueueGithub(() => withRetryOn409(() => ghPutFileOnce(cfg, filePath, text, message)));
}

function ghDeleteFile(cfg, filePath, message) {
  return enqueueGithub(() => withRetryOn409(() => ghDeleteFileOnce(cfg, filePath, message)));
}

const DAILY_LOG_HEADER = ['날짜', '학습단어수', '정답수', '정확도(%)', '최고콤보', '마스터단어수', '복습필요단어수', '직급'];
const DAILY_LOG_KEYS = ['date', 'studied', 'correct', 'accuracy', 'longestCombo', 'mastered', 'needsReview', 'rank'];

function csvEscape(value) {
  const str = String(value);
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

/** Upserts today's row in data/study_log.csv — a plain, Excel-openable daily summary log. */
function upsertDailyLog(row) {
  const filePath = dataFile('study_log.csv');
  let lines = [];
  if (fs.existsSync(filePath)) {
    let raw = fs.readFileSync(filePath, 'utf-8');
    if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
    lines = raw.split(/\r?\n/).filter((line) => line.length > 0);
  }
  if (lines.length === 0) {
    lines = [DAILY_LOG_HEADER.join(',')];
  }

  const newLine = DAILY_LOG_KEYS.map((key) => csvEscape(row[key])).join(',');
  const rowIndex = lines.findIndex((line) => line.startsWith(`${row.date},`));
  if (rowIndex >= 0) {
    lines[rowIndex] = newLine;
  } else {
    lines.push(newLine);
  }

  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  fs.writeFileSync(tmpPath, `﻿${lines.join('\n')}\n`, 'utf-8');
  fs.renameSync(tmpPath, filePath);
}

function registerIpcHandlers() {
  ipcMain.handle('words:load', () => {
    return fs.readFileSync(WORDS_CSV_PATH, 'utf-8');
  });

  ipcMain.handle('progress:load', async () => {
    const cfg = loadGithubConfig();
    if (cfg) {
      try {
        const { text } = await ghGetFile(cfg, 'progress.json');
        if (text) {
          const data = JSON.parse(text);
          writeJsonAtomic(dataFile('progress.json'), data); // keep a local cache too
          return data;
        }
      } catch (err) {
        console.error('GitHub progress:load failed, falling back to local file:', err);
      }
    }
    return readJsonSafe(dataFile('progress.json'));
  });

  ipcMain.handle('progress:save', async (event, data) => {
    writeJsonAtomic(dataFile('progress.json'), data);
    const cfg = loadGithubConfig();
    if (cfg) {
      try {
        await ghPutFile(cfg, 'progress.json', JSON.stringify(data, null, 2), 'update progress.json');
      } catch (err) {
        console.error('GitHub progress:save failed (local copy still saved):', err);
      }
    }
    return true;
  });

  ipcMain.handle('session:load', async () => {
    const cfg = loadGithubConfig();
    if (cfg) {
      try {
        const { text } = await ghGetFile(cfg, 'session.json');
        if (text) {
          const data = JSON.parse(text);
          writeJsonAtomic(dataFile('session.json'), data);
          return data;
        }
      } catch (err) {
        console.error('GitHub session:load failed, falling back to local file:', err);
      }
    }
    return readJsonSafe(dataFile('session.json'));
  });

  ipcMain.handle('session:save', async (event, data) => {
    writeJsonAtomic(dataFile('session.json'), data);
    const cfg = loadGithubConfig();
    if (cfg) {
      try {
        await ghPutFile(cfg, 'session.json', JSON.stringify(data, null, 2), 'update session.json');
      } catch (err) {
        console.error('GitHub session:save failed (local copy still saved):', err);
      }
    }
    return true;
  });

  ipcMain.handle('session:clear', async () => {
    const filePath = dataFile('session.json');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    const cfg = loadGithubConfig();
    if (cfg) {
      try {
        await ghDeleteFile(cfg, 'session.json', 'clear session');
      } catch (err) {
        console.error('GitHub session:clear failed:', err);
      }
    }
    return true;
  });

  ipcMain.handle('settings:load', () => {
    return readJsonSafe(dataFile('settings.json'));
  });

  ipcMain.handle('settings:save', (event, data) => {
    writeJsonAtomic(dataFile('settings.json'), data);
    return true;
  });

  ipcMain.handle('stats:upsertDailyLog', (event, row) => {
    upsertDailyLog(row);
    return true;
  });
}

module.exports = { registerIpcHandlers };

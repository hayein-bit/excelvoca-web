const { app, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(app.getAppPath(), 'data');
const WORDS_CSV_PATH = path.join(DATA_DIR, 'teps_words.csv');

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

  ipcMain.handle('progress:load', () => {
    return readJsonSafe(dataFile('progress.json'));
  });

  ipcMain.handle('progress:save', (event, data) => {
    writeJsonAtomic(dataFile('progress.json'), data);
    return true;
  });

  ipcMain.handle('session:load', () => {
    return readJsonSafe(dataFile('session.json'));
  });

  ipcMain.handle('session:save', (event, data) => {
    writeJsonAtomic(dataFile('session.json'), data);
    return true;
  });

  ipcMain.handle('session:clear', () => {
    const filePath = dataFile('session.json');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
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

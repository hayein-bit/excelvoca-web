// Minimal RFC4180-style CSV parser: handles quoted fields, escaped quotes ("")
// and commas/newlines inside quotes. Good enough for our word list, no deps.

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };
  const pushRow = () => {
    pushField();
    rows.push(row);
    row = [];
  };

  // Strip a leading UTF-8 BOM — the file is saved with one so Excel opens the
  // Korean text correctly, but it would otherwise land inside the first field.
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const normalized = withoutBom.replace(/\r\n/g, '\n');
  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];

    if (inQuotes) {
      if (ch === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  // last field/row (handles files without trailing newline)
  if (field.length > 0 || row.length > 0) pushRow();

  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

/**
 * Parses raw CSV text with header row: word,meaning,pos,example,level
 * Column order in the file doesn't matter — matched by header name.
 *
 * A word can appear on more than one row (polysemy — e.g. "address" as a
 * noun and as a verb): each row is its own quiz item with its own progress
 * tracking, identified by `key` (word+pos+meaning). The plain `word` field
 * stays around purely for display/grouping.
 *
 * @param {string} text
 * @returns {Array<{key:string, word:string, meaning:string, pos:string, example:string, exampleKo:string, example2:string, example2Ko:string, level:number}>}
 */
export function loadWordsFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) return [];

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = (name) => header.indexOf(name);

  const wordIdx = colIndex('word');
  const meaningIdx = colIndex('meaning');
  const posIdx = colIndex('pos');
  const exampleIdx = colIndex('example');
  const exampleKoIdx = colIndex('example_ko');
  const example2Idx = colIndex('example2');
  const example2KoIdx = colIndex('example2_ko');
  const levelIdx = colIndex('level');

  const words = [];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const word = (r[wordIdx] || '').trim();
    const meaning = (r[meaningIdx] || '').trim();
    if (!word || !meaning) continue;

    const pos = (posIdx >= 0 ? r[posIdx] : '').trim();

    words.push({
      key: `${word}|${pos}|${meaning}`,
      word,
      meaning,
      pos,
      example: (exampleIdx >= 0 ? r[exampleIdx] : '').trim(),
      exampleKo: (exampleKoIdx >= 0 ? r[exampleKoIdx] : '').trim(),
      // Optional second example (see 예문 모드 in Architecture) — most rows don't
      // have one yet, so example mode falls back to just the first when empty.
      example2: (example2Idx >= 0 ? r[example2Idx] : '').trim(),
      example2Ko: (example2KoIdx >= 0 ? r[example2KoIdx] : '').trim(),
      level: levelIdx >= 0 ? parseInt(r[levelIdx], 10) || 1 : 1
    });
  }
  return words;
}

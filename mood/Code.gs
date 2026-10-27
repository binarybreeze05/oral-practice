// Mood tracker backend. Paste into Extensions > Apps Script of a Google Sheet,
// then Deploy > New deployment > Web app (Execute as: Me, Who has access: Anyone).

const SHEET_NAME = 'Moods';
const LABELS = ['', 'Unstoppable', 'Thriving', 'Good', 'Flat', 'Drained', 'Miserable'];

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.appendRow(['Time', 'Mood', 'Label', 'Device', 'ID']);
    sh.setFrozenRows(1);
    sh.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function rows_(sh) {
  const n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, 5).getValues() : [];
}

// POST body: {entries: [{id, ts, mood, device}], deletes: [id]}. Duplicate ids
// are ignored, so the page can safely resend its offline queue.
function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const entries = body.entries || [];
  const deletes = new Set((body.deletes || []).map(String));
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_();
    const ids = rows_(sh).map(r => String(r[4]));
    for (let i = ids.length - 1; i >= 0; i--) {
      if (deletes.has(ids[i])) sh.deleteRow(i + 2);
    }
    const seen = new Set(ids);
    const fresh = entries
      .filter(x => x.id && !seen.has(String(x.id)) && !deletes.has(String(x.id)) && x.mood >= 1 && x.mood <= 6)
      .map(x => [new Date(x.ts), x.mood, LABELS[x.mood], x.device || '', String(x.id)]);
    if (fresh.length) {
      sh.getRange(sh.getLastRow() + 1, 1, fresh.length, 5).setValues(fresh);
    }
    return json_({ok: true, saved: entries.map(x => x.id)});
  } finally {
    lock.releaseLock();
  }
}

// GET ?days=60 returns entries from the last N days (default 60).
function doGet(e) {
  const days = Number((e && e.parameter && e.parameter.days) || 60);
  const since = Date.now() - days * 864e5;
  const entries = rows_(sheet_())
    .filter(r => r[0] instanceof Date && r[0].getTime() >= since)
    .map(r => ({id: String(r[4]), ts: r[0].toISOString(), mood: Number(r[1]), device: r[3]}));
  return json_({ok: true, entries});
}

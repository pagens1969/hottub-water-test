/**
 * Hot Tub Water Test — Google Apps Script Web App backend
 *
 * This runs INSIDE the "Hot Tub Test Log" Google Sheet (Extensions > Apps Script)
 * and exposes a small JSON API that the Hot Tub Test phone app calls directly.
 * No Google Cloud project or service account needed — Apps Script Web Apps
 * run under your own Google account and just need to be deployed once.
 *
 * Sheet columns (row 1 = header), matching the existing log:
 * A Date | B Time | C pH | D Bromine(ppm) | E Alkalinity(ppm) | F Status |
 * G Recommended Treatment | H Treatment Applied | I Followed Recommendation? |
 * J Hours Since Previous Test | K Notes
 *
 * SETUP (one-time):
 * 1. Open the "Hot Tub Test Log" sheet -> Extensions -> Apps Script.
 * 2. Delete any placeholder code and paste this entire file in.
 * 3. Run > set up the secret: in the Apps Script editor, open the "Project Settings"
 *    (gear icon) -> Script Properties -> Add script property:
 *      Property: HOTTUB_TOKEN
 *      Value:    <make up a long random password, e.g. a passphrase>
 *    This is the shared secret the phone app will send with every request.
 * 4. Click Deploy > New deployment.
 *      Type: Web app
 *      Execute as: Me
 *      Who has access: Anyone (this is fine — the token protects it)
 * 5. Authorize when prompted (it needs permission to read/write this sheet).
 * 6. Copy the "Web app URL" it gives you (ends in /exec) — paste that into the
 *    Hot Tub Test app's Settings screen as the Backend URL, along with the
 *    same token you set in step 3.
 * 7. If you ever edit this code again, you must Deploy > Manage deployments ->
 *    edit (pencil) -> New version, otherwise the live URL keeps running the old code.
 */

var SHEET_NAME = 'Sheet1'; // change if your tab is named differently
var TIMEZONE = 'Europe/London'; // used for date/time parsing (handles BST/GMT automatically)

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0]; // first sheet/tab, regardless of its name
  return sheet;
}

function checkToken_(token) {
  var expected = PropertiesService.getScriptProperties().getProperty('HOTTUB_TOKEN');
  return expected && token && token === expected;
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Parses the sheet's existing "Date" (e.g. 2026-09-13) and "Time" (e.g. 10:45 BST / 19:59)
 * columns into a real JS Date, treating them as wall-clock time in TIMEZONE.
 */
function parseRowDateTime_(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  var cleanTime = String(timeStr).replace(/\s*(BST|GMT|UTC)\s*$/i, '').trim();
  var iso = String(dateStr).trim() + 'T' + cleanTime + ':00';
  // Interpret as a wall-clock time in TIMEZONE, not the script's default TZ.
  var d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d;
}

function computeHoursSincePrevious_(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return ''; // no previous data rows yet
  var prevDate = sheet.getRange(lastRow, 1).getValue();
  var prevTime = sheet.getRange(lastRow, 2).getValue();
  var prevDateStr = (prevDate instanceof Date)
    ? Utilities.formatDate(prevDate, TIMEZONE, 'yyyy-MM-dd')
    : String(prevDate);
  var prevTimeStr = (prevTime instanceof Date)
    ? Utilities.formatDate(prevTime, TIMEZONE, 'HH:mm')
    : String(prevTime);
  var prevDt = parseRowDateTime_(prevDateStr, prevTimeStr);
  if (!prevDt) return '';
  var nowDt = new Date();
  var diffMs = nowDt.getTime() - prevDt.getTime();
  var hours = diffMs / (1000 * 60 * 60);
  return Math.round(hours * 10) / 10; // one decimal place
}

function doGet(e) {
  var params = (e && e.parameter) || {};
  var action = params.action;
  var token = params.token;

  if (!checkToken_(token)) {
    return jsonOut_({ ok: false, error: 'Invalid or missing token' });
  }

  if (action === 'ping') {
    return jsonOut_({ ok: true });
  }

  if (action === 'history') {
    var limit = parseInt(params.limit, 10) || 5;
    var sheet = getSheet_();
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return jsonOut_({ ok: true, rows: [] });

    var firstRow = Math.max(2, lastRow - limit + 1);
    var numRows = lastRow - firstRow + 1;
    var values = sheet.getRange(firstRow, 1, numRows, 11).getValues();

    var rows = values.map(function (r) {
      return {
        date: formatCell_(r[0]),
        time: formatCell_(r[1]),
        ph: r[2],
        bromine: r[3],
        alkalinity: r[4],
        status: r[5],
        recommended: r[6],
        applied: r[7],
        followed: r[8],
        hours: r[9],
        notes: r[10]
      };
    });

    return jsonOut_({ ok: true, rows: rows });
  }

  return jsonOut_({ ok: false, error: 'Unknown action: ' + action });
}

function formatCell_(v) {
  if (v instanceof Date) {
    // Dates come back as JS Date objects from getValues(); format sensibly.
    var hasTime = v.getHours() !== 0 || v.getMinutes() !== 0;
    return Utilities.formatDate(v, TIMEZONE, hasTime ? 'HH:mm' : 'yyyy-MM-dd');
  }
  return v;
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return jsonOut_({ ok: false, error: 'Invalid JSON body' });
  }

  if (!checkToken_(body.token)) {
    return jsonOut_({ ok: false, error: 'Invalid or missing token' });
  }

  if (body.action !== 'log') {
    return jsonOut_({ ok: false, error: 'Unknown action: ' + body.action });
  }

  var sheet = getSheet_();
  var hours = computeHoursSincePrevious_(sheet);

  var newRow = [
    body.date || '',
    body.time || '',
    body.ph != null ? body.ph : '',
    body.bromine != null ? body.bromine : '',
    body.alkalinity != null ? body.alkalinity : '',
    body.status || '',
    body.recommended || '',
    body.applied || '',
    body.followed || '',
    hours,
    body.notes || ''
  ];

  sheet.appendRow(newRow);

  return jsonOut_({ ok: true, hours: hours, row: sheet.getLastRow() });
}

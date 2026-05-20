/**
 * Daily PDF report emailer.
 *
 * Builds a one-page PDF from the "City Equipment On Hand" tab containing:
 *   - A header line: "MM/DD/YYYY - City Equipment On Hand Daily Report"
 *   - The two header rows of the source tab
 *   - Only data rows where column R = "Yes"
 *   - Only columns A, D, E, F, G, H, I, J, L, M, N, O, P, Q
 *
 * Emails the PDF to every recipient in "Email List"!B2:B.
 *   Subject:   "MM/DD/YYYY - City Equipment On Hand Daily Report"
 *   Filename:  "YYMMDD - City Equipment On Hand Daily Report.pdf"
 *
 * How the PDF is produced: we build a temp sheet inside this same
 * spreadsheet, lay out the report on it, ask the Sheets export endpoint
 * for that one tab as a PDF, attach it to the mail, and delete the temp.
 */

const REPORT_SOURCE_TAB   = 'City Equipment On Hand';
const REPORT_EMAIL_TAB    = 'Email List';

// 1-based source column numbers to include in the report, in order.
// A, D, E, F, G, H, I, J, L, M, N, O, P, Q
const REPORT_OUTPUT_COLS = [1, 4, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17];

// Filter: include a data row only when this column equals this value.
const REPORT_FILTER_COL   = 18;     // R
const REPORT_FILTER_VALUE = 'Yes';  // matched case-insensitively, whitespace-trimmed

// Number of header rows at the top of the source tab to copy verbatim.
const REPORT_SOURCE_HEADER_ROWS = 2;

function sendDailyReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  const source = ss.getSheetByName(REPORT_SOURCE_TAB);
  if (!source) throw new Error(`Tab "${REPORT_SOURCE_TAB}" not found`);

  const recipients = readReportRecipients(ss);
  if (recipients.length === 0) {
    throw new Error(`No email recipients found in "${REPORT_EMAIL_TAB}"!B2:B`);
  }

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const dateLong  = Utilities.formatDate(now, tz, 'MM/dd/yyyy'); // 05/20/2026
  const dateShort = Utilities.formatDate(now, tz, 'yyMMdd');     // 260520

  const reportTitle = `${dateLong} - City Equipment On Hand Daily Report`;
  const pdfFileName = `${dateShort} - City Equipment On Hand Daily Report.pdf`;
  const emailBody =
    'Good Evening All,\n\n' +
    'Attached you will find the daily inventory report for city equipment. ' +
    'This is a new report that we will be publishing daily going forward to ' +
    'help drive visibility into on hand and inbound equipment across the city.\n\n' +
    'This file allows you to see the on hand inventory for your business as ' +
    'well as across the network (SRC = Stanley Ruth, HAM = Hamilton, and ' +
    'HCS = Hickory Centralized Services on Long Island). If you lack inventory ' +
    'that is available elsewhere in network, please reach out to Isaac ' +
    '(inadeau@hickory.ai) to coordinate transfers.';

  const tempName = `__report_${Date.now()}`;
  const temp = ss.insertSheet(tempName);
  let dataRowCount = 0;
  try {
    dataRowCount = layoutReportSheet(temp, source, reportTitle);
    SpreadsheetApp.flush();
    // The export endpoint occasionally 500s when called immediately after
    // a structural change; give Sheets a beat before asking.
    Utilities.sleep(1500);

    const pdfBlob = exportSheetAsPdf(ss.getId(), temp.getSheetId(), pdfFileName);

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: reportTitle,
      body: emailBody,
      attachments: [pdfBlob]
    });

    ss.toast(
      `Sent to ${recipients.length} recipient(s) · ${dataRowCount} row(s)`,
      'Daily Report',
      7
    );
  } finally {
    ss.deleteSheet(temp);
  }
}

/** Returns trimmed, @-containing strings from "Email List"!B2:B. */
function readReportRecipients(ss) {
  const sheet = ss.getSheetByName(REPORT_EMAIL_TAB);
  if (!sheet) throw new Error(`Tab "${REPORT_EMAIL_TAB}" not found`);

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const values = sheet.getRange(2, 2, lastRow - 1, 1).getValues();
  const out = [];
  values.forEach(row => {
    const e = String(row[0] == null ? '' : row[0]).trim();
    if (e && e.indexOf('@') > 0) out.push(e);
  });
  return out;
}

/**
 * Builds the report on `temp` by copying the full source range (preserving
 * borders, colors, fonts, merges, number formats), then deleting the rows
 * that don't pass the filter and the columns that aren't in REPORT_OUTPUT_COLS.
 * Adds the merged title row at row 1.
 *
 * Returns the number of data rows in the final report (excludes the title
 * and the two source header rows).
 */
function layoutReportSheet(temp, source, title) {
  const lastRow = source.getLastRow();
  const lastCol = Math.max(source.getLastColumn(), REPORT_FILTER_COL);
  if (lastRow < REPORT_SOURCE_HEADER_ROWS) return 0;

  // Read source values AND display values. Filtering uses the display
  // values (what the user actually sees in the cell), so cells whose
  // underlying value is 0 / "" / false but whose number format hides
  // them still count as blank. allValues is used later to overwrite the
  // copied formulas with their source-evaluated raw values, which is
  // important for cells like the quantity columns (L, M, N, O) — those
  // hold formulas that reference other cells by position; after copyTo,
  // the relative references would point at the wrong rows in the temp
  // sheet and evaluate to 0.
  const srcRange    = source.getRange(1, 1, lastRow, lastCol);
  const allValues   = srcRange.getValues();
  const allDisplays = srcRange.getDisplayValues();

  const target   = REPORT_FILTER_VALUE.toLowerCase();
  const modelCol = REPORT_OUTPUT_COLS[0];
  const keepSrcRows = [];
  for (let r = 1; r <= REPORT_SOURCE_HEADER_ROWS; r++) keepSrcRows.push(r);
  for (let r = REPORT_SOURCE_HEADER_ROWS + 1; r <= lastRow; r++) {
    const flag = String(allDisplays[r - 1][REPORT_FILTER_COL - 1] || '')
      .trim().toLowerCase();
    if (flag !== target) continue;
    const modelDisplay = String(allDisplays[r - 1][modelCol - 1] || '').trim();
    if (modelDisplay !== '') keepSrcRows.push(r);
  }
  const numKeepRows  = keepSrcRows.length;
  const dataRowCount = numKeepRows - REPORT_SOURCE_HEADER_ROWS;
  const numCols      = REPORT_OUTPUT_COLS.length;

  // Copy the full source range (values + formulas + formatting + merges)
  // into temp starting at row 2. Row 1 is reserved for the report title.
  srcRange.copyTo(temp.getRange(2, 1), SpreadsheetApp.CopyPasteType.PASTE_NORMAL, false);
  SpreadsheetApp.flush();

  // Replace the just-copied formulas with their source-evaluated values.
  // copyTo adjusts relative references (e.g. the quantity columns'
  // formulas reference L$2 — the "HCS" header at row 2 — which after the
  // row-2 shift in temp points at the wrong row and evaluates to 0).
  // Writing the source values directly avoids that. Number formats and
  // merges set by the copyTo are preserved (setValues doesn't touch them).
  temp.getRange(2, 1, lastRow, lastCol).setValues(allValues);
  SpreadsheetApp.flush();

  // Mirror source column widths onto temp before we start deleting things.
  // (copyTo does not carry column widths — they're a sheet-level property.)
  for (let c = 1; c <= lastCol; c++) {
    try { temp.setColumnWidth(c, source.getColumnWidth(c)); } catch (e) {}
  }

  // Delete source rows we're not keeping. Source row r lives at temp row r+1.
  // Walk bottom-up, batching consecutive runs into a single deleteRows call.
  const keepSet = new Set(keepSrcRows);
  let runEnd = -1;
  for (let r = lastRow; r >= 1; r--) {
    if (!keepSet.has(r)) {
      if (runEnd === -1) runEnd = r;
      // continue extending the run downward (which in source coords = lower r)
    } else if (runEnd !== -1) {
      const runStart = r + 1;
      temp.deleteRows(runStart + 1, runEnd - runStart + 1);
      runEnd = -1;
    }
  }
  if (runEnd !== -1) {
    temp.deleteRows(1 + 1, runEnd - 1 + 1); // run starts at source row 1
  }

  // Delete columns we don't want. Walk right-to-left, batching runs.
  const keepColSet = new Set(REPORT_OUTPUT_COLS);
  runEnd = -1;
  for (let c = lastCol; c >= 1; c--) {
    if (!keepColSet.has(c)) {
      if (runEnd === -1) runEnd = c;
    } else if (runEnd !== -1) {
      const runStart = c + 1;
      temp.deleteColumns(runStart, runEnd - runStart + 1);
      runEnd = -1;
    }
  }
  if (runEnd !== -1) {
    temp.deleteColumns(1, runEnd);
  }

  // Trim trailing empty columns so the PDF doesn't show whitespace on the right.
  const maxCols = temp.getMaxColumns();
  if (maxCols > numCols) temp.deleteColumns(numCols + 1, maxCols - numCols);

  // Trim trailing empty rows.
  const usedRows = 1 + numKeepRows; // title row + kept source rows
  const maxRows  = temp.getMaxRows();
  if (maxRows > usedRows) temp.deleteRows(usedRows + 1, maxRows - usedRows);

  // Title row at row 1, merged across the kept columns. Sample the
  // darkest gray in the source's header area (typically the section
  // header strip like "Model Specifications") and apply it, plus thick
  // black borders to match the other header bands.
  const headerBg = sampleSourceHeaderGray(source);
  temp.getRange(1, 1, 1, numCols).merge();
  const titleCell = temp.getRange(1, 1)
    .setValue(title)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');
  if (headerBg) titleCell.setBackground(headerBg);
  titleCell.setBorder(
    true, true, true, true, null, null,
    '#000000', SpreadsheetApp.BorderStyle.SOLID_THICK
  );

  // Freeze title + source header rows so they repeat on every PDF page.
  temp.setFrozenRows(1 + REPORT_SOURCE_HEADER_ROWS);

  return dataRowCount;
}

/**
 * Scans the source's header band (rows 1..REPORT_SOURCE_HEADER_ROWS,
 * columns 1..18) for cell backgrounds, then returns the DARKEST grayscale
 * color (where R ≈ G ≈ B) found. This intentionally skips colored bands
 * like the green "On Hand Quantity" / blue "On Order Quantity" sections
 * and picks the gray section-header strip. Returns null if no qualifying
 * gray is found.
 */
function sampleSourceHeaderGray(source) {
  const numCols = Math.min(source.getLastColumn() || 0, 18);
  if (numCols < 1) return null;
  const bgs = source.getRange(1, 1, REPORT_SOURCE_HEADER_ROWS, numCols).getBackgrounds();

  let darkest = null;
  let darkestBrightness = Infinity;
  for (let r = 0; r < bgs.length; r++) {
    for (let c = 0; c < bgs[r].length; c++) {
      const bg = bgs[r][c];
      if (!bg || !bg.startsWith('#') || bg.length !== 7) continue;
      const rr = parseInt(bg.slice(1, 3), 16);
      const gg = parseInt(bg.slice(3, 5), 16);
      const bb = parseInt(bg.slice(5, 7), 16);
      // Require approximate grayscale (R≈G≈B) so colored header sections
      // (green/blue/etc.) are skipped.
      if (Math.abs(rr - gg) > 12 || Math.abs(gg - bb) > 12 || Math.abs(rr - bb) > 12) continue;
      // Skip near-white backgrounds.
      if (rr > 245 && gg > 245 && bb > 245) continue;
      const brightness = (rr + gg + bb) / 3;
      if (brightness < darkestBrightness) {
        darkestBrightness = brightness;
        darkest = bg;
      }
    }
  }
  return darkest;
}

/**
 * Asks the Sheets export endpoint for a single tab as PDF.
 * Landscape, fit-to-width, gridlines on, repeat frozen rows on each page.
 *
 * Retries on transient 5xx with exponential backoff — the export endpoint
 * occasionally 500s right after the source sheet has been mutated.
 */
function exportSheetAsPdf(spreadsheetId, gid, fileName) {
  const params = [
    'format=pdf',
    'gid=' + gid,
    'size=letter',
    'portrait=false',
    'fitw=true',
    'sheetnames=false',
    'printtitle=false',
    'pagenumbers=false',
    'gridlines=true',
    'fzr=true',
    'top_margin=0.5',
    'bottom_margin=0.5',
    'left_margin=0.5',
    'right_margin=0.5'
  ].join('&');

  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?${params}`;
  const opts = {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true,
    followRedirects: true
  };

  const delaysMs = [0, 2000, 4000, 8000];
  let lastCode = null;
  let lastBody = '';
  for (let i = 0; i < delaysMs.length; i++) {
    if (delaysMs[i] > 0) Utilities.sleep(delaysMs[i]);
    const res = UrlFetchApp.fetch(url, opts);
    const code = res.getResponseCode();
    if (code === 200) {
      return res.getBlob().setName(fileName);
    }
    lastCode = code;
    lastBody = res.getContentText().slice(0, 300);
    if (code < 500 || code >= 600) break; // only retry 5xx
  }
  throw new Error(
    `PDF export failed (HTTP ${lastCode}) after retries. ` +
    `Response: ${lastBody}`
  );
}

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
// Output A..O:  Model #, Brand, Hickory SKU, Class, Family, Voltage, BTU,
//               Amps, IceAir Family, HCS, HAM, SRC, Total, Inbound, ETA
const REPORT_OUTPUT_COLS = [1, 4, 3, 5, 6, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17];

// Vendor (per-brand) reports use the same columns minus the IceAir
// Equivalent / IceAir Family column (source column J, col 10).
// Output A..N:  Model #, Brand, Hickory SKU, Class, Family, Voltage, BTU,
//               Amps, HCS, HAM, SRC, Total, Inbound, ETA
const BRAND_REPORT_OUTPUT_COLS = [1, 4, 3, 5, 6, 7, 8, 9, 12, 13, 14, 15, 16, 17];

// Source column that holds the Brand (column D), used by the per-brand report.
const REPORT_BRAND_COL = 4;

// Drive folder (under My Drive) that holds the per-brand report subfolders.
const BRAND_REPORTS_ROOT_FOLDER = 'Inventory Reports';

// Display / folder label used for rows whose Brand cell is blank.
const NO_BRAND_LABEL = '(No Brand)';

// Filter: include a data row only when this column equals this value.
const REPORT_FILTER_COL   = 18;     // R
const REPORT_FILTER_VALUE = 'Yes';  // matched case-insensitively, whitespace-trimmed

// Number of header rows at the top of the source tab to copy verbatim.
const REPORT_SOURCE_HEADER_ROWS = 2;

/**
 * Hardcoded recipient list used by sendDailyReportTest(). Sends only to the
 * named address — does NOT read the Email List tab.
 */
const TEST_DAILY_REPORT_RECIPIENTS = ['blake@bellmech.com'];

/**
 * Test entry point: builds the exact same daily report PDF and sends it
 * to TEST_DAILY_REPORT_RECIPIENTS instead of the Email List. Subject is
 * prefixed with "[TEST]" so it's obvious in the inbox.
 */
function sendDailyReportTest() {
  sendDailyReport({ recipients: TEST_DAILY_REPORT_RECIPIENTS, subjectPrefix: '[TEST] ' });
}

function sendDailyReport(opts) {
  const recipientOverride = opts && opts.recipients;
  const subjectPrefix     = (opts && opts.subjectPrefix) || '';
  const reportLabel       = subjectPrefix ? 'Daily Report (TEST)' : 'Daily Report';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Preparing daily report…', reportLabel, -1);

  const source = ss.getSheetByName(REPORT_SOURCE_TAB);
  if (!source) throw new Error(`Tab "${REPORT_SOURCE_TAB}" not found`);

  let recipients;
  if (recipientOverride && recipientOverride.length > 0) {
    recipients = recipientOverride.slice();
    Logger.log(`[Daily] Using override recipient list (${recipients.length}): ${recipients.join(', ')}`);
  } else {
    recipients = readReportRecipients(ss);
    if (recipients.length === 0) {
      throw new Error(`No email recipients found in "${REPORT_EMAIL_TAB}"!B2:B`);
    }
  }
  ss.toast(`Recipients: ${recipients.length} · building PDF…`, reportLabel, -1);

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const dateLong  = Utilities.formatDate(now, tz, 'MM/dd/yyyy'); // 05/20/2026
  const dateShort = Utilities.formatDate(now, tz, 'yyMMdd');     // 260520

  const reportTitle = `${dateLong} - City Equipment On Hand Daily Report`;
  const emailSubject = `${subjectPrefix}${reportTitle}`;
  const pdfFileName = `${dateShort} - City Equipment On Hand Daily Report.pdf`;
  const specsSheetUrl =
    'https://docs.google.com/spreadsheets/d/1Y-Sl6o8Pv1KtQIOP5eHKv1Nn9f_Do0RDVoZ7OdLw2tw/edit?gid=150758923#gid=150758923';
  const skuRequestFormUrl =
    'https://docs.google.com/forms/d/e/1FAIpQLSdJPKq08bgcMmUPOR-QWFE2iF-lb83wroYmBhia0RPBIF4KyQ/viewform';

  const emailBody =
    'Good Evening All,\n\n' +
    'Attached you will find the daily inventory report for city equipment. ' +
    'This is a new report that we will be publishing daily going forward to ' +
    'help drive visibility into on hand and inbound equipment across the city.\n\n' +
    'This file allows you to see the on hand inventory for your business as ' +
    'well as across the network (SRC = Stanley Ruth, HAM = Hamilton, and ' +
    'HCS = Hickory Centralized Services on Long Island). If you lack inventory ' +
    'that is available elsewhere in network, please reach out to Isaac ' +
    '(inadeau@hickory.ai) to coordinate transfers.\n\n' +
    'If you are looking for particular specs, feel free to access the dynamic ' +
    'table in the spreadsheet linked below. If you have any questions please ' +
    'reach out to me.\n' +
    specsSheetUrl + '\n\n' +
    'Additionally, if you do not see a model number that you would like to ' +
    'have added to the Hickory SKU catalog, please use this new form MSR ' +
    'created for us to flag to the team.\n' +
    skuRequestFormUrl;

  const emailHtmlBody =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222;">' +
      '<p>Good Evening All,</p>' +
      '<p>Attached you will find the daily inventory report for city equipment. ' +
      'This is a new report that we will be publishing daily going forward to ' +
      'help drive visibility into on hand and inbound equipment across the city.</p>' +
      '<p>This file allows you to see the on hand inventory for your business as ' +
      'well as across the network (SRC = Stanley Ruth, HAM = Hamilton, and ' +
      'HCS = Hickory Centralized Services on Long Island). If you lack inventory ' +
      'that is available elsewhere in network, please reach out to Isaac ' +
      '(<a href="mailto:inadeau@hickory.ai">inadeau@hickory.ai</a>) to coordinate transfers.</p>' +
      '<p>If you are looking for particular specs, feel free to access the dynamic ' +
      'table in the spreadsheet linked below. If you have any questions please reach out to me.<br>' +
      '<a href="' + specsSheetUrl + '">' + specsSheetUrl + '</a></p>' +
      '<p>Additionally, if you do not see a model number that you would like to ' +
      'have added to the Hickory SKU catalog, please use this new form MSR ' +
      'created for us to flag to the team.<br>' +
      '<a href="' + skuRequestFormUrl + '">' + skuRequestFormUrl + '</a></p>' +
    '</div>';

  const tempName = `__report_${Date.now()}`;
  // Use a template duplicate of the source tab so banding, conditional
  // formatting, merges, and column widths all carry over. copyTo would
  // drop banding and conditional formatting.
  const temp = ss.insertSheet(tempName, { template: source });
  let dataRowCount = 0;
  try {
    dataRowCount = layoutReportSheet(temp, source, reportTitle);
    SpreadsheetApp.flush();
    ss.toast(`Filtered ${dataRowCount} row(s) · exporting PDF…`, reportLabel, -1);
    // The export endpoint occasionally 500s when called immediately after
    // a structural change; give Sheets a beat before asking.
    Utilities.sleep(1500);

    const pdfBlob = exportSheetAsPdf(ss.getId(), temp.getSheetId(), pdfFileName);

    ss.toast(`Sending to ${recipients.length} recipient(s)…`, reportLabel, -1);
    MailApp.sendEmail({
      to: recipients.join(','),
      subject: emailSubject,
      body: emailBody,
      htmlBody: emailHtmlBody,
      attachments: [pdfBlob]
    });

    ss.toast(
      `Sent to ${recipients.length} recipient(s) · ${dataRowCount} row(s)`,
      `${reportLabel} — done`,
      7
    );
  } finally {
    ss.deleteSheet(temp);
  }
}

/**
 * Per-brand report generator.
 *
 * For every distinct Brand (source column D) among the rows that pass the
 * normal report filter (R = "Yes" and a non-blank Model #), builds an Excel
 * (.xlsx) workbook containing only that brand's rows — same columns, header
 * rows, title styling, and formatting as the company-wide report, with raw
 * values (no formulas) — and saves it to:
 *
 *   My Drive / Inventory Reports / <Brand> / YYMMDD - <Brand> - City Equipment On Hand Daily Report.xlsx
 *
 * Drive-only (no email). Re-running on the same day overwrites that day's
 * file in each brand folder.
 */
function generateBrandReports() {
  const startMs = Date.now();
  Logger.log('=== generateBrandReports() started ===');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ss.toast('Preparing brand reports…', 'Brand Reports', -1);

  const source = ss.getSheetByName(REPORT_SOURCE_TAB);
  if (!source) throw new Error(`Tab "${REPORT_SOURCE_TAB}" not found`);

  const brands = discoverReportBrands(source);
  Logger.log(`[Brand] ${brands.length} brand(s): ${brands.join(', ') || '(none)'}`);
  if (brands.length === 0) {
    ss.toast('No qualifying rows found — nothing to generate', 'Brand Reports', 7);
    return;
  }

  const rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), BRAND_REPORTS_ROOT_FOLDER);

  const tz = Session.getScriptTimeZone();
  const now = new Date();
  const dateLong  = Utilities.formatDate(now, tz, 'MM/dd/yyyy');
  const dateShort = Utilities.formatDate(now, tz, 'yyMMdd');

  let made = 0;
  brands.forEach((brand, i) => {
    ss.toast(`(${i + 1}/${brands.length}) Building ${brand}…`, 'Brand Reports', -1);

    const reportTitle  = `${dateLong} - ${brand} - City Equipment On Hand Daily Report`;
    const xlsxFileName = `${dateShort} - ${brand} - City Equipment On Hand Daily Report.xlsx`;

    const tempName = `__brand_${Date.now()}_${i}`;
    const temp = ss.insertSheet(tempName, { template: source });
    let exportSS = null;
    try {
      // brand === '(No Brand)' is our display label for blank brands; pass
      // the empty string to layoutReportSheet to match blank Brand cells.
      const brandFilter = (brand === NO_BRAND_LABEL) ? '' : brand;
      const rowCount = layoutReportSheet(temp, source, reportTitle, brandFilter, BRAND_REPORT_OUTPUT_COLS);
      SpreadsheetApp.flush();

      // The xlsx export endpoint always exports every tab in a workbook, so
      // copy the formatted temp sheet into a throwaway single-tab
      // spreadsheet and export that. copyTo carries values (already raw —
      // no formulas), formatting, merges, and column widths.
      exportSS = SpreadsheetApp.create(reportTitle);
      const copied = temp.copyTo(exportSS);
      copied.setName(sanitizeTabName(brand));
      const def = exportSS.getSheetByName('Sheet1');
      if (def) exportSS.deleteSheet(def);
      SpreadsheetApp.flush();
      Utilities.sleep(1500);

      const xlsxBlob = exportSpreadsheetAsXlsx(exportSS.getId(), xlsxFileName);

      const brandFolder = getOrCreateFolder(rootFolder, sanitizeFolderName(brand));
      trashExistingFiles(brandFolder, xlsxFileName); // overwrite same-day file
      brandFolder.createFile(xlsxBlob);
      made++;
      Logger.log(`[Brand] ${brand}: ${rowCount} row(s) → ${BRAND_REPORTS_ROOT_FOLDER}/${brand}/${xlsxFileName}`);
    } finally {
      ss.deleteSheet(temp);
      // Trash the intermediate Google Sheet; only the xlsx is kept.
      if (exportSS) DriveApp.getFileById(exportSS.getId()).setTrashed(true);
    }
  });

  Logger.log(`=== generateBrandReports() finished in ${((Date.now() - startMs) / 1000).toFixed(1)}s ===`);
  ss.toast(`Saved ${made} brand report(s) to "${BRAND_REPORTS_ROOT_FOLDER}"`, 'Brand Reports — done', 7);
}

/**
 * Returns the sorted, de-duplicated list of Brand values among rows that
 * pass the report filter (R = "Yes" and non-blank Model #). Blank brands
 * are collapsed under NO_BRAND_LABEL.
 */
function discoverReportBrands(source) {
  const lastRow = source.getLastRow();
  const lastCol = Math.max(source.getLastColumn(), REPORT_FILTER_COL);
  if (lastRow < REPORT_SOURCE_HEADER_ROWS + 1) return [];

  const displays = source.getRange(1, 1, lastRow, lastCol).getDisplayValues();
  const target = REPORT_FILTER_VALUE.toLowerCase();
  const modelCol = REPORT_OUTPUT_COLS[0];
  const seen = {};
  for (let r = REPORT_SOURCE_HEADER_ROWS + 1; r <= lastRow; r++) {
    const flag = String(displays[r - 1][REPORT_FILTER_COL - 1] || '').trim().toLowerCase();
    if (flag !== target) continue;
    const model = String(displays[r - 1][modelCol - 1] || '').trim();
    if (model === '') continue;
    const brand = String(displays[r - 1][REPORT_BRAND_COL - 1] || '').trim();
    const key = brand === '' ? NO_BRAND_LABEL : brand;
    seen[key] = true;
  }
  return Object.keys(seen).sort();
}

/** Finds a direct child folder by name under `parent`, creating it if absent. */
function getOrCreateFolder(parent, name) {
  const it = parent.getFoldersByName(name);
  if (it.hasNext()) return it.next();
  return parent.createFolder(name);
}

/** Moves any files named `fileName` in `folder` to the trash. */
function trashExistingFiles(folder, fileName) {
  const it = folder.getFilesByName(fileName);
  while (it.hasNext()) it.next().setTrashed(true);
}

/** Drive folder names can't contain a forward slash; replace with a dash. */
function sanitizeFolderName(name) {
  return String(name).replace(/[\/\\]/g, '-').trim() || NO_BRAND_LABEL;
}

/** Sheet tab names disallow : \ / ? * [ ] and are capped at 100 chars. */
function sanitizeTabName(name) {
  const cleaned = String(name).replace(/[:\\\/?*\[\]]/g, '-').trim();
  return (cleaned || 'Report').slice(0, 100);
}

/**
 * Exports an entire spreadsheet (used for the single-tab throwaway workbook)
 * as an .xlsx blob. Retries on transient 5xx with exponential backoff.
 */
function exportSpreadsheetAsXlsx(spreadsheetId, fileName) {
  const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx`;
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
    if (code === 200) return res.getBlob().setName(fileName);
    lastCode = code;
    lastBody = res.getContentText().slice(0, 300);
    if (code < 500 || code >= 600) break; // only retry 5xx
  }
  throw new Error(`XLSX export failed (HTTP ${lastCode}) after retries. Response: ${lastBody}`);
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
 * Builds the report on `temp`, which must already be a template duplicate of
 * `source` (created via `ss.insertSheet(name, {template: source})`). Using a
 * template duplicate — rather than copyTo PASTE_NORMAL — is what carries
 * banding and conditional formatting across; both are dropped by copyTo.
 *
 * The function then replaces formulas with source-evaluated raw values,
 * deletes rows that don't pass the filter, deletes columns not in
 * REPORT_OUTPUT_COLS, trims trailing empties, and inserts the merged title
 * row at row 1.
 *
 * `brandFilter` (optional): when a non-null string is passed, only rows whose
 * Brand column (REPORT_BRAND_COL) display value equals it are kept. Pass the
 * empty string to keep only rows with a blank Brand. Omit / null to keep all.
 *
 * `outputCols` (optional): 1-based source columns to include, in order.
 * Defaults to REPORT_OUTPUT_COLS; the per-brand report passes
 * BRAND_REPORT_OUTPUT_COLS (same set minus the IceAir Family column).
 *
 * Returns the number of data rows in the final report (excludes the title
 * and the two source header rows).
 */
function layoutReportSheet(temp, source, title, brandFilter, outputCols) {
  const cols = outputCols || REPORT_OUTPUT_COLS;
  const lastRow = source.getLastRow();
  const lastCol = Math.max(source.getLastColumn(), REPORT_FILTER_COL);
  if (lastRow < REPORT_SOURCE_HEADER_ROWS) return 0;

  // Read source values AND display values. Filtering uses the display
  // values (what the user actually sees in the cell), so cells whose
  // underlying value is 0 / "" / false but whose number format hides
  // them still count as blank. allValues is used to overwrite the
  // template-copied formulas with their source-evaluated raw values, so
  // they don't re-evaluate against the about-to-shift layout in temp.
  const srcRange    = source.getRange(1, 1, lastRow, lastCol);
  const allValues   = srcRange.getValues();
  const allDisplays = srcRange.getDisplayValues();

  const target      = REPORT_FILTER_VALUE.toLowerCase();
  const modelCol    = cols[0];
  const filterBrand = (brandFilter == null) ? null : String(brandFilter).trim();
  const keepSrcRows = [];
  for (let r = 1; r <= REPORT_SOURCE_HEADER_ROWS; r++) keepSrcRows.push(r);
  for (let r = REPORT_SOURCE_HEADER_ROWS + 1; r <= lastRow; r++) {
    const flag = String(allDisplays[r - 1][REPORT_FILTER_COL - 1] || '')
      .trim().toLowerCase();
    if (flag !== target) continue;
    const modelDisplay = String(allDisplays[r - 1][modelCol - 1] || '').trim();
    if (modelDisplay === '') continue;
    if (filterBrand != null) {
      const brand = String(allDisplays[r - 1][REPORT_BRAND_COL - 1] || '').trim();
      if (brand !== filterBrand) continue;
    }
    keepSrcRows.push(r);
  }
  const numKeepRows  = keepSrcRows.length;
  const dataRowCount = numKeepRows - REPORT_SOURCE_HEADER_ROWS;
  const numCols      = cols.length;

  // Replace formulas in the template-duplicated temp with the source's
  // evaluated values so they don't re-evaluate against the row/column
  // shifts we're about to apply. Banding and conditional formatting
  // already in temp from the template are unaffected by setValues.
  temp.getRange(1, 1, lastRow, lastCol).setValues(allValues);
  SpreadsheetApp.flush();

  // Delete source rows we're not keeping. With template, source row r
  // maps 1:1 to temp row r (no offset). Walk bottom-up, batching
  // consecutive runs into a single deleteRows call.
  const keepSet = new Set(keepSrcRows);
  let runEnd = -1;
  for (let r = lastRow; r >= 1; r--) {
    if (!keepSet.has(r)) {
      if (runEnd === -1) runEnd = r;
    } else if (runEnd !== -1) {
      const runStart = r + 1;
      temp.deleteRows(runStart, runEnd - runStart + 1);
      runEnd = -1;
    }
  }
  if (runEnd !== -1) {
    temp.deleteRows(1, runEnd);
  }

  // Delete columns we don't want. Walk right-to-left, batching runs.
  const keepColSet = new Set(cols);
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

  // Trim trailing empty rows. At this point temp has numKeepRows rows
  // (no title row yet) — we'll insert the title row next.
  const maxRows = temp.getMaxRows();
  if (maxRows > numKeepRows) temp.deleteRows(numKeepRows + 1, maxRows - numKeepRows);

  // Insert a new row 1 for the title. Doing this AFTER formula replacement
  // means there are no formulas left to break against the row shift.
  temp.insertRowBefore(1);

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

/**
 * Daily PDF report emailer.
 *
 * Builds a one-page PDF from the "City Equipment On Hand" tab containing:
 *   - A header line: "On Hand Equipment - Daily Report MM/DD/YYYY"
 *   - The two header rows of the source tab
 *   - Only data rows where column R = "Yes"
 *   - Only columns A, D, E, F, G, H, I, J, L, M, N, O, P, Q
 *
 * Emails the PDF to every recipient in "Email List"!B2:B.
 *
 * How the PDF is produced: we build a hidden temp sheet inside this same
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

  const dateStr = Utilities.formatDate(
    new Date(), Session.getScriptTimeZone(), 'MM/dd/yyyy'
  );
  const reportTitle = `On Hand Equipment - Daily Report ${dateStr}`;

  const { headerRows, dataRows } = readReportRows(source);

  const tempName = `__report_${Date.now()}`;
  const temp = ss.insertSheet(tempName);
  try {
    layoutReportSheet(temp, reportTitle, headerRows, dataRows);
    temp.hideSheet();
    SpreadsheetApp.flush();

    const pdfBlob = exportSheetAsPdf(ss.getId(), temp.getSheetId(), `${reportTitle}.pdf`);

    MailApp.sendEmail({
      to: recipients.join(','),
      subject: reportTitle,
      body:
        `Attached: ${reportTitle}.\n\n` +
        `${dataRows.length} item(s) included.`,
      attachments: [pdfBlob]
    });

    ss.toast(
      `Sent to ${recipients.length} recipient(s) · ${dataRows.length} row(s)`,
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
 * Reads the source tab once. Returns:
 *   headerRows: REPORT_SOURCE_HEADER_ROWS arrays, each of length
 *               REPORT_OUTPUT_COLS.length (the header rows projected onto
 *               the selected columns).
 *   dataRows:   one array per source row from row REPORT_SOURCE_HEADER_ROWS+1
 *               downward whose column R equals REPORT_FILTER_VALUE.
 */
function readReportRows(source) {
  const lastRow = source.getLastRow();
  const lastCol = Math.max(source.getLastColumn(), REPORT_FILTER_COL);
  if (lastRow < REPORT_SOURCE_HEADER_ROWS) {
    return { headerRows: [], dataRows: [] };
  }

  const all = source.getRange(1, 1, lastRow, lastCol).getValues();

  const headerRows = [];
  for (let i = 0; i < REPORT_SOURCE_HEADER_ROWS; i++) {
    headerRows.push(REPORT_OUTPUT_COLS.map(c => all[i][c - 1]));
  }

  const target = REPORT_FILTER_VALUE.toLowerCase();
  const dataRows = [];
  for (let i = REPORT_SOURCE_HEADER_ROWS; i < lastRow; i++) {
    const flag = String(all[i][REPORT_FILTER_COL - 1] || '').trim().toLowerCase();
    if (flag === target) {
      dataRows.push(REPORT_OUTPUT_COLS.map(c => all[i][c - 1]));
    }
  }

  return { headerRows, dataRows };
}

function layoutReportSheet(sheet, title, headerRows, dataRows) {
  const numCols = REPORT_OUTPUT_COLS.length;

  // Row 1: report title, merged across all columns.
  sheet.getRange(1, 1, 1, numCols).merge();
  sheet.getRange(1, 1)
    .setValue(title)
    .setFontWeight('bold')
    .setFontSize(14)
    .setHorizontalAlignment('center');

  // Rows 2..1+headerRows.length: the source's own header rows.
  if (headerRows.length > 0) {
    sheet.getRange(2, 1, headerRows.length, numCols)
      .setValues(headerRows)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  }

  // Data rows below the headers.
  if (dataRows.length > 0) {
    sheet.getRange(2 + headerRows.length, 1, dataRows.length, numCols)
      .setValues(dataRows);
  }

  // Freeze title + source header rows so they reprint on every PDF page.
  sheet.setFrozenRows(1 + headerRows.length);

  // Best-effort fit-to-content.
  sheet.autoResizeColumns(1, numCols);
}

/**
 * Asks the Sheets export endpoint for a single tab as PDF.
 * Landscape, fit-to-width, gridlines on, repeat frozen rows on each page.
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
  const res = UrlFetchApp.fetch(url, {
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }
  });
  return res.getBlob().setName(fileName);
}

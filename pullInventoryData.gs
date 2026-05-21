/**
 * Pulls inventory data from HAM, SRC, and HCS source spreadsheets and
 * writes two enriched tabs into THIS spreadsheet:
 *
 *   - "Equipment Data"  ← from each source's "Stock Equipment Inventory" tab
 *   - "Material Data"   ← from each source's "Stock Inventory" tab
 *
 * Both tabs enrich rows with Hickory SKU + Brand Agnostic SKU + 47
 * classification fields from the Hickory SKU Master Key ("Equipment SKUs").
 *
 * COLUMN RESOLUTION:
 *   All source columns are looked up by HEADER NAME in row 1, not by fixed
 *   column letter. Renaming or reordering source columns is fine as long as
 *   the header text stays the same.
 *
 * EQUIPMENT DATA (one row per Location + Model Number):
 *   Source tab:      "Stock Equipment Inventory"
 *   Source headers:  "Model Number", "Active Price"
 *   Count:           number of source rows that share a Model Number
 *   SKU enrichment:  matched on Model Number against SKU master
 *   Master-only rows: every SKU-master model that isn't in any inventory
 *                     gets a row with blank Location, Count = 0, blank Price.
 *
 * MATERIAL DATA (one row per Location + Part Name):
 *   Source tab:      "Stock Inventory"
 *   Source headers:  "Part Name", "Model Number", "Quantity", "Active Price"
 *   Quantity:        summed across source rows that share a Part Name
 *   SKU enrichment:  attempted via Model Number; if no match, SKU columns
 *                    are filled with "-".
 *   No master-only rows.
 *
 * INCREMENTAL UPDATE BEHAVIOR (both tabs):
 *   - Existing rows are updated in place (preserves row position and any
 *     user annotations past the schema columns).
 *   - New keys are appended at the bottom.
 *   - Rows are deleted only if their key no longer appears in the snapshot.
 */

const SOURCES = [
  { name: 'HAM', id: '1w9n3_QaupGh_C9oHwLyJkEghpsQDTuGBAsuId5-jHHQ' },
  { name: 'SRC', id: '1XwkUbnArSucw_NXmNnLGLg5hWUtWjxmkxTcmwUXUlOI' },
  { name: 'HCS', id: '1qJ70na-Y0UZ1CmoGydeSGpRDHBEXHyuTtgCm0br6yKs' }
];

const EQUIPMENT_SOURCE_TAB = 'Stock Equipment Inventory';
const MATERIAL_SOURCE_TAB  = 'Stock Inventory';

const EQUIPMENT_OUTPUT_TAB = 'Equipment Data';
const MATERIAL_OUTPUT_TAB  = 'Material Data';

const SKU_MASTER = {
  id:        '1OIjgSOJ8V5BJ8rjeKmHT2e5SYGnGEeZLfy4cZiJcrKM',
  tab:       'Equipment SKUs',
  headerRow: 2   // row 1 is a title/banner row; column headers live in row 2
};

// Header names used in the SKU master row 1.
const SKU_MASTER_HEADERS = {
  hickorySku:       'Generated Hickory SKU',
  brandAgnosticSku: 'Brand Agnostic SKU',
  model:            'Model Number'
};

// Header name for the price column on each source's "Stock Equipment Inventory"
// tab. The literal header has irregular internal spacing ("PPI    (before tax)");
// readHeaderRow normalizes whitespace so a single-spaced form matches.
const EQUIPMENT_PRICE_HEADER = 'PPI (before tax)';

// 47 classification field names — these are also the row-1 headers in the
// SKU master and the output column headers in both Equipment/Material Data.
const SKU_FIELDS = [
  'Brand',           'Brand Code',
  'Class',           'Class Code',
  'Family',          'Family Code',
  'Tier',            'Tier Code',
  'Voltage',         'Voltage Code',
  'Amperage',        'Amperage Code',
  'Wattage',         'Wattage Code',
  'BTU',             'BTU Code',
  'Capacity',        'Capacity Code',
  'AFUE',            'AFUE Code',
  'SEER Category',
  'SEER Range',      'SEER Code',
  'SEER2 Range',     'SEER2 Code',
  'Refrigerant',     'Refrigerant Code',
  'Cabinet Size',    'Cabinet Code',
  'Blower Motor',    'Blower Code',
  'Configuration',   'Configuration Code',
  'Furnace Tonnage', 'Furnace Tonnage Code',
  'Heat Source',     'Heat Source Code',
  'Hydronic Option', 'Hydronic Option Code',
  'Controls',        'Controls Code',
  'Return/Discharge','Return/Discharge Code',
  'Wall Depth',      'Wall Depth Code',
  'Year',            'Year Code'
];

const EQUIPMENT_HEADERS = [
  'Inventory Location', 'Model Number', 'Count', 'Price',
  'Generated Hickory SKU', 'Brand Agnostic SKU'
].concat(SKU_FIELDS);

const MATERIAL_HEADERS = [
  'Inventory Location', 'Part Name', 'Model Number', 'Quantity', 'Active Price',
  'Generated Hickory SKU', 'Brand Agnostic SKU'
].concat(SKU_FIELDS);

// ---------------------------------------------------------------------------
// Header-name → column-index helpers
// ---------------------------------------------------------------------------

/**
 * Reads row 1 of `sheet` and returns { 'Header Name': 0-based-col-index, ... }
 * Header text is trimmed and internal runs of whitespace are collapsed to a
 * single space so "PPI    (before tax)" matches "PPI (before tax)". Lookups
 * via requireCol normalize the requested name the same way.
 */
function normalizeHeader(s) {
  // Strip zero-width characters (ZWSP/ZWNJ/ZWJ/BOM), then collapse any run
  // of whitespace (incl. NBSP via \s in ES2018+) to a single ASCII space.
  return String(s)
    .replace(/[​‌‍﻿]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readHeaderRow(sheet, rowNumber) {
  const row = rowNumber || 1;
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return {};
  const headerRow = sheet.getRange(row, 1, 1, lastCol).getValues()[0];
  const map = {};
  headerRow.forEach((h, i) => {
    if (h == null) return;
    const name = normalizeHeader(h);
    if (name === '' || map.hasOwnProperty(name)) return;
    map[name] = i;
  });
  return map;
}

/**
 * Look up the 0-based column index for a header name. Throws if the header
 * isn't present — callers catch per-source so one bad source doesn't take
 * down the whole run.
 */
function requireCol(headerMap, name, context) {
  const key = normalizeHeader(name);
  if (!headerMap.hasOwnProperty(key)) {
    const found = Object.keys(headerMap).map(h => `"${h}"`).join(', ') || '(none)';
    throw new Error(
      `Missing required header "${name}" in ${context}. Found headers: ${found}`
    );
  }
  return headerMap[key];
}

// ---------------------------------------------------------------------------
// SKU master lookup
// ---------------------------------------------------------------------------

/**
 * Build a map of MODEL (upper-cased, trimmed) →
 *   { model: <originalModelString>, data: [hickorySku, brandAgnosticSku, ...47 fields] }
 *
 * Columns are resolved by header name in row 1 of the SKU master.
 */
function buildSkuLookup() {
  const ss = SpreadsheetApp.openById(SKU_MASTER.id);
  const sheet = ss.getSheetByName(SKU_MASTER.tab);
  if (!sheet) {
    throw new Error(`Tab "${SKU_MASTER.tab}" not found in SKU master`);
  }

  const headerRow = SKU_MASTER.headerRow || 1;
  const firstDataRow = headerRow + 1;
  const lastRow = sheet.getLastRow();
  const lastCol = sheet.getLastColumn();
  if (lastRow < firstDataRow || lastCol < 1) return {};

  const headerMap = readHeaderRow(sheet, headerRow);
  const ctx = `SKU master "${SKU_MASTER.tab}"`;

  const hickoryIdx = requireCol(headerMap, SKU_MASTER_HEADERS.hickorySku,       ctx);
  const baIdx      = requireCol(headerMap, SKU_MASTER_HEADERS.brandAgnosticSku, ctx);
  const modelIdx   = requireCol(headerMap, SKU_MASTER_HEADERS.model,            ctx);
  const fieldIdxs  = SKU_FIELDS.map(name => requireCol(headerMap, name, ctx));

  const values = sheet.getRange(firstDataRow, 1, lastRow - firstDataRow + 1, lastCol).getValues();

  const map = {};
  values.forEach(row => {
    const model = row[modelIdx];
    if (model === '' || model == null) return;
    const original = String(model).trim();
    if (original === '') return;
    const key = original.toUpperCase();
    if (map[key]) return; // first match wins

    const fields = fieldIdxs.map(i => row[i]);
    map[key] = {
      model: original,
      data: [row[hickoryIdx], row[baIdx]].concat(fields)
    };
  });

  return map;
}

// ---------------------------------------------------------------------------
// Snapshot builders
// ---------------------------------------------------------------------------

/**
 * Equipment snapshot: one entry per Location + Model Number.
 *
 * Returns: { "Location::Model": [EQUIPMENT_HEADERS-length row values], ... }
 *   - Inventory rows use the source name as Location.
 *   - Master-only rows use "" as Location.
 */
function buildEquipmentSnapshot(skuMap, unmatched) {
  const blankSku = new Array(2 + SKU_FIELDS.length).fill('');
  const currentRows = {};
  const modelsSeenInInventory = new Set();

  SOURCES.forEach(source => {
    try {
      const sourceSS = SpreadsheetApp.openById(source.id);
      const sheet = sourceSS.getSheetByName(EQUIPMENT_SOURCE_TAB);
      if (!sheet) {
        Logger.log(`"${EQUIPMENT_SOURCE_TAB}" tab not found in ${source.name}`);
        return;
      }

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return;

      const headerMap = readHeaderRow(sheet);
      const ctx = `${source.name} / ${EQUIPMENT_SOURCE_TAB}`;
      const modelIdx = requireCol(headerMap, 'Model Number',           ctx);
      const priceIdx = requireCol(headerMap, EQUIPMENT_PRICE_HEADER,   ctx);

      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      const modelMap = {};
      values.forEach(row => {
        const model = row[modelIdx];
        const price = row[priceIdx];
        if (model === '' || model == null) return;
        const key = String(model).trim();
        if (key === '') return;

        if (!modelMap[key]) modelMap[key] = { count: 0, price: price };
        modelMap[key].count++;
        if ((modelMap[key].price === '' || modelMap[key].price == null) &&
             price !== '' && price != null) {
          modelMap[key].price = price;
        }
      });

      Object.keys(modelMap).forEach(model => {
        const lookupKey = model.toUpperCase();
        modelsSeenInInventory.add(lookupKey);

        const skuEntry = skuMap[lookupKey];
        if (!skuEntry) unmatched.push(`${source.name}: ${model}`);
        const skuData = skuEntry ? skuEntry.data : blankSku;

        const compoundKey = `${source.name}::${model}`;
        currentRows[compoundKey] = [
          source.name, model, modelMap[model].count, modelMap[model].price
        ].concat(skuData);
      });
    } catch (e) {
      Logger.log(`Error processing ${source.name} equipment: ${e.message}`);
    }
  });

  // Master-only rows: every SKU-master model not seen in any inventory.
  Object.keys(skuMap).forEach(upperKey => {
    if (!modelsSeenInInventory.has(upperKey)) {
      const entry = skuMap[upperKey];
      const compoundKey = `::${entry.model}`;
      currentRows[compoundKey] = [
        '', entry.model, 0, ''
      ].concat(entry.data);
    }
  });

  return currentRows;
}

/**
 * Material snapshot: one entry per Location + Part Name.
 *
 * Returns: { "Location::PartName": [MATERIAL_HEADERS-length row values], ... }
 *   - Quantity is summed across source rows that share a Part Name.
 *   - Active Price is the first non-blank price seen for that Part Name.
 *   - Model Number is the first non-blank model seen for that Part Name.
 *   - SKU enrichment tries Model Number against the SKU master; if no
 *     match (or the row has no Model Number), SKU columns are "-".
 *   - No master-only rows.
 */
function buildMaterialSnapshot(skuMap, unmatched) {
  const dashSku = new Array(2 + SKU_FIELDS.length).fill('-');
  const currentRows = {};

  SOURCES.forEach(source => {
    try {
      const sourceSS = SpreadsheetApp.openById(source.id);
      const sheet = sourceSS.getSheetByName(MATERIAL_SOURCE_TAB);
      if (!sheet) {
        Logger.log(`"${MATERIAL_SOURCE_TAB}" tab not found in ${source.name}`);
        return;
      }

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      if (lastRow < 2 || lastCol < 1) return;

      const headerMap = readHeaderRow(sheet);
      const ctx = `${source.name} / ${MATERIAL_SOURCE_TAB}`;
      const partIdx  = requireCol(headerMap, 'Part Name',    ctx);
      const modelIdx = requireCol(headerMap, 'Model Number', ctx);
      const qtyIdx   = requireCol(headerMap, 'Quantity',     ctx);
      const priceIdx = requireCol(headerMap, 'Active Price', ctx);

      const values = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      const partMap = {};
      values.forEach(row => {
        const part = row[partIdx];
        if (part === '' || part == null) return;
        const partKey = String(part).trim();
        if (partKey === '') return;

        const modelRaw = row[modelIdx];
        const model = (modelRaw == null) ? '' : String(modelRaw).trim();
        const price = row[priceIdx];
        const qtyRaw = row[qtyIdx];
        const qty = (typeof qtyRaw === 'number') ? qtyRaw
                  : (qtyRaw === '' || qtyRaw == null) ? 0
                  : Number(qtyRaw) || 0;

        if (!partMap[partKey]) {
          partMap[partKey] = { quantity: 0, price: '', model: '' };
        }
        partMap[partKey].quantity += qty;
        if ((partMap[partKey].price === '' || partMap[partKey].price == null) &&
             price !== '' && price != null) {
          partMap[partKey].price = price;
        }
        if (partMap[partKey].model === '' && model !== '') {
          partMap[partKey].model = model;
        }
      });

      Object.keys(partMap).forEach(part => {
        const entry = partMap[part];
        const lookupKey = entry.model.toUpperCase();
        const skuEntry = (lookupKey !== '') ? skuMap[lookupKey] : null;
        if (!skuEntry && entry.model !== '') {
          unmatched.push(`${source.name} (material): ${part} / ${entry.model}`);
        }
        const skuData = skuEntry ? skuEntry.data : dashSku;

        const compoundKey = `${source.name}::${part}`;
        currentRows[compoundKey] = [
          source.name, part, entry.model, entry.quantity, entry.price
        ].concat(skuData);
      });
    } catch (e) {
      Logger.log(`Error processing ${source.name} materials: ${e.message}`);
    }
  });

  return currentRows;
}

// ---------------------------------------------------------------------------
// Generic diff + write for an output tab
// ---------------------------------------------------------------------------

/**
 * Apply incremental updates to `sheetName` against `currentRows`.
 *
 * keyColCount = how many leading columns make up the row key
 *   (2 for Equipment: Location + Model; 2 for Material: Location + Part Name).
 *
 * priceColIndex = 1-based column number that should be formatted as currency
 *   (4 for Equipment, 5 for Material), or 0 to skip.
 */
function applyIncrementalUpdate(sheetName, headers, currentRows, keyColCount, priceColIndex) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  const isNewSheet = !sheet;
  if (!sheet) sheet = ss.insertSheet(sheetName);

  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold');

  // Read existing keys: "col1::col2" -> sheet row number.
  const existingKeys = {};
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    const existing = sheet.getRange(2, 1, lastRow - 1, keyColCount).getValues();
    existing.forEach((row, idx) => {
      const parts = row.map(v => String(v == null ? '' : v).trim());
      // Require the last key part (model/part name) to be non-empty.
      if (parts[parts.length - 1] === '') return;
      existingKeys[parts.join('::')] = idx + 2;
    });
  }

  const toUpdate = [];
  const toDelete = [];
  const toAppend = [];

  Object.keys(existingKeys).forEach(key => {
    const rowNum = existingKeys[key];
    if (currentRows[key]) toUpdate.push({ rowNum, values: currentRows[key] });
    else toDelete.push(rowNum);
  });
  Object.keys(currentRows).forEach(key => {
    if (!existingKeys[key]) toAppend.push(currentRows[key]);
  });

  toUpdate.forEach(({ rowNum, values }) => {
    sheet.getRange(rowNum, 1, 1, values.length).setValues([values]);
  });
  toDelete.sort((a, b) => b - a).forEach(rowNum => sheet.deleteRow(rowNum));
  if (toAppend.length > 0) {
    const startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, toAppend.length, headers.length).setValues(toAppend);
  }

  const finalLastRow = sheet.getLastRow();
  if (finalLastRow > 1 && priceColIndex > 0) {
    sheet.getRange(2, priceColIndex, finalLastRow - 1, 1).setNumberFormat('$#,##0.00');
  }
  if (isNewSheet) {
    sheet.setFrozenRows(1);
    sheet.setFrozenColumns(keyColCount);
  }

  return { updated: toUpdate.length, added: toAppend.length, removed: toDelete.length };
}

// ---------------------------------------------------------------------------
// Public entry points
// ---------------------------------------------------------------------------

function pullEquipmentData() {
  const ss = SpreadsheetApp.getActive();
  ss.toast('Loading SKU master…', 'Equipment Data', -1);

  let skuMap = {};
  try {
    skuMap = buildSkuLookup();
    Logger.log(`Loaded ${Object.keys(skuMap).length} SKU entries`);
  } catch (e) {
    Logger.log(`SKU lookup failed: ${e.message}`);
    ss.toast(`SKU lookup failed: ${e.message}`, 'Warning', 10);
  }

  const unmatched = [];
  ss.toast('Reading inventory from HAM, SRC, HCS…', 'Equipment Data', -1);
  const currentRows = buildEquipmentSnapshot(skuMap, unmatched);

  ss.toast('Writing Equipment Data…', 'Equipment Data', -1);
  const stats = applyIncrementalUpdate(EQUIPMENT_OUTPUT_TAB, EQUIPMENT_HEADERS, currentRows, 2, 4);

  Logger.log(
    `Equipment — Updated ${stats.updated}, added ${stats.added}, ` +
    `removed ${stats.removed}, unmatched ${unmatched.length}`
  );
  if (unmatched.length > 0) {
    Logger.log(`Equipment models with no SKU master match:\n${unmatched.join('\n')}`);
  }

  ss.toast(
    `Updated ${stats.updated} · Added ${stats.added} · Removed ${stats.removed}` +
    (unmatched.length ? ` · ${unmatched.length} model(s) not in SKU master` : ''),
    'Equipment Data — done',
    7
  );
}

function pullMaterialData() {
  const ss = SpreadsheetApp.getActive();
  ss.toast('Loading SKU master…', 'Material Data', -1);

  let skuMap = {};
  try {
    skuMap = buildSkuLookup();
  } catch (e) {
    Logger.log(`SKU lookup failed: ${e.message}`);
    ss.toast(`SKU lookup failed: ${e.message}`, 'Warning', 10);
  }

  const unmatched = [];
  ss.toast('Reading materials from HAM, SRC, HCS…', 'Material Data', -1);
  const currentRows = buildMaterialSnapshot(skuMap, unmatched);

  ss.toast('Writing Material Data…', 'Material Data', -1);
  const stats = applyIncrementalUpdate(MATERIAL_OUTPUT_TAB, MATERIAL_HEADERS, currentRows, 2, 5);

  Logger.log(
    `Material — Updated ${stats.updated}, added ${stats.added}, ` +
    `removed ${stats.removed}, unmatched ${unmatched.length}`
  );
  if (unmatched.length > 0) {
    Logger.log(`Material parts with no SKU master match:\n${unmatched.join('\n')}`);
  }

  ss.toast(
    `Updated ${stats.updated} · Added ${stats.added} · Removed ${stats.removed}` +
    (unmatched.length ? ` · ${unmatched.length} part(s) with no SKU match` : ''),
    'Material Data — done',
    7
  );
}

function pullAllData() {
  const ss = SpreadsheetApp.getActive();
  ss.toast('Refreshing Equipment and Material tabs…', 'Refresh All', -1);
  pullEquipmentData();
  pullMaterialData();
  ss.toast('All tabs refreshed', 'Refresh All — done', 5);
}

// Back-compat alias: previous menu item / triggers may still reference this.
function pullInventoryData() {
  pullAllData();
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventory')
    .addItem('Refresh Equipment Data', 'pullEquipmentData')
    .addItem('Refresh Material Data',  'pullMaterialData')
    .addSeparator()
    .addItem('Refresh All',             'pullAllData')
    .addSeparator()
    .addItem('Send Daily Report',       'sendDailyReport')
    .addToUi();
}

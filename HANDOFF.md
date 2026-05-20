# Inventory Aggregation Script — Handoff to Claude Code

## Project summary

Google Apps Script that lives inside a Google Sheet and refreshes a `Data` tab by pulling stock counts from three property inventory trackers and enriching each model with classification info from a master SKU table.

Primary file: `pullInventoryData.gs`

## Source spreadsheets

All three property inventories use a tab named `Stock Equipment Inventory`. Inside that tab:
- Column D = Model
- Column G = Price
- Row 1 is assumed to be a header; data starts on row 2

| Location label | Spreadsheet ID |
|---|---|
| `HAM` | `1w9n3_QaupGh_C9oHwLyJkEghpsQDTuGBAsuId5-jHHQ` |
| `SRC` | `1XwkUbnArSucw_NXmNnLGLg5hWUtWjxmkxTcmwUXUlOI` |
| `HCS` | `1qJ70na-Y0UZ1CmoGydeSGpRDHBEXHyuTtgCm0br6yKs` |

Note: `HAM` was originally named `Hamilton` and got renamed late in the conversation. Only the display label changed — the spreadsheet ID is the same.

## SKU master

**Hickory SKU Master Key**, ID `1OIjgSOJ8V5BJ8rjeKmHT2e5SYGnGEeZLfy4cZiJcrKM`, tab `Equipment SKUs`.

Column layout in that tab:
- C = Hickory SKU
- D = Brand Agnostic SKU
- E = Model (lookup key — matched case-insensitively, whitespace-trimmed, against inventory models)
- F through AZ = 47 classification fields (Brand, Brand Code, Class, Class Code, Family, Family Code, Tier, Tier Code, Voltage, Voltage Code, Amperage, Amperage Code, Wattage, Wattage Code, BTU, BTU Code, Capacity, Capacity Code, AFUE, AFUE Code, SEER Category, SEER Range, SEER Code, SEER2 Range, SEER2 Code, Refrigerant, Refrigerant Code, Cabinet Size, Cabinet Code, Blower Motor, Blower Code, Configuration, Configuration Code, Furnace Tonnage, Furnace Tonnage Code, Heat Source, Heat Source Code, Hydronic Option, Hydronic Option Code, Controls, Controls Code, Return/Discharge, Return/Discharge Code, Wall Depth, Wall Depth Code, Year, Year Code)

## Output: `Data` tab

53 columns total. Schema:

| Col | Letter | Field |
|---|---|---|
| 1 | A | Inventory Location |
| 2 | B | Model |
| 3 | C | Count |
| 4 | D | Price |
| 5 | E | Hickory SKU |
| 6 | F | Brand Agnostic SKU |
| 7–53 | G–BA | The 47 classification fields in the order above |

Row uniqueness key: `Inventory Location + Model`. A given model can appear up to four times — once per location it's stocked at (`HAM`, `SRC`, `HCS`), plus once as a master-only row if it's nowhere in inventory.

### Two kinds of rows
1. **Inventory rows** — one per `Location + Model` pair found in the source sheets. Real count, real price, SKU columns filled if the model matches the master.
2. **Master-only rows** — for every model in the SKU master that isn't in any inventory: `Inventory Location` blank, `Count = 0`, `Price` blank, SKU columns filled from the master.

## Update behavior (important)

The `Data` tab is **not** wiped on each run. The script performs an incremental diff:
- **Update** — if a `Location + Model` row still exists in the current snapshot, the row is overwritten in place (preserves row position so any user annotations in columns past BA stay put).
- **Append** — if a `Location + Model` row is new, it's added at the bottom.
- **Delete** — a row is removed only if its `Location + Model` is no longer produced by any inventory source AND no longer present in the master (for master-only rows).

Headers and frozen rows/columns are managed by the script:
- Headers are rewritten on every run.
- Row 1 frozen, columns 1–2 (Location, Model) frozen — but only set on the first run when the sheet is created, so user-changed freezing is preserved afterward.

## Script structure

Functions in `pullInventoryData.gs`:
- `buildSkuLookup()` → returns `{ UPPERCASE_MODEL: { model: 'OriginalCasedModel', data: [hickorySku, brandAgnosticSku, ...47 fields] } }`
- `buildCurrentData(skuMap, unmatched)` → returns `{ "Location::Model": [53 column values], ... }`, also pushes inventory-models-not-in-master into the `unmatched` array
- `pullInventoryData()` → main entry point; reads existing `Data` tab, diffs against current snapshot, applies updates/appends/deletes
- `onOpen()` → installs an `Inventory → Refresh Data tab` custom menu

End-of-run toast format:
`Updated X · Added Y · Removed Z · N inventory model(s) not in SKU master`

Detailed log of unmatched models is written to the Apps Script execution log.

## Companion formula (lives in another tab of the same workbook)

The user has a separate tab with locations as column headers (row 3) and models as row labels (column B). The lookup formula pulling counts from the `Data` tab:

```
=IFERROR(XLOOKUP(M$3&"|"&$B4, Data!$A:$A&"|"&Data!$B:$B, Data!$C:$C), 0)
```

Two equivalent alternatives also work:
```
=IFERROR(FILTER(Data!$C:$C, Data!$A:$A=M$3, Data!$B:$B=$B4), 0)
=IFERROR(INDEX(Data!$C:$C, MATCH(1, (Data!$A:$A=M$3)*(Data!$B:$B=$B4), 0)), 0)
```

`M$3` is the location header (e.g. `HAM`, `SRC`, `HCS`), `$B4` is the model. Anchors are set up to drag across and down.

## Known caveats / things to be aware of

1. **Source tab name match is exact.** If any of the three property inventories renames `Stock Equipment Inventory` even by adding a trailing space, that source silently logs an error and produces no rows (its existing rows in `Data` would then get deleted on the next run).
2. **Model matching is case-insensitive and trim-only.** No fuzzy matching. `XR16` vs `XR16A` are different. Renames in the source look like one delete + one add to the diff.
3. **Duplicate models in master:** first match wins.
4. **The HAM rename** — on the first run after the rename, any pre-existing `Hamilton::*` rows will be deleted and `HAM::*` rows added. Big spike in Removed/Added counts on that one run; settles afterward. Any companion-tab formulas referencing the literal string `"Hamilton"` need to be updated to `"HAM"`.
5. **Performance:** updates happen one row at a time with individual `setValues` calls. Fine for hundreds of rows, may want to batch if data grows into thousands.

## Suggested first action for Claude Code

Open `pullInventoryData.gs` and read through it end-to-end. Constants at the top (`SOURCES`, `SOURCE_TAB`, `OUTPUT_TAB`, `SKU_MASTER`, `SKU_FIELDS`, `HEADERS`) are where almost any future config change will land.

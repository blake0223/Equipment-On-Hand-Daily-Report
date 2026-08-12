# Dimensions & Cut Sheets — Verification Audit

Audit of the **Dimensions and Cut Sheets** tab of *City Equipment On Hand Daily Report*
(`1Y-Sl6o8Pv1KtQIOP5eHKv1Nn9f_Do0RDVoZ7OdLw2tw`, gid `1972171825`).

**262 populated rows** (no header row — row 1 is data), 4 columns: Brand | Model # | Dimensions | Cut Sheet URL.
**60 unique cut sheet URLs.** Every URL was fetched and every recorded dimension was checked against
the document actually cited. Row numbers below are positions in the tab.

Per-row results: [`dimensions-audit.csv`](dimensions-audit.csv)

---

## Summary

| Verdict | Rows | Meaning |
|---|---:|---|
| **OK** | 78 | Dimension confirmed against the manufacturer's own document |
| **UNSOURCED** | 126 | Cited document contains **no dimensional data** for that item — value may be right, but nothing in the citation supports it |
| **WRONG** | 33 | Recorded value is contradicted by the manufacturer's document |
| **MISLABELED** | 15 | Value is a real published dimension, but for the *wrong part* (sleeve recorded where a chassis/heat section is stocked) |
| **DEAD LINK** | 10 | Cited URL 404s, is bot-blocked, or points at a different product |

**Citation health:** only **109 of 262** rows cite a document that actually contains the dimension recorded.
- **18 rows** cite a URL that returns **404**
- **110 rows** cite a live document that contains **no dimensional data** for the item
- **8 rows** cite a generic landing page, a soft redirect, or the wrong product's page

### The two tags you asked about

**`(sleeve)` — 88 rows.** The tag is honest about what was measured, but it is not consistently the
right dimension, and for 27 rows the number isn't a real sleeve dimension either:

| | Rows |
|---|---:|
| Correct sleeve dimension, properly sourced | 10 |
| Sleeve figure not found in any cited document | 42 |
| **Value does not appear in the manufacturer's literature at all** | **27** |
| Correct sleeve dimension but item stocked is the chassis | 4 |
| Dead citation | 5 |

**`(verify)` — 4 rows.** Two resolve clean, two do not:

| Row | Model | Result |
|---|---|---|
| 3 | `RA4AC3048D1000A` | **Verified.** Value is correct (34.3 × 28.6 × 34.3 in = 871 × 726 × 871 mm; matches published 34 × 29 × 34 for RunTru A4AC3048D1). Tag can be cleared — but the citation is a generic landing page. |
| 4 | `T4TTX5048N1000A` | **Verified.** Trane XL15i 4TTX5048N1000A uncrated = H 51 × W 37 × D 34. Tag can be cleared; citation is a generic landing page. |
| 135 | `5FCH03` | **Still unverified.** Depth genuinely unknown; model does not appear in the cited IEC fan-coil IOM. |
| 138 | `5FCLB04` | **Still unverified.** Same as above. |

> Note on the `T`/`R` prefix: the sheet prefixes Trane model numbers (`T4TTX5048N1000A`,
> `T5TXCB003AS3HCA`, `RA4AC3048D1000A`). The manufacturer models are `4TTX5048N1000A`,
> `5TXCB003AS3HCA` and RunTru `A4AC3048D1000A`. This is why several Trane rows look
> unmatched against Trane literature.

---

## Root causes

### 1. Ice Air: marketing sheets cited instead of submittals (46 rows)

Nine Ice Air rows groups cite `ice-air-ptac-<series>-product-sheet.pdf`. These are one-page
performance sheets — capacity, EER, amps, a "Replaces:" list. **They contain zero dimensions.**

The real submittals with dimensional drawings exist at the predictable path and are live for
every series in use:

```
https://www.ice-air.com/wp-content/uploads/ice-air-ptac-<series>-submittal.pdf
        rscc  rsz  rscm  rsmk  rsf  rs16  rsea  rsan  rsk      ← all HTTP 200
```

Reading those drawings shows several recorded values are simply not Ice Air numbers:

| Series | Recorded | Manufacturer drawing | Rows |
|---|---|---|---:|
| RSAN | 42 × 16 × 15 (sleeve) | **chassis 39¾ W × 13¾ H × 21⅛ D**, enclosure 54 × 22 (dwg APB-9377) | 10 |
| RSEA | 44¾ × 16½ × 20¾ (sleeve) | **43½ W × 14½ H × 18 D** (dwg APA-8448) | 5 |
| RSCC | 40.75 × 15.75 × 18.688 (sleeve) | **chassis 42 W × 15 H × 19¼ D**, enclosure 54 × 22 | 6 |
| RSF | 27.125 × 16.875 × 18.125 | **chassis ≈26½ W × 16 H × 17½ D** (dwg SAB-8644) | 5 |
| RSK | 36 × 15 × 19.25 (chassis) | **36 × 15 × 19¼ — correct**, sleeve 36¾ | 8 |
| RSZ / RSMK / RSCM | various (sleeve) | no dimensions published in either sheet or submittal | 14 |

`42" × 16"` is the *generic industry PTAC sleeve size*. RSAN is not a 42 × 16 unit — that value
looks like a default applied to a non-standard cabinet.

**RSK is the model to copy:** it's the one Ice Air group tagged `(chassis)` rather than `(sleeve)`,
and it's the one that verifies exactly.

### 2. Islandaire: cut sheets don't publish chassis dimensions (59 rows)

The Islandaire EZ-series cut sheets contain nomenclature, performance data, and accessory tables
(wall sleeve-cabinets, hydronic coils, louvers, filters, subbases, enclosures) — but **no chassis
dimension table**. So for every Islandaire *unit* row, the recorded chassis dimension is not in the
cited document. The values are plausible and internally consistent, but they came from somewhere
else (likely an engineering manual/IOM) that isn't recorded.

What *is* verifiable in those cut sheets is the sleeve/accessory data, and where the sheet used it,
it used it correctly:

- **EZKF wall sleeve** — `36.125 W × 24.590 H × 10.5–16.0 D` matches the five published sleeve
  depths (10.5 / 11.5 / 12 / 14 / 16) exactly. ✅
- **EZ16 sleeve-cabinet** — `37.5 W (41.5 hydronic) × 16 H × 20.375 D` matches parts
  4080247-00/4080348-00 (short) and 2400124-00 (long). ✅
- Row 129 `WALL SLEEVE ASSY, KA/KF, 11.5"` matches part 2400031-06. ✅

⚠️ **Axis-order trap:** Islandaire accessory tables are printed **DEPTH | WIDTH | HEIGHT**, not
W × H × D. The sheet correctly re-maps Islandaire's "DEPTH" (the long axis) to Width — verified on
rows 27 and 31 — but anyone extending this tab must not copy the columns left-to-right.

⚠️ **One real inconsistency:** the hydronic (long) EZ16 sleeve is **20.875"** deep, not 20.375".
Rows 37 and 204–210 pair the 41.5" hydronic width with the short sleeve's 20.375" depth.

### 3. Sleeve depth recorded where the stocked item is the unit

This is the substantive data-quality issue behind the `(sleeve)` tag. A wall sleeve and its chassis
are different depths, often by 6–8":

| Example | Sleeve depth | Actual unit depth |
|---|---|---|
| Trane Kühl PTAC (rows 19–22) | 13.75" (recorded) | **21.5"** per Trane PTAC-PRD002A |
| GE Zoneline (rows 218–234) | 13.75" (RAB71B) | **20.8125"** — correctly recorded ✅ |
| Friedrich Wallmaster (rows 260–262) | 16¾" (recorded) | **16¼" chassis**, H 15¾ × W 26½ |
| Ice Air RSK (rows 179–186) | 36¾" wide sleeve | **chassis 36 × 15 × 19¼** — correctly recorded ✅ |

GE and Ice Air RSK show the right pattern; Trane PTAC and Friedrich Wallmaster show the wrong one.

### 4. Legacy models pointed at their replacement's document

- **Row 202 `8RSCT18`** and **row 196 `5RSET13`** cite the RSCC sheet — but RSCT and RSET are listed
  in that sheet's own *"RSCC Replaces"* list. These are legacy units inheriting their successor's
  (already incorrect) dimensions.
- **Row 200 `8RSWL16`** points at `ice-air.com/product/rscc/` — a different series entirely. No RSWL
  literature exists at Ice Air's standard paths.

### 5. One product misclassified

**Row 133 `EZ4V122231S46AA`** is recorded as `23" W × 23" H × depth TBD (sleeve)` citing
`islandaire.com/products/vert-i-pak/` (404). EZ4V is **not** a Vert-I-Pak vertical stack — its own
cut sheet states it "fits into standard 16" × 42" PTAC wall sleeves" and replaces 42 × 16 PTACs.
Published EZ4V sleeves are 42.00 W × 16.00 H × 13.75 D (break-down) or × 15.00 D (recessed louver).

**Correct value: `42" W x 16" H x 13.75" D (sleeve)` — identical to row 132.**
Source: `https://islandaire.com/wp-content/uploads/2025/05/ez-4v-series-cutsheet.pdf`

---

## Verified-correct groups (no action needed)

| Rows | Group | Evidence |
|---|---|---|
| 1–2 | Trane air handlers | AHR-PSD006C Table 23 |
| 5–10 | Trane cased coils | COR-PSD003A Tables 3–5, "Uncrated", H×W×D correctly re-ordered |
| 11–18 | Trane fan coils FCBB | UNT-SVX07Q Table 4 Model B (A = 33-5/16" size 03 / 38-5/16" size 04) |
| 179–186 | Ice Air RSK | RSK submittal drawing, chassis |
| 211–217 | Ice Air CHPW | CHPW submittal A/B/C/D/E table (46" for 09/13, 54" for 16/19) |
| 218–234 | GE Zoneline + AJCM | GE lists 16 H × 42 W × 20.8125 D |
| 235–236 | Friedrich USC / WSE sleeves | Uni-Fit & Wallmaster submittals |
| 237–238, 240–242 | Friedrich Chill Premier / Inverter | submittal Height/Width/Depth columns |
| 243–248, 259 | Friedrich Uni-Fit UCT/UET | submittal "UCT, UET Chassis" row |
| 249–258 | Friedrich Kühl | submittal Q/S/M/L sleeve table + model→sleeve mapping |

---

## Dead links and replacements

| Rows | Broken URL | Replacement |
|---|---|---|
| 94, 95, 99 | `…/2025/07/EZ-Series-RM-cutsheet.pdf` (404) | `…/2025/08/EZRM-Series-Cutsheet.pdf` — live, already used by rows 93/96–98 |
| 122, 126 | `…/2025/08/EZ-Series-CK-Cutsheet.pdf` (404) | `…/2025/06/EZ-Series-CK-cutsheet.pdf` — live, already used by rows 124/125 |
| 133 | `islandaire.com/products/vert-i-pak/` (404) | `…/2025/05/ez-4v-series-cutsheet.pdf` |
| 112 | `airdistributors.com/…/2025_16_BROCHURE_AD.pdf` (bot-blocked) | `…/2025/09/EZ-Series-16-Cutsheet.pdf` |
| 218–219, 222–228, 232–234 | `geappliances.com/ge/zoneline/products.htm` (404) | `geappliances.com/ge/zoneline/literature.htm` or the Zoneline PTAC Engineering Manual (GEA191051) |
| 86, 92, 119 | `islandaire.com/products/ez-series/` (redirects to a blog post) | series-specific Islandaire cut sheet (RK / RM / WM) |
| 3, 4 | `trane.com/residential/en/products/air-conditioners/` | Trane XL15i 4TTX5 product data; RunTru A4AC3 literature |
| 235 | `friedrich.com/professional/products/uni-fit` | `SUBM_UNIFIT_REV 2.16.2024.pdf` (already used by rows 243–248) |
| 200 | `ice-air.com/product/rscc/` (wrong series) | request RSWL literature from Ice Air |

⚠️ Note the duplicate-URL smell: the tab carries **two different URLs for the same Islandaire
series** in three cases (`EZKF-Series-Cutsheet.pdf` vs `EZKF-Series-Cut-Sheet.pdf`,
`EZ-Series-CK-cutsheet.pdf` vs `EZ-Series-CK-Cutsheet.pdf`, `EZRM-Series-Cutsheet.pdf` vs
`EZ-Series-RM-cutsheet.pdf`). In two of the three, one variant 404s. These look like guessed
filenames. Standardising on one verified URL per series would prevent recurrence.

Four Friedrich URLs contain **unencoded spaces**. Browsers handle it, but `curl`/scripts reject
them outright — worth percent-encoding if anything automated ever reads this column.

---

## Recommended fixes, in priority order

1. **Repoint all Ice Air rows** from `-product-sheet.pdf` to `-submittal.pdf`, and correct RSAN (10),
   RSEA (5), RSCC (6), RSF (5) to the drawing values above. *(26 rows)*
2. **Fix Trane PTAC depth** rows 19–22: `13.75"` → `21.5"` (or keep 13.75 and relabel explicitly as
   the sleeve, if the sleeve is what's stocked). *(4 rows)*
3. **Fix row 133** (EZ4V) — wrong product class. *(1 row)*
4. **Fix row 239** Friedrich `CCW12B10B` depth: `24½"` → `24"`. *(1 row)*
5. **Repair the 18 dead links** using the table above. *(18 rows)*
6. **Split the "W x H x D" column into three numeric columns plus a `Measured` column**
   (`chassis` / `sleeve` / `enclosure` / `carton`). Right now the basis is buried in a parenthetical,
   which is exactly how sleeve depths ended up in unit-depth positions. Free-text also blocks
   sorting and filtering — and note row 241 stores `20.62/13.37` where row 242 stores
   `20.625/13.375` for the identical unit.
7. **Resolve the remaining `depth TBD` rows** (120, 121, 133✓, 135, 138, 196, 200) and clear the
   `(verify)` tags on rows 3 and 4.
8. **Decide the stocking convention for rows 24–26** (KF heat sections carrying wall-sleeve
   dimensions) and rows 52–59 (KF chassis carrying wall-sleeve dimensions).

---

## Method / reproducibility

- Tab exported as XLSX via the Drive connector and parsed with `openpyxl` (values, not the markdown
  rendering, to avoid merged-cell artifacts).
- All 60 URLs fetched with a browser user-agent; status, content-type and byte size recorded.
- PDFs text-extracted with `pypdf`; where dimensions live inside vector CAD drawings (Ice Air
  submittals, Friedrich tables) pages were rendered at 190–300 dpi with `PyMuPDF` and read visually.
  This mattered: the first automated pass produced ~20 false "mismatches" purely from hyphenated
  fractions (`26-3/4`, `16-5/16`) and stacked-fraction glyphs.
- **A number "appearing in the document" was not treated as confirmation** — each value was matched
  to the specific model row/column in the manufacturer's table, which is how the Trane cased-coil
  and Friedrich Chill Premier column alignments were confirmed rather than assumed.

### Not individually re-verified

Called out honestly rather than passed off as checked: IEC/MPY vertical stack rows (134, 147, 149),
Ice Air FHA/FXA/LXA (136–142), FCVE/FCVC (143–151), SAB-8727 (152–153), and the Islandaire
accessory rows 28–30, 32–33. These are marked `UNSOURCED` in the CSV with the reason stated per row.

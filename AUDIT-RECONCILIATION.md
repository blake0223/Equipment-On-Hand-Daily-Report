# Cut Sheet Audit — Third-Party Reconciliation

**Question asked:** two audits of the *Dimensions and Cut Sheets* tab reached different
conclusions. Which one is right?

**Answer: neither is safe to act on as written.** Both contain errors of exactly the kind
they were hired to find. Below is what I verified independently, from the manufacturers'
own drawings, with the evidence.

---

## 1. Scoreboard — every checkable claim

Counts below are computed directly from the 262-row extract (`dimensions-audit.csv`),
not from either audit's prose.

| Claim | Audit A | Audit B | Verified truth |
|---|---|---|---|
| Rows citing an Ice Air **marketing product sheet** | 46 | **83** | **38** |
| Rows already citing an Ice Air **submittal** | "repoint every Ice Air row" | not mentioned | **30 — already done** |
| Total rows citing `ice-air.com` | — | — | 71 |
| `-submittal.pdf` exists for every series | yes | — | **True (9/9)** |
| `-dimensional-drawing.pdf` exists | — | "all 14 families, verified live" | **8 of 9 — RSCM 404s** |
| `(sleeve)` rows | 88 | 88 | **88** — both right |
| `(verify)` rows | 4 | 4 | **4** — both right |
| `depth TBD` rows | 6 listed | 7 | **7** |
| Ice Air **RSK** | "verifies exactly — the pattern to copy" | "36×15 is in-sleeve; overall is 38 × 16.75 × 19.25" | **Audit B is correct** |
| Ice Air **RSAN** chassis | 39¾ × 13¾ × 21⅛ | — | **39.75 × 15.875 × 17.375** — A is wrong |
| **GE** 42 × 16 basis | "GE lists 16×42×20.8125 — correct" | "42×16 is the sleeve — mixed basis" | **B is better supported** |

### Where each audit's headline number came from

**Audit B's "83 IceAir rows cite marketing product sheets" is the brand count, not the
citation count.** 83 rows carry the brand `IceAir`; 12 of those don't even cite an
ice-air.com URL (they point at IEC and Islandaire documents). Of the 71 that do,
**38** cite a product sheet and **30 already cite the correct submittal**. B inflated the
problem by a factor of ~2.2.

**Audit A's "46" is also wrong, and A misidentified which series are affected.** A's report
lists RSAN and RSK among the nine series citing product sheets and recommends repointing
them. Both already cite `-submittal.pdf`. A recommended work that was already done.

Neither audit noticed that **30 rows were already correctly cited.**

---

## 2. The finding neither audit reached

Every Ice Air PTAC in this tab is a **two-step shape**: a larger room-side cabinet, and a
narrower rear section that passes into the wall sleeve. **The dimensional drawings publish
both sets of numbers.** So "W × H × D" is ambiguous for these units unless you say which
step you mean — and *that* is the actual root cause, not the `(sleeve)` label.

RSK is the clean illustration. The drawing gives:

- overall **38 W × 16.75 H × 19.25 D**
- in-sleeve section **36 W × 15 H**

The tab records `36 × 15 × 19.25` — **two numbers from the rear section and one from the
overall envelope.** That is a genuinely mixed-basis cell, and Audit B described it
precisely. Audit A marked all 8 RSK rows "OK" and held them up as the model to copy.

The same two-step structure explains RSCC (overall 42 × 16.75 × 19.25, in-sleeve 40 × 15)
and RSEA (overall 43.5 × 14.875 × 18.5, in-sleeve 42.5 × 14.25).

**This is also why Audit A's corrections are unreliable.** A worked from *installation
assembly* drawings (e.g. APB-9377, titled "RSAN INSTALLATION"), where dimension leaders
point at whatever part of the exploded assembly they attach to — sleeve, chassis, heating
assembly, enclosure. A dedicated `-dimensional-drawing.pdf` exists for 8 of 9 series and
shows the unit alone, unambiguously. A never used them.

---

## 3. Verified Ice Air values — 52 rows

Read from the Ice Air `-dimensional-drawing.pdf` for each series. Full detail in
`iceair-verified-dimensions.csv`.

| Series | Rows | Sheet records now | Audit A's "fix" | **Verified overall** |
|---|---|---|---|---|
| RSAN | 10 | 42 × 16 × 15 | 39¾ × 13¾ × 21⅛ | **39.75 × 15.875 × 17.375** |
| RSK | 8 | 36 × 15 × 19.25 | *"correct"* | **38 × 16.75 × 19.25** |
| RSCC | 6 | 40.75 × 15.75 × 18.688 | 42 × 15 × 19¼ | **42 × 16.75 × 19.25** |
| RSEA | 5 | 44.75 × 16.5 × 20.75 | 43½ × 14½ × 18 | **43.5 × 14.875 × 18.5** |
| RSF | 5 | 27.125 × 16.875 × 18.125 | ≈26½ × 16 × 17½ | **26.375 × 15.813 × 20.75** |
| RS16 | 7 | 37.5 × 16 × 20.375 | — | **34.5 × 14.25 × 18.5** |
| RSZ | 6 | 36 × 16 × 11.375 | *"none published"* | **36 × 14.75 × 19** |
| RSMK | 5 | 36 × 13.9375 × 19.25 | *"none published"* | **34.625 × 19.230 × 15.625** |
| RSCM | 2 | 32 × 18.25 × 16.75 | *"none published"* | **unavailable — drawing 404s** |

Audit A proposed corrections for four series. **Its width is right in most cases; its
height or depth is wrong in every one of them** — RSF's depth by 3¼ inches. Pasting A's
column in would have replaced wrong numbers with different wrong numbers.

Two additional notes:

- **RSMK looks like an axis transposition.** Recorded depth `19.25` is almost exactly the
  true *height* (19.230). Worth checking whether that pattern repeats elsewhere.
- **RS16's recorded values (37.5 / 41.5 hydronic × 16 × 20.375) are the Islandaire EZ16
  sleeve-cabinet figures**, not Ice Air RS16 unit figures. Confirm which item is actually
  stocked before overwriting — this may be a correct record of the wrong product.

---

## 4. GE Zoneline — 17 rows

The tab records `42" W × 16" H × 20.8125" D`. Audit A marked all rows OK ("GE lists
16 H × 42 W × 20.8125 D"). Audit B called it mixed-basis and flagged it as the one number
it had confirmed the cited document contradicts.

From GE's own *Zoneline AZ45/AZ65 Architects & Engineers Manual*:

- p.11 and p.24: **"The dimensions of the RAB71B wall case are 42" wide by 16" high by
  13-3/4" deep"** — 42 × 16 is stated by GE as the **wall case**, not the chassis.
- p.48 (bid form): **"Unit dimensions shall not exceed 42-1/8" wide and 16-1/4" high with
  room cabinet in place."**
- p.23: wall case **with grille**, RAB71 = **20-7/8"** (20.875).
- **`20-13/16"` (20.8125) appears nowhere in the manual.** The specification tables on
  pp.51–52 carry performance data only — no dimensions at all.

**So B has the better of this.** 42 × 16 are GE's wall-case dimensions by GE's own words,
and 20.8125 is not a GE wall-case depth (that's 13¾). A's assertion that "GE lists
16 × 42 × 20.8125" is not supported by GE's engineering literature — 20.8125 is a figure
that circulates on retail listings.

That said, B's framing overstates the practical damage: the installed envelope really is
about 42 × 16 in front and about 20⅞ deep with the grille, so the recorded triple is
roughly the right size. It is not a 6–8" error like the Trane PTAC case. **It is a
provenance problem, not a magnitude problem** — which is still worth fixing, because the
cell can't be defended from the cited document.

---

## 5. What both audits got right

Worth stating plainly, because the disagreement makes it easy to discard both:

- **The `(sleeve)` problem is real**, and both identified it independently. 88 rows.
- **Both counted the tags correctly** — 88 sleeve, 4 verify.
- **Both recommended the same structural fix**, and it is the right one: a **`Basis`
  column** (unit / chassis / in-sleeve / enclosure / carton) plus three numeric W/H/D
  columns. The basis is currently carried only in a parenthetical, which is precisely how
  a rear-section height ends up sitting next to an overall depth.
- **Audit A's row 239 catch is good** — Friedrich `CCW12B10B` depth 24½" → 24".
- **Audit A's row 133 catch is good and worth doing** — `EZ4V122231S46AA` filed as a
  23×23 Vert-I-Pak when EZ4V fits standard 16×42 PTAC sleeves.
- **Audit A's model-prefix note is genuinely useful** — the tab prefixes Trane models with
  `T`/`R`, so `T4TTX5048N1000A` is Trane `4TTX5048N1000A`. That explains the `(verify)`
  tags on rows 3 and 4 and is why searches came up empty.

---

## 6. Recommended sequence

1. **Do not paste either audit's correction column into the sheet.** Use the verified
   values in `iceair-verified-dimensions.csv` for the 52 Ice Air rows.
2. **Add the `Basis` column and split W/H/D into three numeric columns.** Both audits
   agree; it is the only change that stops this recurring.
3. **Repoint the 38 product-sheet rows** to `-dimensional-drawing.pdf` (not the submittal —
   the submittal's drawings are assembly views and are what misled Audit A). Leave the 30
   rows already citing submittals alone, or upgrade them to the dimensional drawings too.
4. **Decide the RS16 and GE questions on stocking reality, not literature** — for both,
   the question is which physical item you count in inventory.
5. **Request RSCM literature from Ice Air.** Genuinely unavailable.

---

## 7. Scope and limits of this review — read this

I did **not** re-verify all 262 rows. I verified the specific claims where the two audits
disagreed, plus the Ice Air series that carry the largest row counts.

**Verified first-hand from manufacturer documents (~69 rows):** Ice Air RSAN, RSK, RSCC,
RSEA, RSF, RS16, RSZ, RSMK (52 rows) and GE Zoneline (17 rows).

**Verified by computation over the 262-row extract:** all tag counts, URL distributions,
brand counts, dead-link patterns.

**Not independently checked — still open:** the 111 Islandaire rows, 28 Friedrich rows,
22 Trane rows, and the IEC row. In particular:

- **Audit A's claim that Islandaire cut sheets publish no chassis dimensions (59 rows)** is
  plausible and important, but I did not confirm it. If true, those 59 values have no
  recorded provenance at all — that is the single largest open exposure in the tab and the
  obvious next thing to check.
- **Audit A's dead-link list** (18 rows) and **Audit B's** (10 rows) disagree; I did not
  re-test every URL. The Ice Air ones I did test were all live.
- **Audit A's Trane PTAC finding (rows 19–22, 13.75" → 21.5")** is the largest single
  magnitude claim in either report and I did not verify it. Worth doing next.

**One caveat on my own inputs:** I could not read the Google Sheet directly — the Sheets
tool reports my caller lacks the `google_workspace.use` capability, the same block Audit A
hit on writes. The recorded values and URLs used here come from Audit A's 262-row extract.
Its tag counts (88 / 4) reproduce exactly and match Audit B's independent count, which is
good corroboration that the transcription is faithful, but **the corrections should be
applied against the live sheet, and the row numbers spot-checked** before a bulk paste.

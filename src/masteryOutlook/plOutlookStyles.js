// src/masteryOutlook/plOutlookStyles.js
/**
 * PL Outlook — all injected CSS for the Mastery Outlook view.
 *
 * Option B (template-literal export): no esbuild CSS loader needed.
 * Consumed by: masteryOutlookView.js → injectStyles(PL_OUTLOOK_CSS, 'pl-outlook-styles')
 *
 * Scoping: all rules live under .mo-shell to avoid Canvas page collisions.
 * Data-attribute variant selectors use .mo-shell[data-*] instead of body[data-*].
 * CSS custom properties stay on :root so calc() inside children resolves correctly.
 *
 * Derived from a design template (see src/masteryOutlook/Mastery Outlook/).
 */

export const PL_OUTLOOK_CSS = `

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   CSS VARIABLES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
:root {
  --mo-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --mo-legacy-font: LatoWeb, 'Lato Extended', Lato, 'Helvetica Neue', Helvetica, Arial, sans-serif;

  --bg:           #FAFAF8;
  --bg-surface:   #FFFFFF;
  --bg-secondary: #F3F2EE;
  --bg-tertiary:  #ECEAE3;

  --text-primary:   #1F1E1B;
  --text-secondary: #55534D;
  --text-tertiary:  #8A877F;

  --border-tertiary:  #E4E2DB;
  --border-secondary: #CFCCC2;
  --border-primary:   #8A877F;

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;

  /* score palette */
  --s-hi:      #C0DD97;  --s-hi-ink:   #27500A;  --s-hi-bg:   #EAF3DE;
  --s-good:    #9FE1CB;  --s-good-ink: #085041;  --s-good-bg: #DDF2EA;
  --s-dev:     #FAC775;  --s-dev-ink:  #633806;  --s-dev-bg:  #FAEEDA;
  --s-low:     #F7C1C1;  --s-low-ink:  #791F1F;  --s-low-bg:  #FCEBEB;

  /* aliases used by ho-* components */
  --hi-bg:   #EAF3DE;  --hi-ink:   #27500A;
  --good-bg: #DDF2EA;  --good-ink: #085041;
  --dev-bg:  #FAEEDA;  --dev-ink:  #633806;
  --low-bg:  #FCEBEB;  --low-ink:  #791F1F;

  --blue:         #185FA5;
  --blue-ink:     #0C447C;
  --blue-bg:      #E6F1FB;

  --amber:        #854F0B;
  --amber-bg:     #FAEEDA;
  --amber-border: #C9943A;
  --red:          #993C1D;
  --red-bg:       #FAECE7;
  --green:        #3B6D11;
  --green-bg:     #EAF3DE;

  /* density — comfortable default; .cozy on .mo-shell for roomier rows */
  --row-py:  7px;
  --cell-py: 7px;
  --gap:     9px;
}

.mo-shell.cozy { --row-py: 10px; --cell-py: 9px; --gap: 10px; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SCOPED BASE + SHELL CONTAINER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.mo-shell * { box-sizing: border-box; }
.mo-shell button { font-family: var(--mo-font); }

.mo-shell {
  font-family: var(--mo-font);
  font-size: 13px;
  color: var(--text-primary);
  background: var(--bg);
  -webkit-font-smoothing: antialiased;
  line-height: 1.4;
  padding: 22px 28px 80px;
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   HEADER / TOP BAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.mo-topbar  { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:18px; flex-wrap:wrap; }
.mo-title   { font-size:17px; font-weight:600; letter-spacing:-0.01em; }
.mo-subtitle{ font-size:11.5px; color:var(--text-secondary); margin-top:3px; }
.mo-topbtns { display:flex; gap:6px; align-items:center; flex-wrap:wrap; }

/* ── Button system ────────────────────────────────────────────────── */
.mo-shell .btn {
  font-size:11.5px; padding:5px 10px; border-radius:var(--radius-md);
  border:0.5px solid var(--border-secondary); background:var(--bg-surface);
  color:var(--text-primary); cursor:pointer;
  display:inline-flex; align-items:center; gap:6px;
  transition: background .12s, border-color .12s;
}
.mo-shell .btn:hover     { background:var(--bg-secondary); border-color:var(--border-primary); }
.mo-shell .btn[disabled] { opacity:.5; cursor:not-allowed; }
.mo-shell .btn-primary   { background:var(--blue); color:#fff; border-color:var(--blue); }
.mo-shell .btn-primary:hover { background:var(--blue-ink); border-color:var(--blue-ink); }
.mo-shell .btn-sm        { font-size:10.5px; padding:3px 8px; }
.mo-shell .btn-warn      { color:var(--amber); border-color:#E5C892; }
.mo-shell .btn-warn:hover{ background:var(--amber-bg); }
.mo-shell .btn-danger    { color:var(--red); border-color:#E6BFB1; }
.mo-shell .btn-danger:hover { background:var(--red-bg); }
.mo-shell .btn-ghost     { border-color:transparent; background:transparent; }
.mo-shell .btn-ghost:hover { background:var(--bg-secondary); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COURSE-LEVEL SYNC STRIP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.course-sync {
  display:flex; align-items:center; justify-content:space-between; gap:12px;
  padding:9px 12px; margin-bottom:14px;
  background:var(--bg-surface); border:0.5px solid var(--border-tertiary);
  border-radius:var(--radius-lg); flex-wrap:wrap;
}
.cs-left { display:flex; align-items:center; gap:14px; font-size:11.5px; color:var(--text-secondary); flex-wrap:wrap; }
.cs-stat  { display:inline-flex; align-items:center; gap:5px; }
.cs-stat b{ color:var(--text-primary); font-weight:600; }
.cs-dot   { width:7px; height:7px; border-radius:50%; display:inline-block; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   COLUMN HEADER ROW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.col-head { display:grid; grid-template-columns:22px 1fr 74px 120px 58px 140px 28px; gap:var(--gap); padding:2px 14px 6px; align-items:center; }
.col-head div { font-size:10px; font-weight:600; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.05em; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   OUTCOME ROWS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.outcome-row {
  border:0.5px solid var(--border-tertiary); border-radius:var(--radius-lg);
  margin-bottom:8px; background:var(--bg-surface);
  transition: border-color .15s, box-shadow .18s, margin .18s;
  position:relative;
}
.outcome-row.open {
  border-color:var(--blue);
  box-shadow: 0 0 0 1.5px var(--blue), 0 8px 28px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05);
  margin:14px 0 16px; z-index:2;
}
.outcome-row.open::before {
  content:''; position:absolute; left:-1px; top:8px; bottom:8px;
  width:3px; background:var(--blue); border-radius:3px;
}
.outcome-row.open .outcome-header { background:var(--blue-bg); border-radius:var(--radius-lg) var(--radius-lg) 0 0; }
.outcome-row.open .outcome-header:hover { background:var(--blue-bg); }
.outcome-row.open .oname { color:var(--blue-ink); }

/* dim siblings when one row is open */
#outcomes:has(.outcome-row.open) .outcome-row:not(.open)       { opacity:0.55; }
#outcomes:has(.outcome-row.open) .outcome-row:not(.open):hover { opacity:1; }

.outcome-header {
  display:grid; grid-template-columns:22px 1fr 74px 120px 58px 140px 28px;
  gap:var(--gap); align-items:center;
  padding:calc(var(--row-py) + 2px) 14px;
  cursor:pointer; border-radius:var(--radius-lg);
}
.outcome-header:hover { background:var(--bg-secondary); }
.onum { font-size:11px; color:var(--text-tertiary); font-weight:500; }
.oname{ font-size:13px; font-weight:500; }

.pl-pill { font-size:11.5px; font-weight:600; padding:2px 9px; border-radius:20px; text-align:center; display:inline-block; min-width:44px; }
.spread  { height:12px; border-radius:3px; overflow:hidden; display:flex; gap:1px; background:var(--bg-tertiary); }
.spread .seg { height:100%; }
.below-n   { font-size:12px; color:var(--text-secondary); text-align:center; }
.below-n b { color:var(--text-primary); font-weight:600; }
.chevron      { font-size:11px; color:var(--text-tertiary); text-align:center; transition:transform .2s; display:inline-block; user-select:none; }
.chevron.open { transform:rotate(90deg); }

/* per-outcome pushing indicator (hides sync summary while pushing) */
.header-pushing { display:none; align-items:center; gap:6px; font-size:10.5px; color:var(--blue-ink); }
.outcome-row.pushing .header-pushing    { display:inline-flex; }
.outcome-row.pushing .sync-inline       { display:none !important; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SYNC SUMMARY — 3 DISPLAY VARIANTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.sync-inline { display:flex; align-items:center; gap:6px; flex-wrap:wrap; font-size:10.5px; }
.sync-inline .sep { color:var(--border-secondary); font-size:10px; }

/* v1: counts */
.si       { display:inline-flex; align-items:center; gap:3px; font-weight:500; white-space:nowrap; padding:1px 5px; border-radius:var(--radius-sm); }
.si-needs   { color:var(--amber); background:var(--amber-bg); }
.si-override{ color:var(--red);   background:var(--red-bg); }
.si-synced  { color:var(--green); }
.si-setup   { color:var(--text-tertiary); }
.si-icon    { font-size:10px; line-height:1; }

/* v2: single worst-state chip */
.sync-chip {
  font-size:10.5px; font-weight:500; padding:2px 8px; border-radius:20px;
  display:inline-flex; align-items:center; gap:5px; white-space:nowrap;
  cursor:default; position:relative;
}
.sync-chip.ok   { background:var(--green-bg); color:var(--green); }
.sync-chip.warn { background:var(--amber-bg); color:var(--amber); }
.sync-chip.alert{ background:var(--red-bg);   color:var(--red); }
.sync-chip-tip {
  display:none; position:absolute; top:calc(100% + 6px); right:0;
  background:var(--text-primary); color:#fff; font-weight:400;
  padding:6px 9px; border-radius:var(--radius-md); font-size:10.5px;
  white-space:nowrap; z-index:40;
}
.sync-chip:hover .sync-chip-tip { display:block; }

/* v3: mini stacked bar */
.sync-bar-wrap  { display:flex; align-items:center; gap:6px; }
.sync-bar       { height:8px; width:72px; border-radius:2px; overflow:hidden; display:flex; gap:1px; background:var(--bg-tertiary); flex-shrink:0; }
.sb-seg         { height:100%; }
.sb-seg.synced  { background:var(--s-hi); }
.sb-seg.needs   { background:var(--s-dev); }
.sb-seg.override{ background:var(--s-low); }
.sync-bar-label { font-size:10.5px; color:var(--text-secondary); white-space:nowrap; }

/* show/hide variant based on data-summary attribute */
.mo-shell[data-summary="counts"] .sync-inline.v-counts { display:flex; }
.mo-shell[data-summary="counts"] .sync-inline.v-chip,
.mo-shell[data-summary="counts"] .sync-inline.v-bar    { display:none; }

.mo-shell[data-summary="chip"] .sync-inline.v-chip     { display:flex; }
.mo-shell[data-summary="chip"] .sync-inline.v-counts,
.mo-shell[data-summary="chip"] .sync-inline.v-bar      { display:none; }

.mo-shell[data-summary="bar"] .sync-inline.v-bar       { display:flex; }
.mo-shell[data-summary="bar"] .sync-inline.v-counts,
.mo-shell[data-summary="bar"] .sync-inline.v-chip      { display:none; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   DETAIL PANEL + TABS + TOOLBAR
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.detail      { display:none; border-top:0.5px solid var(--border-tertiary); background:var(--bg); }
.detail.open { display:block; border-top-color:var(--blue); border-radius:0 0 var(--radius-lg) var(--radius-lg); }

.detail-tabs { display:flex; gap:2px; border-bottom:0.5px solid var(--border-tertiary); padding:0 14px; background:var(--bg-surface); }
.dtab       { font-size:11.5px; padding:8px 12px; cursor:pointer; color:var(--text-secondary); border:none; background:none; border-bottom:2px solid transparent; font-family:inherit; }
.dtab:hover { color:var(--text-primary); }
.dtab.active{ color:var(--blue); border-bottom-color:var(--blue); font-weight:600; }

.tab-content        { display:none; padding:10px 14px 14px; }
.tab-content.active { display:block; }

.sync-toolbar {
  display:flex; align-items:center; justify-content:space-between; gap:10px;
  margin-bottom:8px; padding:6px 8px; flex-wrap:wrap;
  background:var(--bg-surface); border:0.5px solid var(--border-tertiary); border-radius:var(--radius-md);
}
.sync-toolbar-left   { font-size:11.5px; color:var(--text-secondary); }
.sync-toolbar-left b { color:var(--text-primary); font-weight:600; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   PROGRESS STRIP + SPINNER + COURSE PUSH BANNER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.progress-strip {
  display:none; align-items:center; gap:10px;
  padding:7px 12px; margin:0 14px 10px;
  background:var(--blue-bg); border:0.5px solid #B5D3ED;
  color:var(--blue-ink); border-radius:var(--radius-md); font-size:11.5px;
}
.progress-strip.active   { display:flex; }
.progress-strip .ps-text { flex:1; }
.progress-strip .ps-text b { font-weight:600; }
.progress-strip .ps-bar  { height:3px; flex:0 0 140px; background:#CFE2F3; border-radius:2px; overflow:hidden; }
.progress-strip .ps-bar-fill { height:100%; background:var(--blue); width:0%; transition:width .35s ease; }

.spinner {
  width:12px; height:12px; border-radius:50%;
  border:1.5px solid currentColor; border-right-color:transparent;
  animation:mo-spin .8s linear infinite; display:inline-block;
}
@keyframes mo-spin { to { transform:rotate(360deg); } }

/* course-level progress banner (replaces cs-left when pushing) */
.course-sync.pushing          { background:var(--blue-bg); border-color:#B5D3ED; }
.cs-progress                  { display:none; align-items:center; gap:10px; font-size:11.5px; color:var(--blue-ink); }
.course-sync.pushing .cs-progress { display:flex; }
.course-sync.pushing .cs-left     { display:none; }
.cs-progress .ps-bar      { height:3px; flex:0 0 180px; background:#CFE2F3; border-radius:2px; overflow:hidden; }
.cs-progress .ps-bar-fill { height:100%; background:var(--blue); width:0%; transition:width .35s ease; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STUDENT TABLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.stu-wrap { overflow:visible; }
.stu-table {
  width:100%; border-collapse:separate; border-spacing:0; font-size:12px; table-layout:fixed;
  background:var(--bg-surface); border:0.5px solid var(--border-tertiary);
  border-radius:var(--radius-md); overflow:hidden;
}
.stu-table th {
  font-size:10px; font-weight:600; color:var(--text-tertiary); text-align:left;
  padding:8px 10px; border-bottom:0.5px solid var(--border-tertiary);
  text-transform:uppercase; letter-spacing:.05em; background:var(--bg-secondary);
}
.stu-table td {
  padding:var(--cell-py) 10px; border-bottom:0.5px solid var(--border-tertiary);
  vertical-align:middle; overflow:visible;
}
.stu-table tr:last-child td { border-bottom:none; }
.stu-table tr.hl-override td { background:#FDF5F1; }
.stu-table tr.row-pushing td { background:#F3F8FD; }
.stu-name { font-weight:500; }
.stu-sub  { font-size:10.5px; color:var(--text-tertiary); margin-top:1px; }
.score-pill { font-size:11px; font-weight:600; padding:1px 8px; border-radius:8px; display:inline-block; min-width:42px; text-align:center; }
.act-btns { display:flex; gap:4px; flex-wrap:nowrap; }
.col-note { margin-top:8px; font-size:10.5px; color:var(--text-tertiary); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INTERACTIVE PILLS (variants A / B / C)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.pill-btn {
  font-size:11px; font-weight:600; padding:2px 9px; border-radius:10px;
  min-width:46px; text-align:center; cursor:pointer;
  display:inline-flex; align-items:center; justify-content:center; gap:4px;
  border:0.5px solid transparent; font-family:inherit; line-height:1.3;
  transition: box-shadow .12s, border-color .12s, transform .06s;
  position:relative;
}
.pill-btn:hover           { border-color:currentColor; }
.pill-btn:active          { transform:translateY(0.5px); }
.pill-btn[disabled]       { cursor:default; opacity:.85; }
.pill-btn[disabled]:hover { border-color:transparent; }

/* editable badge (pencil icon) */
.pill-btn.editable::after {
  content:'✎'; position:absolute; top:-4px; right:-4px;
  width:11px; height:11px; border-radius:50%;
  background:var(--text-primary); color:#fff;
  font-size:7.5px; line-height:11px; text-align:center; font-weight:600;
  opacity:0; transition:opacity .12s; border:1px solid var(--bg-surface);
}
.pill-btn.editable:hover::after { opacity:1; }

/* pushable badge (up-arrow icon) */
.pill-btn.pushable::after {
  content:'↑'; position:absolute; top:-4px; right:-4px;
  width:11px; height:11px; border-radius:50%;
  background:var(--blue); color:#fff;
  font-size:8px; line-height:11px; text-align:center; font-weight:600;
  opacity:0; transition:opacity .12s; border:1px solid var(--bg-surface);
}
.pill-btn.pushable:hover::after { opacity:1; }
.pill-btn.pushable:hover        { box-shadow: 0 0 0 1.5px var(--blue); }

/* tooltip inside pill */
.pill-tip {
  display:none; position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
  background:var(--text-primary); color:#fff; font-weight:500;
  padding:4px 7px; border-radius:var(--radius-sm); font-size:10.5px;
  white-space:nowrap; z-index:25; pointer-events:none;
}
.pill-btn:hover .pill-tip { display:block; }
.pill-arrow { color:var(--text-tertiary); font-size:11px; margin:0 1px; user-select:none; }

/* merged pill (variant C: Canvas ↔ Marzano side-by-side) */
.pill-merged {
  display:inline-flex; align-items:stretch; gap:0; border-radius:10px; overflow:hidden;
  border:0.5px solid var(--border-tertiary); cursor:pointer;
  font-size:11px; font-weight:600; line-height:1.3; position:relative;
}
.pill-merged:hover { border-color:var(--border-primary); }
.pill-merged .seg  { padding:2px 9px; min-width:44px; text-align:center; }
.pill-merged .arrow{ padding:2px 4px; background:var(--bg-secondary); color:var(--text-tertiary); display:flex; align-items:center; font-weight:500; }
.pill-merged.equal .arrow      { display:none; }
.pill-merged.equal .seg.proj   { display:none; }

/* tiny override icon button */
.or-icon { background:none; border:none; cursor:pointer; padding:2px 4px; color:var(--text-tertiary); font-size:11px; border-radius:3px; font-family:inherit; line-height:1; }
.or-icon:hover { color:var(--amber); background:var(--amber-bg); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ROW-ACTION VARIANT SELECTORS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
/* statusMenu variant: hide plain action col + old override form rows */
.mo-shell[data-row-action="statusMenu"] .td-action { display:none; }
.mo-shell[data-row-action="statusMenu"] th.th-action { display:none; }
.mo-shell[data-row-action="statusMenu"] tr.of-row { display:none; }

/* pills variants: hide default act col, show the right pill col */
.mo-shell[data-row-action="pillsAB"],.mo-shell[data-row-action="pillsWill"],.mo-shell[data-row-action="pillsMerged"] { }
.mo-shell[data-row-action="pillsAB"] .td-action .act-default,
.mo-shell[data-row-action="pillsWill"] .td-action .act-default,
.mo-shell[data-row-action="pillsMerged"] .td-action .act-default { display:none; }
.mo-shell[data-row-action="pillsAB"] .td-pills-A,
.mo-shell[data-row-action="pillsWill"] .td-pills-W,
.mo-shell[data-row-action="pillsMerged"] .td-pills-M { display:table-cell; }
.td-pills-A,.td-pills-W,.td-pills-M { display:none; }
.mo-shell[data-row-action="pillsAB"] .td-canvas,
.mo-shell[data-row-action="pillsAB"] .td-proj,
.mo-shell[data-row-action="pillsWill"] .td-canvas,
.mo-shell[data-row-action="pillsWill"] .td-proj,
.mo-shell[data-row-action="pillsMerged"] .td-canvas,
.mo-shell[data-row-action="pillsMerged"] .td-proj { display:none; }
.mo-shell[data-row-action="pillsAB"] th.th-canvas,.mo-shell[data-row-action="pillsAB"] th.th-proj,
.mo-shell[data-row-action="pillsWill"] th.th-canvas,.mo-shell[data-row-action="pillsWill"] th.th-proj,
.mo-shell[data-row-action="pillsMerged"] th.th-canvas,.mo-shell[data-row-action="pillsMerged"] th.th-proj { display:none; }
.mo-shell[data-row-action="pillsAB"] th.th-pillsA,
.mo-shell[data-row-action="pillsWill"] th.th-pillsW,
.mo-shell[data-row-action="pillsMerged"] th.th-pillsM { display:table-cell; }
th.th-pillsA,th.th-pillsW,th.th-pillsM { display:none; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   SYNC BADGE (per-row status pill)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.sync-badge { font-size:10px; font-weight:600; padding:2px 7px; border-radius:10px; white-space:nowrap; display:inline-flex; align-items:center; gap:4px; }
.sb-synced    { background:var(--green-bg); color:var(--green); }
.sb-needs     { background:var(--amber-bg); color:var(--amber); }
.sb-override-q{ background:var(--red-bg);   color:var(--red); }
.sb-override  { background:var(--red-bg);   color:var(--red); }
.sb-ne        { background:var(--bg-secondary); color:var(--text-tertiary); }
.sb-pushing   { background:var(--blue-bg);  color:var(--blue-ink); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   ALIGNMENT DOTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.dot-row { display:flex; gap:3px; align-items:center; flex-wrap:wrap; position:relative; }
.dot {
  width:22px; height:22px; border-radius:var(--radius-sm);
  font-size:10.5px; font-weight:600;
  display:flex; align-items:center; justify-content:center;
  cursor:pointer; position:relative; flex-shrink:0;
  border:0.5px solid transparent;
}
.dot:hover       { border-color:var(--border-primary); }
.dot.active      { box-shadow:0 0 0 1.5px var(--blue); }
.dot.ignored     { opacity:0.35; }
.dot.ignored::after {
  content:''; position:absolute; top:50%; left:-2px; right:-2px; height:1.5px;
  background:var(--text-secondary); transform:translateY(-50%) rotate(-15deg);
}
.dot.has-comment::before {
  content:''; position:absolute; top:-3px; right:-3px; width:7px; height:7px;
  border-radius:50%; background:var(--amber); border:1px solid var(--bg-surface); z-index:2;
}

/* hover preview tooltip */
.dot-preview {
  display:none; position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%);
  background:var(--text-primary); color:#fff;
  padding:4px 7px; border-radius:var(--radius-sm); font-size:10.5px; font-weight:500;
  white-space:nowrap; z-index:20; pointer-events:none;
}
.dot:hover .dot-preview  { display:block; }
.dot.active .dot-preview { display:none; }
.dot.ignored .dot-preview { display:none; }
.dot.ignored .dp-title,
.dot.ignored .dp-score { text-decoration:line-through; opacity:0.6; }

/* pinned click popover */
.dot-popover {
  display:none; position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%);
  background:var(--bg-surface); color:var(--text-primary);
  border:0.5px solid var(--border-secondary); border-radius:var(--radius-md);
  padding:10px 12px; font-size:11px; width:220px; z-index:30;
  box-shadow: 0 6px 22px rgba(31,30,27,.08), 0 2px 4px rgba(31,30,27,.04);
}
.dot.active .dot-popover { display:block; }
.dot-popover::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:5px solid transparent; border-top-color:var(--bg-surface); }
.dp-hd    { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; }
.dp-title { font-weight:600; font-size:11.5px; }
.dp-score { font-size:10px; font-weight:600; padding:1px 6px; border-radius:8px; }
.dp-rows  { display:flex; flex-direction:column; gap:3px; }
.dp-row   { display:flex; justify-content:space-between; gap:12px; }
.dp-row .lbl { color:var(--text-secondary); }
.dp-row .val { font-weight:500; }
.dp-divider  { height:0.5px; background:var(--border-tertiary); margin:8px -4px 8px; }
.dp-toggle   { display:flex; align-items:center; justify-content:space-between; font-size:11px; color:var(--text-secondary); }
.toggle-sw   { position:relative; width:28px; height:16px; border-radius:10px; background:var(--border-secondary); cursor:pointer; transition:background .15s; flex-shrink:0; }
.toggle-sw::after { content:''; position:absolute; top:2px; left:2px; width:12px; height:12px; border-radius:50%; background:#fff; transition:left .15s; }
.toggle-sw.on       { background:var(--amber); }
.toggle-sw.on::after{ left:14px; }
.dp-footnote { font-size:10px; color:var(--text-tertiary); margin-top:6px; line-height:1.35; }
.dp-comment-wrap    { margin-top:8px; padding-top:8px; border-top:0.5px dashed var(--border-tertiary); }
.dp-comment-label   { display:block; font-size:10px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-tertiary); font-weight:600; margin-bottom:4px; }
.dp-comment-label .opt { font-weight:400; text-transform:none; letter-spacing:0; }
.dp-comment         { width:100%; padding:5px 7px; font-size:11px; font-family:inherit; background:var(--bg-surface); border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); resize:vertical; min-height:42px; color:var(--text-primary); box-sizing:border-box; }
.dp-comment:focus   { outline:none; border-color:var(--amber); }
.dp-comment-actions { display:flex; gap:4px; justify-content:flex-end; margin-top:5px; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INLINE CANVAS-EDIT POPOVER (pill-edit)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.pill-edit { display:inline-flex; flex-direction:column; gap:6px; background:var(--bg-surface); border:0.5px solid var(--amber); border-radius:var(--radius-md); padding:8px 10px; box-shadow:0 4px 14px rgba(31,30,27,.10); position:relative; z-index:15; min-width:220px; text-align:left; font-size:11px; }
.pill-edit .pe-row    { display:flex; align-items:center; gap:8px; }
.pill-edit .pe-lbl    { font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; font-weight:600; color:var(--text-tertiary); }
.pill-edit .pe-input  { width:56px; font-size:13px; font-weight:600; font-family:inherit; padding:3px 6px; border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); background:var(--bg-surface); color:var(--text-primary); text-align:center; }
.pill-edit .pe-input:focus { outline:none; border-color:var(--amber); }
.pill-edit .pe-was    { color:var(--text-tertiary); font-size:10.5px; }
.pill-edit .pe-chips  { display:flex; gap:4px; flex-wrap:wrap; }
.pill-edit .pe-chip   { font-size:10px; padding:2px 7px; border-radius:10px; background:var(--bg-surface); border:0.5px solid var(--border-secondary); color:var(--text-secondary); cursor:pointer; font-family:inherit; }
.pill-edit .pe-chip:hover { background:var(--bg-secondary); }
.pill-edit .pe-chip.on    { background:var(--amber-bg); color:var(--amber); border-color:#E5C892; }
.pill-edit .pe-comment{ width:100%; padding:5px 7px; font-size:11px; font-family:inherit; resize:vertical; border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); background:var(--bg-surface); color:var(--text-primary); min-height:36px; box-sizing:border-box; }
.pill-edit .pe-comment:focus { outline:none; border-color:var(--amber); }
.pill-edit .pe-actions{ display:flex; gap:5px; justify-content:flex-end; }
.pill-edit .pe-help   { font-size:10px; color:var(--text-tertiary); line-height:1.35; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   STATUS-MENU VARIANT (dropdown from sync badge)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.status-menu-wrap { position:relative; display:inline-block; }
.status-pill-btn  { background:none; border:none; padding:0; cursor:pointer; font-family:inherit; display:inline-flex; align-items:center; gap:2px; }
.status-pill-btn .chev    { font-size:9px; color:currentColor; opacity:.7; margin-left:2px; }
.status-pill-btn:hover .sync-badge { filter:brightness(0.97); }
.status-pill-btn:hover .chev       { opacity:1; }
.status-menu {
  display:none; position:absolute; top:calc(100% + 6px); right:0;
  background:var(--bg-surface); border:0.5px solid var(--border-secondary);
  border-radius:var(--radius-md);
  box-shadow: 0 8px 24px rgba(31,30,27,.12), 0 2px 6px rgba(31,30,27,.06);
  width:260px; z-index:50; padding:4px; font-size:11.5px; text-align:left;
}
.status-menu.open { display:block; }
.sm-item   { display:flex; align-items:flex-start; gap:10px; padding:8px 10px; border-radius:var(--radius-sm); cursor:pointer; color:var(--text-primary); }
.sm-item:hover  { background:var(--bg-secondary); }
.sm-item.active { background:var(--blue-bg); }
.sm-icon   { flex-shrink:0; font-size:13px; line-height:1.2; width:16px; text-align:center; color:var(--text-secondary); }
.sm-body   { flex:1; min-width:0; }
.sm-title  { font-weight:500; font-size:11.5px; color:var(--text-primary); line-height:1.3; }
.sm-sub    { font-size:10.5px; color:var(--text-tertiary); margin-top:2px; line-height:1.35; }
.sm-divider{ height:0.5px; background:var(--border-tertiary); margin:3px 0; }
.sm-custom { padding:8px 10px 10px; background:var(--bg-secondary); border-radius:var(--radius-sm); margin:2px; }
.sm-custom-row { display:flex; align-items:center; gap:8px; margin-bottom:7px; }
.sm-custom-row .lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-tertiary); font-weight:600; }
.sm-custom-input { width:62px; font-size:13px; font-weight:600; font-family:inherit; padding:3px 7px; border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); background:var(--bg-surface); color:var(--text-primary); text-align:center; }
.sm-custom-input:focus { outline:none; border-color:var(--amber); }
.sm-custom textarea { width:100%; padding:5px 7px; font-size:11px; font-family:inherit; resize:vertical; border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); background:var(--bg-surface); color:var(--text-primary); min-height:34px; box-sizing:border-box; margin-bottom:6px; }
.sm-custom textarea:focus { outline:none; border-color:var(--amber); }
.sm-custom-actions { display:flex; justify-content:flex-end; gap:5px; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   OVERRIDE FORM
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.override-form { display:none; margin-top:8px; padding:11px 13px; background:#FDF5F1; border:0.5px solid #E6BFB1; border-radius:var(--radius-md); }
.override-form.open { display:block; }
.of-head   { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:8px; }
.of-title  { font-size:11.5px; font-weight:600; color:var(--red); }
.of-desc   { font-size:11px; color:var(--text-secondary); line-height:1.5; margin-top:3px; }
.of-nums   { display:flex; gap:14px; margin:8px 0 10px; padding:8px 10px; background:var(--bg-surface); border-radius:var(--radius-sm); font-size:11px; border:0.5px solid var(--border-tertiary); }
.of-num    { display:flex; flex-direction:column; gap:2px; }
.of-num .lbl { font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-tertiary); font-weight:600; }
.of-arrow  { color:var(--text-tertiary); align-self:center; font-size:14px; }
.of-field  { margin-bottom:8px; }
.of-label  { display:block; font-size:10.5px; text-transform:uppercase; letter-spacing:.04em; font-weight:600; color:var(--text-tertiary); margin-bottom:4px; }
.of-label .req.need { color:var(--red); }
.override-form.is-proactive { background:#FEFAF1; border-color:#E5C892; }
.override-form.is-proactive .of-title { color:var(--amber); }
.reason-chips { display:flex; gap:5px; flex-wrap:wrap; margin-bottom:6px; }
.chip         { font-size:10.5px; padding:3px 9px; border-radius:12px; background:var(--bg-surface); border:0.5px solid var(--border-secondary); color:var(--text-secondary); cursor:pointer; }
.chip:hover   { background:var(--bg-secondary); }
.chip.on      { background:var(--amber-bg); color:var(--amber); border-color:#E5C892; }
.of-textarea  { width:100%; padding:6px 8px; font-size:11.5px; font-family:inherit; background:var(--bg-surface); border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); resize:vertical; min-height:52px; color:var(--text-primary); }
.of-textarea:focus { outline:none; border-color:var(--blue); }
.of-actions   { display:flex; justify-content:flex-end; gap:6px; margin-top:4px; }
.override-form[data-variant="compact"] .of-desc,.override-form[data-variant="compact"] .of-nums,.override-form[data-variant="compact"] .of-label,.override-form[data-variant="compact"] .of-textarea { display:none; }
.override-form[data-variant="compact"] { padding:8px 11px; }
.override-form[data-variant="compact"] .of-head  { margin-bottom:6px; }
.override-form[data-variant="compact"] .of-field { margin-bottom:6px; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   INITIALIZE PANEL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.init-panel { display:none; padding:12px 14px; background:var(--blue-bg); border:0.5px solid #B5D3ED; border-radius:var(--radius-md); margin:4px 14px 12px; font-size:11.5px; color:var(--blue-ink); }
.init-panel.open { display:block; }
.init-panel h4   { font-size:12px; font-weight:600; margin-bottom:4px; color:var(--text-primary); }
.init-steps { display:flex; gap:12px; margin:9px 0; font-size:11px; color:var(--text-secondary); flex-wrap:wrap; }
.init-step  { display:flex; align-items:center; gap:6px; }
.init-step .stp-num { width:18px; height:18px; border-radius:50%; background:var(--bg-surface); border:0.5px solid var(--border-secondary); font-size:10px; font-weight:600; color:var(--text-primary); display:inline-flex; align-items:center; justify-content:center; }
.init-actions { display:flex; gap:6px; align-items:center; margin-top:4px; }
.init-link    { font-size:10.5px; color:var(--text-secondary); cursor:pointer; text-decoration:underline; text-decoration-style:dotted; text-underline-offset:2px; margin-left:auto; }
.init-link:hover { color:var(--text-primary); }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   TWEAKS PANEL (teacher settings)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.tweaks { position:fixed; bottom:16px; right:16px; width:268px; z-index:100; background:var(--bg-surface); border:0.5px solid var(--border-secondary); border-radius:var(--radius-lg); box-shadow:0 10px 30px rgba(31,30,27,.1), 0 3px 8px rgba(31,30,27,.05); font-size:11.5px; display:none; }
.tweaks.open { display:block; }
.tw-hd   { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-bottom:0.5px solid var(--border-tertiary); }
.tw-hd .ttl { font-size:11.5px; font-weight:600; letter-spacing:-0.005em; }
.tw-close{ cursor:pointer; color:var(--text-tertiary); font-size:14px; line-height:1; padding:2px; border:none; background:none; }
.tw-close:hover { color:var(--text-primary); }
.tw-body { padding:6px 12px 12px; max-height:70vh; overflow:auto; }
.tw-group{ padding:8px 0; border-bottom:0.5px dashed var(--border-tertiary); }
.tw-group:last-child { border-bottom:none; }
.tw-label{ font-size:9.5px; text-transform:uppercase; letter-spacing:.05em; color:var(--text-tertiary); font-weight:600; margin-bottom:6px; }
.seg-ctl { display:flex; gap:0; border:0.5px solid var(--border-secondary); border-radius:var(--radius-sm); overflow:hidden; }
.seg-ctl button { flex:1; padding:5px 6px; font-size:10.5px; background:var(--bg-surface); border:none; border-left:0.5px solid var(--border-secondary); cursor:pointer; color:var(--text-secondary); font-family:inherit; }
.seg-ctl button:first-child { border-left:none; }
.seg-ctl button.on { background:var(--text-primary); color:#fff; }
.tw-row  { display:flex; justify-content:space-between; align-items:center; gap:8px; margin:5px 0; }
.tw-row .lbl { font-size:11px; color:var(--text-secondary); }
.tw-fab  { position:fixed; bottom:16px; right:16px; z-index:99; padding:8px 12px; font-size:11px; background:var(--text-primary); color:#fff; border:none; border-radius:20px; cursor:pointer; font-family:inherit; display:none; align-items:center; gap:6px; box-shadow:0 4px 14px rgba(31,30,27,.18); }
.tw-fab.show { display:inline-flex; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   OUTCOME STUDENT ROW (os-* components)
   Canvas / Marzano / Will Post 3-column layout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* Score legend */
.os-legend { display:flex; gap:18px; flex-wrap:wrap; align-items:center; padding:8px 12px; margin:0 0 10px; background:var(--bg-surface); border:0.5px solid var(--border-tertiary); border-radius:var(--radius-md); font-size:11px; color:var(--text-secondary); }
.os-leg    { display:flex; align-items:center; gap:5px; }
.os-leg-sw { width:10px; height:10px; border-radius:2px; flex-shrink:0; }

/* Outcome block wrapping the table */
.os-block { background:var(--bg-surface); border:0.5px solid var(--border-tertiary); border-radius:var(--radius-md); overflow:visible; }
.os-block table { width:100%; border-collapse:collapse; font-size:12px; }
.os-block thead th { font-size:9.5px; font-weight:600; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:.05em; padding:8px 10px; text-align:left; border-bottom:0.5px solid var(--border-tertiary); background:var(--bg-secondary); white-space:nowrap; }
.os-block thead th.c { text-align:center; }
.os-block td { padding:var(--cell-py) 10px; border-bottom:0.5px solid var(--border-tertiary); vertical-align:middle; overflow:visible; }
.os-block tbody tr:last-child td { border-bottom:none; }
.os-block td.c { text-align:center; }

/* Section divider rows */
tr.os-sdiv td { padding:5px 10px 4px; background:var(--bg-secondary); border-bottom:0.5px solid var(--border-tertiary); border-top:0.5px solid var(--border-tertiary); }
tr.os-sdiv .sdlabel { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:.07em; color:var(--text-tertiary); display:flex; align-items:center; gap:6px; }
tr.os-sdiv.needs td { background:#FBF6EB; border-color:#E8D5A0; }
tr.os-sdiv.needs .sdlabel { color:#7A5200; }

/* Rows needing a sync push */
tr.os-needs-row td:first-child { border-left:2.5px solid var(--s-dev); }
tr.os-needs-row td { background:#FFFDF7; }
.os-stu-name { font-weight:500; font-size:12px; }

/* Score pills (Canvas, Marzano) — clickable, fade when value ≠ Will Post */
.os-pill-btn { display:inline-block; position:relative; background:none; border:none; padding:0; cursor:pointer; font-family:inherit; border-radius:10px; transition:opacity .15s, box-shadow .12s; }
.os-pill-btn:focus-visible { outline:2px solid var(--blue); outline-offset:2px; border-radius:10px; }
.os-pill-btn.faded { opacity:0.55; }
.os-pill-btn:not(.faded):hover { box-shadow:0 0 0 1.5px var(--border-primary); }
.os-pill { font-size:11px; font-weight:600; padding:3px 10px; border-radius:8px; display:inline-block; min-width:46px; text-align:center; white-space:nowrap; line-height:1.4; }
.os-pill-tip { display:none; position:absolute; bottom:calc(100% + 6px); left:50%; transform:translateX(-50%); background:var(--text-primary); color:#fff; padding:4px 7px; border-radius:var(--radius-sm); font-size:10px; font-weight:400; white-space:nowrap; z-index:40; pointer-events:none; }
.os-pill-tip::after { content:''; position:absolute; top:100%; left:50%; transform:translateX(-50%); border:4px solid transparent; border-top-color:var(--text-primary); }
.os-pill-btn:not(.faded):hover .os-pill-tip { display:block; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   WILL POST COLUMN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
.os-wp-outer { display:inline-flex; align-items:center; justify-content:center; }
.os-wp-box-wrap { position:relative; display:inline-block; cursor:pointer; border-radius:8px; }
.os-wp-box { font-size:11px; font-weight:600; font-family:inherit; padding:3px 10px; min-width:46px; text-align:center; border-radius:8px; border:0.5px solid var(--border-secondary); background:var(--bg-surface); color:var(--text-primary); display:inline-block; line-height:1.4; transition:border-color .12s, background .12s; user-select:none; position:relative; }
.os-wp-box-wrap:hover .os-wp-box { border-color:var(--border-primary); background:var(--bg-secondary); }
.os-wp-box-wrap:focus-visible { outline:2px solid var(--blue); outline-offset:2px; border-radius:8px; }
.os-wp-box-wrap.differs .os-wp-box { border-color:var(--amber-border); background:#FFF8EE; }
.os-wp-box-wrap.differs .os-wp-box::before { content:''; position:absolute; left:0; top:3px; bottom:3px; width:2.5px; background:var(--amber-border); border-radius:2px 0 0 2px; }

/* Padlock badge — three states: none / unlocked (grey) / locked (amber) */
.os-wp-lock { position:absolute; bottom:-5px; right:-5px; width:15px; height:15px; border-radius:50%; background:var(--bg-surface); display:flex; align-items:center; justify-content:center; font-size:8px; line-height:1; cursor:pointer; z-index:2; transition:transform .08s, border-color .1s, background .1s; }
.os-wp-lock:focus-visible { outline:2px solid var(--blue); outline-offset:1px; }
.os-wp-lock.unlocked { border:1px solid var(--border-secondary); filter:grayscale(1); }
.os-wp-lock.unlocked:hover { border-color:var(--amber-border); background:#FDF3E3; transform:scale(1.15); filter:grayscale(0); }
.os-wp-lock.locked  { border:1px solid var(--amber-border); background:var(--bg-surface); }
.os-wp-lock.locked:hover { background:#FDF3E3; border-color:var(--amber); transform:scale(1.15); }
.os-lock-tip { display:none; position:absolute; bottom:calc(100% + 8px); right:-4px; background:var(--text-primary); color:#fff; padding:5px 8px; border-radius:var(--radius-sm); font-size:10px; font-weight:400; z-index:50; pointer-events:none; line-height:1.4; max-width:220px; white-space:normal; text-align:left; }
.os-lock-tip::after { content:''; position:absolute; top:100%; right:8px; border:4px solid transparent; border-top-color:var(--text-primary); }
.os-wp-lock:hover .os-lock-tip,.os-wp-lock:focus .os-lock-tip { display:block; }

/* Will Post inline edit input */
.os-wp-input { font-size:11px; font-weight:600; font-family:inherit; padding:3px 8px; min-width:52px; text-align:center; border-radius:8px; border:1.5px solid var(--blue); background:var(--bg-surface); color:var(--text-primary); outline:none; box-shadow:0 0 0 2.5px rgba(24,95,165,.12); line-height:1.4; display:inline-block; }
.os-wp-edit-hint { font-size:9.5px; color:var(--text-tertiary); margin-top:3px; white-space:nowrap; display:block; text-align:center; }

/* Will Post width clamp — keeps the inline edit input from spanning the cell */
.mo-shell .os-wp-box-wrap { width:3.5em; min-width:3.5em; max-width:3.5em; overflow:hidden; }
.mo-shell .os-wp-box      { width:100%; min-width:0; }
.mo-shell .os-wp-input    { width:3.5em; max-width:3.5em; min-width:0; box-sizing:border-box; text-align:center; font-size:0.923em; }

/* Post toolbar above student rows */
.os-post-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:7px 10px; background:var(--bg-surface); border-bottom:0.5px solid var(--border-tertiary); flex-wrap:wrap; }
.os-post-toolbar-left   { font-size:11px; color:var(--text-secondary); }
.os-post-toolbar-left b { color:var(--text-primary); font-weight:600; }

/* Per-row save button */
.os-save-row-btn { width:22px; height:22px; border-radius:5px; border:0.5px solid var(--border-secondary); background:var(--bg-surface); color:var(--text-tertiary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; transition:background .1s, border-color .1s, color .1s; flex-shrink:0; position:relative; }
.os-save-row-btn:hover { background:var(--blue-bg); border-color:var(--blue); color:var(--blue-ink); }
.os-save-row-btn:focus-visible { outline:2px solid var(--blue); outline-offset:2px; }
.os-save-row-btn:disabled { opacity:.35; cursor:not-allowed; }
.os-save-row-btn svg { width:11px; height:11px; display:block; }
.os-save-row-btn .sr-tip { display:none; position:absolute; bottom:calc(100% + 6px); right:0; background:var(--text-primary); color:#fff; padding:4px 7px; border-radius:var(--radius-sm); font-size:10px; font-weight:400; white-space:nowrap; pointer-events:none; z-index:30; }
.os-save-row-btn .sr-tip::after { content:''; position:absolute; top:100%; right:6px; border:4px solid transparent; border-top-color:var(--text-primary); }
.os-save-row-btn:hover .sr-tip { display:block; }
.os-posting { font-size:10px; color:var(--blue-ink); display:inline-flex; align-items:center; gap:4px; }

/* Override note / comment field */
.os-td-comment { min-width:160px; }
.os-comment-input { width:100%; font-size:11px; font-family:inherit; padding:3px 7px; border-radius:5px; border:0.5px solid var(--border-tertiary); background:transparent; color:var(--text-primary); outline:none; transition:border-color .12s, background .12s; }
.os-comment-input::placeholder { color:var(--text-tertiary); }
.os-comment-input:focus  { border-color:var(--border-secondary); background:var(--bg-surface); }
.os-comment-input:hover  { border-color:var(--border-secondary); }
.os-comment-input.prompted { border-color:#E0C07A; }
.os-comment-input.prompted::placeholder { color:#B08A3A; }

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   RESPONSIVE — card stack below 820px
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
@media (max-width: 820px) {
  .mo-shell { padding:16px 14px 80px; }
  .col-head { display:none; }
  .outcome-header {
    grid-template-columns: 22px 1fr auto 28px;
    gap:8px; row-gap:8px;
    grid-template-areas: "num name pill chev" "num spread spread spread" "num meta meta meta";
  }
  .outcome-header .onum       { grid-area:num; }
  .outcome-header .oname      { grid-area:name; }
  .outcome-header .pl-pill-wrap { grid-area:pill; }
  .outcome-header .spread-wrap{ grid-area:spread; }
  .outcome-header .meta-wrap  { grid-area:meta; display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; }
  .outcome-header .chevron    { grid-area:chev; }
  .outcome-header .below-n    { text-align:left; font-size:11px; }

  .stu-table,.stu-table thead,.stu-table tbody,.stu-table tr,.stu-table td,.stu-table th { display:block; }
  .stu-table thead      { display:none; }
  .stu-table            { border:none; background:transparent; }
  .stu-table tr         { background:var(--bg-surface); border:0.5px solid var(--border-tertiary); border-radius:var(--radius-md); margin-bottom:8px; padding:10px 12px; }
  .stu-table tr.hl-override { background:#FDF5F1; border-color:#E6BFB1; }
  .stu-table tr.row-pushing { background:#F3F8FD; border-color:#B5D3ED; }
  .stu-table td { border:none !important; padding:3px 0; display:flex; align-items:center; justify-content:space-between; gap:10px; }
  .stu-table td::before { content:attr(data-lbl); font-size:9.5px; text-transform:uppercase; letter-spacing:.04em; color:var(--text-tertiary); font-weight:600; flex-shrink:0; }
  .stu-table td[data-lbl=""]::before { display:none; }
  .stu-table td.td-name { border-bottom:0.5px solid var(--border-tertiary) !important; padding-bottom:8px; margin-bottom:6px; }
  .stu-table td.td-name::before { display:none; }
  .stu-table td.td-name .stu-name { font-size:13px; font-weight:600; }
  .stu-table td.td-dots { display:block; }
  .stu-table td.td-dots::before { display:block; margin-bottom:5px; }
  .stu-table td.td-action { margin-top:4px; }
  .stu-table td.td-action .act-btns { flex-wrap:wrap; }
  .dot-row { flex-wrap:wrap; }
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   LEGACY pl-* CLASSES (compatibility with existing view code)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* Score pill (data-level="1|2|3|4|NE") */
.pl-score-pill { display:inline-flex; align-items:center; justify-content:center; min-width:2.4rem; padding:0.1rem 0.45rem; border-radius:999px; font-size:0.78rem; font-weight:600; line-height:1.5; color:#fff; background:#888; white-space:nowrap; }
.pl-score-pill[data-level="4"]  { background:#1a7f4b; }
.pl-score-pill[data-level="3"]  { background:#2e8b57; }
.pl-score-pill[data-level="2"]  { background:#c47a00; }
.pl-score-pill[data-level="1"]  { background:#b93a2b; }
.pl-score-pill[data-level="NE"] { background:#6b7280; font-weight:400; font-style:italic; }

/* Sync status badge (state-machine status during sync ops) */
.pl-sync-badge { display:inline-flex; align-items:center; gap:0.35rem; font-size:0.75rem; padding:0.15rem 0.5rem; border-radius:4px; white-space:nowrap; }
.pl-sync-badge--pending { background:#fef3c7; color:#92400e; }
.pl-sync-badge--syncing { background:#dbeafe; color:#1e40af; }
.pl-sync-badge--done    { background:#d1fae5; color:#065f46; }
.pl-sync-badge--error   { background:#fee2e2; color:#991b1b; }
.pl-sync-badge--none    { background:#f3f4f6; color:#6b7280; }

/* Needs-sync count label */
.pl-needs-sync-count         { font-size:0.75rem; color:#6b7280; margin-left:0.4rem; }
.pl-needs-sync-count--nonzero{ color:#c47a00; font-weight:600; }

/* Inline progress bar */
.pl-progress-bar-wrap{ height:4px; background:#e5e7eb; border-radius:2px; overflow:hidden; margin-top:0.3rem; }
.pl-progress-bar     { height:100%; background:#2563eb; border-radius:2px; transition:width 0.2s ease; width:0%; }

/* Sync button */
.pl-sync-btn { font-size:0.75rem; padding:0.2rem 0.65rem; border:1px solid #2563eb; border-radius:4px; background:transparent; color:#2563eb; cursor:pointer; white-space:nowrap; transition:background 0.15s, color 0.15s; }
.pl-sync-btn:hover    { background:#2563eb; color:#fff; }
.pl-sync-btn:disabled { border-color:#9ca3af; color:#9ca3af; cursor:not-allowed; background:transparent; }

/* ── Density: comfortable ────────────────────────────────────────────── */
/* The default density tokens are tighter (compact). Comfortable adds     */
/* a bit more breathing room to rows and cells.                           */
.mo-shell[data-density="comfortable"] {
  --row-py:  7px;
  --cell-py: 7px;
  --gap:     9px;
}

/* ── Status emphasis: prosecutorial ─────────────────────────────────── */
/* "Urgent" emphasis: Will Post .differs box uses red instead of amber.  */
.mo-shell[data-emphasis="prosecutorial"] .os-wp-box-wrap.differs .os-wp-box {
  border-color: var(--red);
  background:   var(--red-bg);
}
.mo-shell[data-emphasis="prosecutorial"] .os-wp-box-wrap.differs .os-wp-box::before {
  background: var(--red);
}

/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   OUTCOME-DASHBOARD (od-*) LEGACY VIEW CLASSES
   Extracted from inline styles in masteryOutlookView.js
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */

/* --- buildShell --- */
.mo-shell .od-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:8px; }
.mo-shell .od-title { font-size:1.1rem; font-weight:700; color:#333; }
.mo-shell #od-subtitle { font-size:0.8rem; color:#888; margin-top:2px; }
.mo-shell .od-header-actions { display:flex; align-items:center; gap:10px; }
.mo-shell #od-last-updated { font-size:0.8rem; color:#888; }
.mo-shell .od-btn-exceptions { font-family:var(--mo-legacy-font); font-size:0.8rem; padding:6px 12px; border-radius:6px; border:1px solid #ccc; background:transparent; color:#666; cursor:pointer; font-weight:500; }
.mo-shell .od-btn-refresh { font-family:var(--mo-legacy-font); font-size:0.85rem; padding:7px 16px; border-radius:6px; border:1px solid #0374B5; background:#0374B5; color:#fff; cursor:pointer; font-weight:600; min-width:120px; }
.mo-shell .od-refresh-banner { display:none; margin-bottom:0.75rem; padding:10px 16px; border-radius:8px; background:#EBF5FB; border:0.5px solid #AED6F1; align-items:center; justify-content:space-between; gap:12px; }
.mo-shell .od-refresh-banner-text { font-family:var(--mo-legacy-font); font-size:13px; color:#1A5276; }
.mo-shell .od-btn-banner-refresh { font-family:var(--mo-legacy-font); font-size:12px; font-weight:600; padding:5px 14px; border-radius:6px; border:1px solid #2E86C1; background:#2E86C1; color:#fff; cursor:pointer; }
.mo-shell .od-exceptions-panel { display:none; margin-bottom:1rem; border:0.5px solid #e0e0e0; border-radius:8px; background:#fff; overflow:hidden; }
.mo-shell .od-metrics { display:grid; grid-template-columns:repeat(4, minmax(0,1fr)); gap:8px; margin-bottom:1rem; }
.mo-shell .od-controls-row { display:flex; justify-content:space-between; align-items:center; gap:16px; margin-bottom:1rem; flex-wrap:wrap; }
.mo-shell .od-threshold-control,
.mo-shell .od-color-scheme-control { display:flex; align-items:center; gap:10px; padding:10px 12px; background:#f9f9f9; border-radius:8px; }
.mo-shell .od-control-label { font-size:0.9rem; color:#666; font-weight:500; }
.mo-shell .od-threshold-slider { width:150px; cursor:pointer; }
.mo-shell .od-threshold-value { font-size:0.95rem; font-weight:600; color:#333; min-width:32px; text-align:center; }
.mo-shell .od-color-toggle { display:flex; gap:4px; border:1px solid #ddd; border-radius:6px; overflow:hidden; }
.mo-shell .od-color-btn { font-family:var(--mo-legacy-font); padding:6px 12px; border:none; cursor:pointer; font-size:0.85rem; transition:all 0.2s; background:#fff; color:#333; font-weight:500; }
.mo-shell .od-color-btn.active { background:#0374B5; color:#fff; font-weight:600; }
.mo-shell .od-body { display:grid; grid-template-columns:1fr; gap:12px; }
.mo-shell .od-tab-bar { display:flex; gap:4px; border-bottom:2px solid #e0e0e0; margin-bottom:8px; }
.mo-shell .od-tab { font-family:var(--mo-legacy-font); font-size:13px; padding:8px 16px; cursor:pointer; border:none; background:transparent; color:#666; border-bottom:2px solid transparent; font-weight:400; }
.mo-shell .od-tab.active { background:#fff; color:#185FA5; border-bottom:2px solid #185FA5; font-weight:500; }
.mo-shell .od-col-headers { display:grid; grid-template-columns:20px 1fr 80px 100px 80px 24px; gap:8px; padding:4px 12px 6px; border-bottom:1px solid #e0e0e0; margin-bottom:4px; }
.mo-shell .od-status-bar { font-size:0.8rem; color:#888; margin-top:12px; min-height:20px; }

/* --- colHeader --- */
.mo-shell .od-col-header { font-size:12px; font-weight:600; color:#999; text-transform:uppercase; letter-spacing:.04em; }
.mo-shell .od-col-header.center { text-align:center; }

/* --- renderDefaultOutcomeRows --- */
.mo-shell .od-default-row { display:grid; grid-template-columns:20px 1fr 80px 100px 80px 24px; gap:8px; align-items:center; padding:9px 12px; border:0.5px solid #e0e0e0; border-radius:8px; margin-bottom:6px; background:#fff; }
.mo-shell .od-default-row .od-num { font-size:13px; color:#999; font-weight:500; }
.mo-shell .od-default-row .od-name { font-size:15px; color:#333; font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mo-shell .od-default-row .od-center { text-align:center; }
.mo-shell .od-default-row .od-below { text-align:center; font-size:13px; color:#bbb; }

/* --- buildEmptyPrompt / buildRefreshPrompt --- */
.mo-shell .od-empty-prompt { text-align:center; padding:2rem 1rem; color:#888; }
.mo-shell .od-empty-prompt .ep-icon { font-size:2rem; margin-bottom:0.5rem; }
.mo-shell .od-empty-prompt .ep-title { font-size:0.95rem; font-weight:600; color:#555; margin-bottom:0.4rem; }
.mo-shell .od-empty-prompt .ep-body { font-size:0.85rem; line-height:1.6; max-width:340px; margin:0 auto; }
.mo-shell .od-refresh-prompt { margin-top:10px; padding:10px 14px; background:#f0f7ff; border:1px solid #b8d6f5; border-radius:8px; font-size:0.82rem; color:#0374B5; line-height:1.6; }

/* --- neChip / emptySpread --- */
.mo-shell .od-ne-chip { font-family:var(--mo-legacy-font); font-size:12px; font-weight:600; padding:3px 8px; border-radius:8px; background:#f0f0f0; color:#999; }
.mo-shell .od-empty-spread { height:16px; border-radius:4px; background:#f0f0f0; width:100%; }

/* --- buildOutcomeDetailPanel --- */
.mo-shell .od-detail-panel {
  border-top:none; border-bottom-left-radius:8px; border-bottom-right-radius:8px;
  background:#fff; overflow:hidden;
  box-shadow:
    0 0 0 1.5px var(--blue),
    0 0.615em 2.154em rgba(31, 30, 27, 0.10);
}
.mo-shell .od-detail-tabs { display:flex; gap:0; border-bottom:0.5px solid #e0e0e0; background:#fafafa; }
.mo-shell .od-detail-tab { font-family:var(--mo-legacy-font); font-size:13px; padding:8px 16px; cursor:pointer; border:none; }
.mo-shell .od-detail-content { padding:12px; overflow:visible; }

/* --- renderMetricCards --- */
.mo-shell .od-metric-card { background:#f5f5f3; border-radius:8px; padding:10px 12px; }
.mo-shell .od-metric-card .od-mc-label { font-size:13px; color:#666; margin-bottom:3px; background:transparent; padding:0; }
.mo-shell .od-metric-card .od-mc-value { font-size:24px; font-weight:700; background:transparent; padding:0; }
.mo-shell .od-metric-card .od-mc-sub   { font-size:12px; color:#999; margin-top:1px; background:transparent; padding:0; }

/* --- renderDefaultSidebar --- */
.mo-shell .od-sidebar-card { background:#fff; border:0.5px solid #e0e0e0; border-radius:12px; padding:12px; margin-bottom:10px; }
.mo-shell .od-sidebar-card:last-child { margin-bottom:0; }
.mo-shell .od-sidebar-title { font-size:15px; font-weight:700; color:#333; margin-bottom:8px; }
.mo-shell .od-sidebar-empty { font-size:13px; color:#aaa; padding:8px 0; }

/* --- wireTweaksPanel --- */
.mo-shell .od-tweaks-card { background:#fff; border:0.5px solid #e0e0e0; border-radius:12px; padding:12px; margin-top:10px; }
.mo-shell .od-tweaks-title { font-family:var(--mo-legacy-font); font-size:14px; font-weight:700; color:#333; margin-bottom:10px; }
.mo-shell .od-tweaks-toggle-label { display:flex; align-items:center; gap:8px; cursor:pointer; }
.mo-shell .od-tweaks-toggle-input { width:15px; height:15px; cursor:pointer; }
.mo-shell .od-tweaks-toggle-text { font-family:var(--mo-legacy-font); font-size:13px; color:#444; }
.mo-shell .od-tweaks-help { font-family:var(--mo-legacy-font); font-size:11px; color:#aaa; margin-top:5px; margin-left:23px; }

/* --- buildExceptionsTable / buildCrossOutcomeExceptionsView --- */
.mo-shell .od-ex-empty { font-family:var(--mo-legacy-font); font-size:13px; color:#888; padding:12px 0; }
.mo-shell .od-ex-empty.padded { padding:16px; }
.mo-shell .od-ex-table { font-family:var(--mo-legacy-font); width:100%; border-collapse:collapse; font-size:12px; }
.mo-shell .od-ex-table th { font-weight:600; color:#888; font-size:11px; text-transform:uppercase; letter-spacing:.04em; padding:6px 8px; text-align:left; border-bottom:0.5px solid #e0e0e0; background:#fafafa; }
.mo-shell .od-ex-table th.od-center { text-align:center; }
.mo-shell .od-ex-table td { font-size:12px; padding:6px 8px; border-bottom:0.5px solid #f0f0f0; vertical-align:middle; }
.mo-shell .od-ex-table td.od-center { text-align:center; }
.mo-shell .od-ex-table td.od-name { font-weight:500; }
.mo-shell .od-ex-table td.od-note { color:#666; }
.mo-shell .od-ex-table td.od-date { color:#999; }
.mo-shell .od-ex-table.wide th,
.mo-shell .od-ex-table.wide td { padding:6px 10px; }
.mo-shell .od-ex-table .od-note-clip { color:#666; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.mo-shell .od-ex-table .od-nowrap { white-space:nowrap; }
.mo-shell .od-ex-pill { font-size:10.5px; font-weight:600; padding:1px 6px; border-radius:8px; display:inline-block; }
.mo-shell .od-ex-pill.override { background:#FCEBEB; color:#791F1F; }
.mo-shell .od-ex-pill.locked   { background:#FAEEDA; color:#633806; }
.mo-shell .od-ex-pill.ignored  { background:#F3F2EE; color:#55534D; }

/* --- buildStudentTable --- */
.mo-shell .od-stu-empty { font-family:var(--mo-legacy-font); font-size:13px; color:#666; padding:12px 0; }
.mo-shell .od-stu-table { font-family:var(--mo-legacy-font); width:100%; border-collapse:collapse; font-size:13px; }
.mo-shell .od-stu-table thead tr { border-bottom:0.5px solid #e0e0e0; }
.mo-shell .od-stu-table th { font-weight:500; color:#666; padding:6px 8px; font-size:12px; text-align:left; }
.mo-shell .od-stu-table th.od-center { text-align:center; }
.mo-shell .od-stu-table tr.od-flagged { background:rgba(252,235,235,0.3); }
.mo-shell .od-stu-table td { padding:6px 8px; }
.mo-shell .od-stu-table td.od-name      { font-size:13px; }
.mo-shell .od-stu-table td.od-center    { text-align:center; font-size:13px; }
.mo-shell .od-stu-table td.od-pill-cell { text-align:center; }
.mo-shell .od-stu-table td.od-history   { font-size:11px; color:#999; letter-spacing:1px; }
.mo-shell .od-stu-table td.od-sync-cell { text-align:center; vertical-align:middle; }
.mo-shell .od-stu-link { color:#333; text-decoration:none; }
.mo-shell .od-stu-pl-pill { padding:2px 8px; border-radius:6px; font-size:12px; font-weight:500; }
.mo-shell .od-sync-actions { display:flex; flex-direction:column; align-items:center; gap:2px; }
.mo-shell .od-sync-action-btn { margin-top:3px; }
.mo-shell .od-sync-action-btn.compact { font-size:10px; padding:2px 6px; }
.mo-shell .od-trend { font-size:13px; }
.mo-shell .od-score-history-attempt { opacity:0.6; }
.mo-shell .od-stu-link:hover { color:#0374B5; text-decoration:underline; }

/* --- wireExceptionsPanel (renderPanel) --- */
.mo-shell .od-ex-panel-header { padding:10px 14px 8px; border-bottom:0.5px solid #e0e0e0; display:flex; align-items:center; justify-content:space-between; gap:12px; background:#fafafa; flex-wrap:wrap; }
.mo-shell .od-ex-panel-title { font-family:var(--mo-legacy-font); font-size:12px; font-weight:600; color:#333; }
.mo-shell .od-ex-panel-actions { display:flex; gap:5px; }
.mo-shell .od-ex-chip { font-family:var(--mo-legacy-font); font-size:11px; padding:3px 10px; border-radius:10px; cursor:pointer; font-weight:500; border:0.5px solid #ccc; background:#fff; color:#888; }
.mo-shell .od-ex-chip.active.overrides { border-color:#791F1F; background:#FCEBEB; color:#791F1F; }
.mo-shell .od-ex-chip.active.ignored   { border-color:#55534D; background:#F3F2EE; color:#55534D; }
.mo-shell .od-ex-panel-body { padding:0; overflow-x:auto; }

/* --- renderLoadedOutcomeRows --- */
.mo-shell .od-no-current-score { padding:12px; font-size:13px; color:#888; font-style:italic; margin-bottom:6px; }
.mo-shell .od-outcome-container { margin-bottom:6px; }
.mo-shell .od-outcome-row { display:grid; grid-template-columns:20px 1fr 80px 100px 80px 24px; gap:8px; align-items:center; padding:9px 12px; border:0.5px solid #e0e0e0; border-radius:8px; background:#fff; cursor:pointer; }
.mo-shell .od-outcome-row.expanded {
  border-bottom-left-radius:0; border-bottom-right-radius:0;
  box-shadow:
    0 0 0 1.5px var(--blue),
    0 0.615em 2.154em rgba(31, 30, 27, 0.10),
    0 0.154em 0.46em  rgba(31, 30, 27, 0.05);
}
.mo-shell .od-outcome-row.expanded .row-title { color:var(--blue); font-weight:600; }
.mo-shell .od-outcome-row:hover { background:#f5f5f3; }
.mo-shell .od-outcome-row .row-num { font-size:13px; color:#999; }
.mo-shell .od-outcome-row .row-title { font-size:15px; font-weight:500; color:#333; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mo-shell .od-outcome-row .row-cell-center { text-align:center; }
.mo-shell .od-outcome-row .row-below { text-align:center; font-size:14px; color:#666; }
.mo-shell .od-outcome-row .row-below.flag { color:#A32D2D; }
.mo-shell .od-outcome-row .row-chevron { font-size:14px; color:#999; text-align:center; }
.mo-shell .od-outcome-divider { height:1px; background:#e0e0e0; margin:12px 0; }

/* --- buildSyncSummaryLine --- */
.mo-shell .od-sync-summary { font-size:11px; margin-top:2px; color:#888; }
.mo-shell .od-sync-summary.synced { color:#276749; }
.mo-shell .od-sync-summary .needs { color:#B7791F; }
.mo-shell .od-sync-summary .override { color:#C05621; }
.mo-shell .od-sync-summary .sep { color:#ccc; }

/* --- renderHeatmapView empty state --- */
.mo-shell .od-heatmap-empty { text-align:center; padding:2rem 1rem; color:#888; }
.mo-shell .od-heatmap-empty .he-icon { font-size:2rem; margin-bottom:0.5rem; }
.mo-shell .od-heatmap-empty .he-title { font-size:0.95rem; font-weight:600; color:#555; margin-bottom:0.4rem; }
.mo-shell .od-heatmap-empty .he-body { font-size:0.85rem; line-height:1.6; max-width:340px; margin:0 auto; }

/* --- buildShell container root --- */
.mo-shell { font-family:var(--mo-legacy-font); max-width:1375px; margin:0 auto; padding:1rem; font-size:125%; }

/* --- plAvgChip --- */
.mo-shell .od-pl-chip { font-family:var(--mo-legacy-font); font-size:13px; font-weight:600; padding:3px 10px; border-radius:8px; }

/* --- spreadBar --- */
.mo-shell .od-spread-bar { display:flex; height:16px; border-radius:4px; overflow:hidden; gap:1px; }
`;
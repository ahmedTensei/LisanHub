/**
 * Styles of the player document. Inlined once with a CSP hash; the runtime
 * never sets inline styles (no `unsafe-inline`), only these classes.
 */
export const PLAYER_STYLES = `
:root { color-scheme: light dark; --ink: #1f2a24; --muted: #5d6b63; --line: #d5ded9; --paper: #ffffff; --soft: #eef5f0; --accent: #1f7a4d; --ok: #1f7a4d; --bad: #b4372c; --radius: 12px; }
@media (prefers-color-scheme: dark) { :root { --ink: #e6ebe8; --muted: #a3ada7; --line: #35403a; --paper: #151a17; --soft: #1e2621; --accent: #58c18a; --ok: #58c18a; --bad: #f08a7e; } }
* { box-sizing: border-box; }
html, body { margin: 0; background: transparent; color: var(--ink); font: 16px/1.6 "IBM Plex Sans Arabic", system-ui, -apple-system, "Segoe UI", sans-serif; }
body { padding: 4px; }
.player { display: flex; flex-direction: column; gap: 14px; }
.field { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; font-weight: 600; color: var(--muted); }
.text { margin: 0; white-space: pre-wrap; }
.list { margin: 0; padding-inline-start: 1.4em; }
.picture { max-width: 100%; max-height: 320px; border-radius: var(--radius); border: 1px solid var(--line); }
.options { display: flex; flex-direction: column; gap: 6px; margin: 0; padding: 0; list-style: none; }
.option { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--paper); cursor: pointer; }
.option:has(:checked) { border-color: var(--accent); background: var(--soft); }
.option input { margin: 0; accent-color: var(--accent); }
.blank { display: inline-block; min-width: 6ch; margin: 0 4px; padding: 4px 8px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); font: inherit; }
.pairs { display: grid; gap: 8px; margin: 0; padding: 0; list-style: none; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: center; }
.pair select, .select { width: 100%; padding: 8px 10px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); font: inherit; }
.bank, .answer { display: flex; flex-wrap: wrap; gap: 8px; min-height: 44px; padding: 8px; border: 1px dashed var(--line); border-radius: var(--radius); }
.answer { border-style: solid; background: var(--soft); }
.token { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: var(--paper); color: var(--ink); font: inherit; cursor: pointer; }
.token:hover { border-color: var(--accent); }
.hint { margin: 0; font-size: 13px; color: var(--muted); }
.actions { display: flex; flex-wrap: wrap; gap: 8px; }
.button { padding: 10px 18px; border: 1px solid var(--accent); border-radius: 999px; background: var(--accent); color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
.button.secondary { background: transparent; color: var(--accent); }
.button:disabled { opacity: .5; cursor: default; }
.ratings { display: flex; flex-wrap: wrap; gap: 8px; }
.reveal[hidden] { display: none; }
.reveal { padding: 12px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--soft); }
.feedback { padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--line); }
.feedback.ok { border-color: var(--ok); color: var(--ok); }
.feedback.bad { border-color: var(--bad); color: var(--bad); }
.feedback .expected { display: block; margin-top: 6px; color: var(--ink); white-space: pre-wrap; }
.error { padding: 12px 14px; border-radius: var(--radius); border: 1px solid var(--bad); color: var(--bad); }
[hidden] { display: none !important; }
`;

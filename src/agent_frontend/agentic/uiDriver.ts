// UI-driver: the agent's "hands". Given a directive (route(s) + fields) it
// navigates to the real page(s) and FILLS the existing form for the user — a
// live, visible preview — then STOPS. Never submits (prepare-only); the user
// reviews + publishes. Supports multi-step wizards by deep-linking each step.
//
// Built for the real app: ~45% of fillable fields are shadcn/Radix components
// (Select triggers, Switches, RadioGroups, Checkboxes) with no id/name — only an
// adjacent label. So resolution is label/text-proximity aware and filling is
// role-aware (role=switch/combobox/radio/checkbox + portal-rendered options).
import { getById, queryButtonByText, clickIfEnabled } from "./dom";
import { FLOW_REGISTRY, type FlowField, type SelectorKind, type FieldType } from "./flowRegistry";

export interface FillField {
  selector: string;
  selectorKind?: SelectorKind;
  value: string;
  type?: FieldType;
  optionText?: string;
  label?: string;
}
/** A probe = a control known to exist once a given step has rendered. */
export interface StepProbe { selector: string; selectorKind: SelectorKind; }
export interface DirectiveStep {
  route: string;
  fields: FillField[];
  // Sequencer-only (interactive === "sequential"): the in-page button that
  // advances to the next step, and a control we poll for to confirm the next
  // step rendered. `terminal` marks the final/publish step — the sequencer
  // STOPS before it and never clicks its button.
  advanceButtonText?: string | string[];
  nextStepProbe?: StepProbe;
  terminal?: boolean;
  // AI-assist for steps whose hard fields can't be filled by typing (e.g. the
  // /audience Meta autocompletes). After filling text fields and BEFORE the
  // normal advance: click `generate`, wait for `apply` to appear, click it, wait
  // for it to finish (it fills Location/Interests/Age/Gender), then advance.
  aiAssist?: { generate: string; apply: string };
  // After filling (and aiAssist), click one more button and wait for its result
  // before advancing — e.g. /creative "Generate with AI" (waitForImage) so the ad
  // has a creative, or /budget "Save to Meta & Select" (waitForProbe) for lead
  // forms. Skipped gracefully if the button isn't present (e.g. non-lead campaign).
  postFill?: { click: string; waitForImage?: boolean; waitForProbe?: StepProbe; settleMs?: number };
  // When true, the sequencer navigates to this step's `route` before filling
  // (for a step on a separate route the prior advance button can't reach, e.g.
  // the rich creative editor /start2). Campaign state persists across the nav.
  navigate?: boolean;
}
export interface UIDirective {
  route: string;
  fields: FillField[];
  steps?: DirectiveStep[];
  note?: string;
  flowKey?: string;
  // "sequential" → drive the wizard in-place (fill → click advance → wait →
  // repeat) instead of deep-linking each step. driveFill navigates ONCE to
  // `route`, then walks `steps` clicking each step's advanceButtonText.
  interactive?: "sequential";
  // The form is behind a modal: after navigating, click this button (by text)
  // and wait for the first field before filling.
  openTrigger?: string;
  // Controls that reveal dependent fields only after being clicked (e.g. "Add
  // Button"): clicked BEFORE filling, `count` times each.
  preClicks?: { text: string; count?: number }[];
  // A button clicked AFTER filling (e.g. "Generate Flow"/"AI Generate") to kick
  // off generation, for non-sequential/modal flows.
  postFill?: { click: string; waitForImage?: boolean; settleMs?: number };
  // AI-assist for a non-sequential page whose hard fields can't be typed (e.g. the
  // standalone /create/audience Meta autocompletes + age slider): after filling the
  // typeable fields, click `generate`, wait for `apply`, click it, wait for it to
  // finish — which populates Location/Interests/Age/Gender. Same as the campaign
  // audience step, but for a single-page flow.
  aiAssist?: { generate: string; apply: string };
  // Navigate-only handoff: some flows can't be prepared by filling because the
  // form only exists after the USER picks an entity (e.g. a specific CRM lead to
  // edit, a deal to change stage) or it's a visual canvas editor (ReactFlow node
  // builder). driveFill navigates to the page and surfaces this guidance message
  // instead of silently failing to fill fields that aren't on screen yet.
  handoff?: string;
}
export type DriveStatus = "navigating" | "filling" | "filled" | "field-missing" | "error";
export interface DriveEvent { status: DriveStatus; field?: string; message?: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lc = (s: string) => (s || "").trim().toLowerCase();
const truthy = (v: string) => !["false", "0", "no", "off", "", "none"].includes(lc(String(v)));

/** Set a value on a controlled input/textarea so React's onChange actually fires.
 *  React tracks the previous value via the native value setter; assigning el.value
 *  directly is ignored. We must call the prototype setter, then dispatch bubbling
 *  input/change so React updates state, and a blur so any onBlur validators run. */
function reactSet(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  if (setter) setter.call(el, value);
  else (el as any).value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

/** A route we can safely deep-link to: an absolute path with no spaces and no
 *  unfilled `:param` segment. Anything else means "fill on the current page". */
function isNavigable(route?: string): boolean {
  return !!route && route.startsWith("/") && !route.includes(" ") && !route.includes(":");
}

const CONTROL_SEL =
  '[role="switch"],[role="combobox"],[role="checkbox"],[role="radio"],[role="slider"],select,input,textarea,button[data-state]';

/** Find the control for a field. For label/placeholder kinds, falls back to
 *  text-proximity (the label is often a heading near a Radix control, not a
 *  <label for>). For radio/checkbox/toggle the label is often the option text
 *  itself, so a clickable control containing that text wins. */
function resolveEl(f: FillField): HTMLElement | null {
  const k = f.selectorKind || "id";
  const s = f.selector;
  if (k === "id") return getById(s);
  if (k === "name") return q(`[name="${cssEsc(s)}"]`);
  if (k === "testid") return q(`[data-testid="${cssEsc(s)}"]`);
  if (k === "css") return q(s);
  if (k === "placeholder") {
    const direct = q(`[placeholder="${cssEsc(s)}"]`);
    if (direct) return direct;
    return byText(s, f.type);
  }
  // label
  const direct = byLabelFor(s);
  if (direct) return direct;
  return byText(s, f.type);
}

function q(sel: string): HTMLElement | null { try { return document.querySelector<HTMLElement>(sel); } catch { return null; } }
function cssEsc(s: string): string { return (window as any).CSS?.escape ? CSS.escape(s) : s.replace(/"/g, '\\"'); }

function byLabelFor(text: string): HTMLElement | null {
  const want = lc(text);
  for (const l of Array.from(document.querySelectorAll("label"))) {
    if (!lc(l.textContent || "").includes(want)) continue;
    const forId = l.getAttribute("for");
    if (forId) { const e = getById(forId); if (e) return e; }
    const c = l.querySelector<HTMLElement>(CONTROL_SEL);
    if (c) return c;
  }
  return null;
}

/** Find a custom clickable "card" option by its title text. The objective cards
 *  (/create) and placement cards are shadcn <Card> divs (no role) with an
 *  onClick + a `cursor-pointer` class and the option title in a child heading.
 *  We locate the heading/span whose text matches, then climb to the nearest
 *  ancestor that looks clickable (cursor-pointer / role / clickable tag). */
function clickableCardByText(want: string): HTMLElement | null {
  const isCardish = (el: HTMLElement): boolean =>
    /cursor-pointer/.test(el.className || "") ||
    !!el.getAttribute("role") ||
    ["button", "a", "li"].includes(el.tagName.toLowerCase());
  const heads = Array.from(document.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,span,p,div"));
  const hit =
    heads.find((e) => lc(e.textContent || "") === want) ||
    heads.find((e) => lc(e.textContent || "").includes(want) && (e.textContent || "").length < want.length + 30);
  if (!hit) return null;
  let node: HTMLElement | null = hit;
  for (let i = 0; i < 6 && node; i++) {
    if (isCardish(node)) return node;
    node = node.parentElement;
  }
  return null;
}

function byText(text: string, type?: FieldType): HTMLElement | null {
  const want = lc(text);
  // radio/checkbox/toggle: the label usually IS the option/card text → click it
  if (type === "radio" || type === "checkbox" || type === "toggle") {
    const ctrls = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="radio"],[role="checkbox"],[role="switch"],button,[data-state],label',
    ));
    const exact = ctrls.find((c) => lc(c.textContent || "") === want);
    if (exact) return exact;
    const inc = ctrls.find((c) => lc(c.textContent || "").includes(want) && (c.textContent || "").length < want.length + 40);
    if (inc) return inc;
    // No native control matched. Some option pickers are custom clickable CARDS
    // (a div with onClick + `cursor-pointer`, e.g. the /create objective cards
    // and placement cards) whose option text lives in a child <h3>/<span>. Match
    // a clickable card by its title text and return the card itself to click.
    const card = clickableCardByText(want);
    if (card) return card;
  }
  // otherwise: find the text node (heading/label/span) and the nearest control in its
  // container. CRITICAL: many labels here have no `for` and no nested control, so we
  // climb to an ancestor and look inside — but that ancestor often holds SEVERAL
  // controls (e.g. a stray "mark complete" checkbox before the real Priority <select>
  // / Due-Date <input type=date>). Picking the first control in DOM order grabs the
  // wrong one. So PREFER a control whose tag/type matches the field type, and only
  // fall back to "first control found" when nothing type-compatible is nearby.
  const fits = (el: HTMLElement): boolean => {
    const tag = el.tagName.toLowerCase();
    const t = lc(el.getAttribute("type") || "");
    const role = el.getAttribute("role");
    if (type === "select" || type === "combobox") return tag === "select" || role === "combobox";
    if (type === "date") return tag === "input" && ["date", "datetime-local", "month", "time", "week"].includes(t);
    if (type === "textarea") return tag === "textarea";
    // input / default: a typeable field — never a checkbox/radio/button/range
    return tag === "textarea" || (tag === "input" && !["checkbox", "radio", "button", "submit", "range"].includes(t));
  };
  const texts = Array.from(document.querySelectorAll<HTMLElement>("label,legend,h1,h2,h3,h4,h5,p,span,div"));
  const hit =
    texts.find((e) => lc(e.textContent || "") === want) ||
    texts.find((e) => lc(e.textContent || "").includes(want) && (e.textContent || "").length < want.length + 60);
  if (hit) {
    // pass 1: nearest ancestor with a TYPE-COMPATIBLE control.
    let node: HTMLElement | null = hit;
    for (let i = 0; i < 5 && node; i++) {
      const typed = Array.from(node.querySelectorAll<HTMLElement>(CONTROL_SEL)).find((c) => c !== hit && fits(c));
      if (typed) return typed;
      node = node.parentElement;
    }
    // pass 2: fall back to the first control of any kind (legacy behavior).
    node = hit;
    for (let i = 0; i < 5 && node; i++) {
      const c = node.querySelector<HTMLElement>(CONTROL_SEL);
      if (c && c !== hit) return c;
      node = node.parentElement;
    }
  }
  return null;
}

async function waitFor(pred: () => boolean, timeoutMs = 9000, stepMs = 150): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) { if (pred()) return true; await sleep(stepMs); }
  return pred();
}

/** Wait for a data-fetch page to SETTLE before driving it: poll until common
 *  loading indicators (spinners / aria-busy / skeletons) are gone, then a brief
 *  stable pause. Prevents the race where a late data load re-renders the page and
 *  wipes a modal/fields the drive already opened/filled. */
async function waitForPageSettle(maxMs = 22000): Promise<void> {
  const SPINNER = '[class*="animate-spin"],[class*="spinner"],[class*="skeleton"],[role="progressbar"],[aria-busy="true"]';
  // Auth/bootstrap interstitials (e.g. CRMLayout's "Verifying session…") gate the
  // whole page for ~15-20s on a COLD load and can mount a beat AFTER navigate — so
  // also treat their text as not-settled and give them a generous cap, else the
  // open-trigger/fill clock starts before the form exists and the drive misses.
  const AUTH = /verifying session|verifying your session|authenticating|loading your workspace|checking access/i;
  await sleep(400); // let the route mount + any auth gate / fetch appear before we test
  await waitFor(() => {
    if (AUTH.test(document.body.innerText || "")) return false;
    return document.querySelectorAll(SPINNER).length === 0;
  }, maxMs, 250);
  await sleep(700); // brief stable pause after spinners clear
}

function isOn(el: Element): boolean {
  return el.getAttribute("aria-checked") === "true" || el.getAttribute("data-state") === "checked";
}

/** Best-effort "is this toggle-button currently selected?" for custom button
 *  toggles that lack aria/data-state (e.g. the social-post platform chips, which
 *  go gradient + white text when selected). Falls back to aria-pressed. */
function looksSelected(el: Element): boolean {
  if (el.getAttribute("aria-pressed") === "true") return true;
  if (isOn(el)) return true;
  const cls = (el as HTMLElement).className || "";
  return /(\bbg-gradient\b|border-transparent|text-white|\bring-2\b|\bbg-indigo|\bbg-primary)/.test(
    typeof cls === "string" ? cls : "",
  );
}

function pickOption(value: string, optionText?: string): HTMLElement | null {
  const want = lc(optionText || value);
  const opts = Array.from(document.querySelectorAll<HTMLElement>(
    '[role="option"],[role="menuitem"],[role="menuitemradio"],[data-radix-collection-item]',
  ));
  return (
    opts.find((o) => o.getAttribute("data-value") === value || (o as HTMLOptionElement).value === value) ||
    opts.find((o) => lc(o.textContent || "") === want) ||
    opts.find((o) => lc(o.textContent || "").includes(want) || want.includes(lc(o.textContent || ""))) ||
    null
  );
}

/** Fill one resolved control, role-aware. Async because Radix Selects open a
 *  portal we must wait for before clicking the option. Returns filled?. */
async function fillOne(f: FillField): Promise<boolean> {
  const el = resolveEl(f);
  if (!el) return false;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  const role = el.getAttribute("role");
  const tag = el.tagName.toLowerCase();
  const type = f.type;

  // toggle / switch
  if (role === "switch" || type === "toggle") {
    if (isOn(el) !== truthy(f.value)) clickIfEnabled(el);
    return true;
  }
  // shadcn checkbox button or native checkbox
  if (role === "checkbox" || (tag === "input" && (el as HTMLInputElement).type === "checkbox") || type === "checkbox") {
    const isNativeCb = tag === "input" && (el as HTMLInputElement).type === "checkbox";
    // Some "checkbox" options are plain toggle buttons with no checkbox semantics
    // (e.g. social-post platform chips). Detect their selected state heuristically
    // so we don't accidentally toggle an already-selected default (facebook) OFF.
    const on = role === "checkbox" ? isOn(el) : isNativeCb ? (el as HTMLInputElement).checked : looksSelected(el);
    if (on !== truthy(f.value)) clickIfEnabled(el);
    return true;
  }
  // radio: pick the option matching the VALUE (id-suffix / value attr / text) so
  // a group like gender (gender-all/male/female) selects the right one, not just
  // whatever the field selector happened to resolve to. Fall back to el.
  if (role === "radio" || type === "radio") {
    const want = lc(f.optionText || f.value);
    const radios = Array.from(document.querySelectorAll<HTMLElement>('[role="radio"], input[type="radio"]'));
    const match = radios.find(
      (r) =>
        lc(r.getAttribute("value") || "") === want ||
        (!!want && lc(r.id).endsWith(want)) ||
        lc(r.textContent || "") === want,
    );
    if (match) { clickIfEnabled(match); return true; }
    // No native radio matched the value. Many "radio-like" choices in this app
    // are custom buttons or clickable cards whose text IS the option (e.g. the
    // Website/WhatsApp destination toggle, objective cards). Prefer a button/card
    // whose text matches the option value over the selector-resolved element.
    if (want) {
      const byOption =
        Array.from(document.querySelectorAll<HTMLElement>("button")).find(
          (b) => lc(b.textContent || "") === want && !(b as HTMLButtonElement).disabled,
        ) || clickableCardByText(want);
      if (byOption) { clickIfEnabled(byOption); return true; }
    }
    clickIfEnabled(el);
    return true;
  }

  // Radix Select / combobox trigger → open, wait for portal options, click match
  if (role === "combobox" || type === "combobox" || (type === "select" && tag !== "select")) {
    clickIfEnabled(el);
    const ok = await waitFor(() => !!pickOption(f.value, f.optionText), 5000);
    if (ok) { clickIfEnabled(pickOption(f.value, f.optionText)); return true; }
    // close & give up gracefully
    el.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    return false;
  }
  // native <select> — set value via the native setter then dispatch a bubbling
  // change so React (and any onChange listener) picks up the new selection.
  if (tag === "select") {
    const sel = el as unknown as HTMLSelectElement;
    const want = lc(f.optionText || f.value);
    const opt = Array.from(sel.options).find((o) => o.value === f.value || lc(o.text).includes(want));
    const proto = HTMLSelectElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    const next = opt ? opt.value : f.value;
    if (setter) setter.call(sel, next);
    else sel.value = next;
    sel.dispatchEvent(new Event("input", { bubbles: true }));
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  // slider — not reliably settable; skip (reported as missing)
  if (role === "slider" || type === "unknown") return false;

  // input / textarea / date — controlled React fields ignore a direct el.value
  // assignment, so use reactSet (native setter + bubbling input/change/blur).
  reactSet(el as HTMLInputElement | HTMLTextAreaElement, f.value);
  return true;
}

async function fillGroup(
  fields: FillField[],
  onEvent: ((e: DriveEvent) => void) | undefined,
  delay: number,
  filled: string[],
  missing: string[],
  fieldWaitMs = 8000,
  firstFieldWaitMs = 18000,
): Promise<void> {
  const first = fields[0];
  // Slow data-fetch pages (content planner, CRM, social-posting) can take 10-20s to
  // render the first field with NO spinner we can detect — so waitForPageSettle returns
  // early and we'd give up before the form appears (the race that left these pages
  // filled with nothing). Wait generously for the first field; fast pages return at once.
  // Timeouts are injectable (driveFill opts) so tests run fast without changing prod.
  if (first) await waitFor(() => !!resolveEl(first), firstFieldWaitMs);
  await sleep(250);
  for (const f of fields) {
    onEvent?.({ status: "filling", field: f.label || f.selector });
    const ok = await waitFor(() => !!resolveEl(f), fieldWaitMs);
    if (!ok) { missing.push(f.selector); onEvent?.({ status: "field-missing", field: f.selector }); continue; }
    if (await fillOne(f)) filled.push(f.selector); else missing.push(f.selector);
    await sleep(delay);
  }
}

/** Find an enabled button whose text matches one of `texts` (first wins).
 *  Matches on textContent (jsdom-safe) — innerText isn't computed without
 *  layout — and prefers an exact match before a contains match. */
function findButtonByTexts(texts: string | string[]): HTMLButtonElement | null {
  const arr = (Array.isArray(texts) ? texts : [texts]).map(lc).filter(Boolean);
  const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).filter((b) => !b.disabled);
  for (const want of arr) {
    const exact = buttons.find((b) => lc(b.textContent || "") === want);
    if (exact) return exact;
    const inc = buttons.find((b) => lc(b.textContent || "").includes(want));
    if (inc) return inc;
  }
  return null;
}

/** Click ANY clickable element matching `text` — not just <button>. Many reveal
 *  controls are tabs / accordion headers / cards rendered as <div role="tab">,
 *  <div role="button">, <a>, <li>, or a `cursor-pointer` div (e.g. the WhatsApp
 *  automation "Drip Campaigns" tab). Tries an enabled button first (most common),
 *  then a role/anchor/card match. Returns clicked?. */
function clickAnyByText(text: string): boolean {
  const btn = findButtonByTexts(text);
  if (btn) { btn.scrollIntoView({ behavior: "smooth", block: "center" }); return clickIfEnabled(btn); }
  const want = lc(text);
  const cands = Array.from(
    document.querySelectorAll<HTMLElement>('[role="tab"],[role="button"],[role="menuitem"],a,li,summary'),
  );
  const exact = cands.find((c) => lc(c.textContent || "") === want);
  const inc = exact || cands.find((c) => lc(c.textContent || "").includes(want) && (c.textContent || "").length < want.length + 40);
  const target = inc || clickableCardByText(want);
  // Use clickIfEnabled (pointer-event sequence) so Radix tabs/segments actually
  // activate — a bare target.click() leaves the tab inactive.
  if (target) { target.scrollIntoView({ behavior: "smooth", block: "center" }); return clickIfEnabled(target); }
  return false;
}

/** Poll for + click any element by text (tab/div/button), up to `timeoutMs`. */
async function clickAnyAdvance(text: string, timeoutMs = 10000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (clickAnyByText(text)) return true;
    await sleep(200);
  }
  return clickAnyByText(text);
}

/** Click a step's advance button, retrying briefly (the button may be disabled
 *  for a moment after a fill while validators settle). Returns clicked?. */
async function clickAdvance(texts: string | string[]): Promise<boolean> {
  const btn = await new Promise<HTMLButtonElement | null>((resolve) => {
    const start = Date.now();
    const tick = () => {
      const b = findButtonByTexts(texts);
      if (b) return resolve(b);
      if (Date.now() - start > 12000) return resolve(null);
      setTimeout(tick, 150);
    };
    tick();
  });
  if (!btn) return false;
  btn.scrollIntoView({ behavior: "smooth", block: "center" });
  return clickIfEnabled(btn);
}

/** Resolve a step-probe element (a known control of the next step). */
function resolveProbe(p?: StepProbe): HTMLElement | null {
  if (!p) return null;
  return resolveEl({ selector: p.selector, selectorKind: p.selectorKind, value: "" });
}

/** Poll for an enabled button matching `texts`, up to `timeoutMs`. */
async function waitForButton(texts: string | string[], timeoutMs: number): Promise<HTMLButtonElement | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const b = findButtonByTexts(texts);
    if (b) return b;
    await sleep(250);
  }
  return findButtonByTexts(texts);
}

/** AI-assist for a hard step (e.g. /audience): the Meta geo/interest
 *  autocompletes ignore synthetic typing, so instead — after the text fields are
 *  filled — we click "Generate AI Suggestions" (an async LLM call), wait for the
 *  "Apply All Suggestions" button to appear, click it (it shows "Applying
 *  Suggestions…" while it fills Location/Interests/Age/Gender), and wait for that
 *  to finish before the caller does the normal advance. Fully defensive: if a
 *  button never shows within its timeout we log and return so the caller still
 *  advances — we never hang. */
async function runAiAssist(
  ai: { generate: string; apply: string },
  onEvent: ((e: DriveEvent) => void) | undefined,
): Promise<void> {
  // a. click "Generate AI Suggestions" (requires Industry already filled).
  onEvent?.({ status: "navigating", message: `ai-assist: ${ai.generate}` });
  const generated = await clickAdvance(ai.generate);
  if (!generated) {
    onEvent?.({ status: "field-missing", field: `ai-generate:${ai.generate}` });
    return; // proceed to normal advance
  }

  // b. wait for the apply button to become available (~25s; the generate is an
  //    async LLM call that surfaces "Apply All Suggestions" when ready).
  const applyBtn = await waitForButton(ai.apply, 25000);
  if (!applyBtn) {
    onEvent?.({ status: "field-missing", field: `ai-apply:${ai.apply}` });
    return; // proceed to normal advance
  }

  // c. click "Apply All Suggestions".
  onEvent?.({ status: "navigating", message: `ai-assist: ${ai.apply}` });
  applyBtn.scrollIntoView({ behavior: "smooth", block: "center" });
  clickIfEnabled(applyBtn);

  // d. wait for applying to finish (~25s). While the suggestions are being
  //    applied + interests validated, the app surfaces the in-progress label
  //    "Applying Suggestions…" (on the advance button). Give the apply a moment
  //    to enter that state, then poll until NO button shows "applying" anymore.
  //    If it never settles, fall back to a fixed wait so we don't advance
  //    mid-apply. (The "Apply All Suggestions" button itself keeps a static
  //    label, so we detect progress via the in-progress text, not that button.)
  await sleep(600);
  const applyingShowing = () =>
    Array.from(document.querySelectorAll<HTMLButtonElement>("button")).some((b) =>
      lc(b.textContent || "").includes("applying"),
    );
  const settled = await waitFor(() => !applyingShowing(), 25000, 300);
  if (!settled) await sleep(3000);

  // brief settle so applied state propagates to the form before advancing.
  await sleep(1500);
}

/** Post-fill action: after a step's fields are filled, click one more button and
 *  wait for its result before advancing. Used for /creative "Generate with AI"
 *  (waitForImage → the ad image appears in the preview) and /budget
 *  "Save to Meta & Select" (waitForProbe). Fully defensive: if the button isn't
 *  present (e.g. a non-lead campaign has no lead-form Save button, or the user
 *  will supply their own creative) it logs and returns so the sequencer advances. */
async function runPostFill(
  pf: NonNullable<DirectiveStep["postFill"]>,
  onEvent: ((e: DriveEvent) => void) | undefined,
): Promise<boolean> {
  onEvent?.({ status: "navigating", message: `generate: ${pf.click}` });
  const clicked = await clickAdvance(pf.click);
  if (!clicked) { onEvent?.({ status: "field-missing", field: `action:${pf.click}` }); return false; }
  const settle = pf.settleMs ?? 60000;
  if (pf.waitForImage) {
    // wait for a real generated image to render in the creative preview
    const imgReady = () => Array.from(document.querySelectorAll<HTMLImageElement>("img")).some(
      (i) => /digitaloceanspaces|\/outputs\/|^data:image/.test(i.src) && i.naturalWidth > 10,
    );
    let ok = await waitFor(imgReady, settle, 600);
    if (!ok) {
      // RELIABLE GEN: the generate call can transiently stall/fail (server load),
      // leaving the preview empty. Re-click "Generate" once and wait again before
      // giving up, so a single flaky call doesn't leave the ad with no image.
      onEvent?.({ status: "navigating", message: `generate: ${pf.click} (retry)` });
      await clickAdvance(pf.click);
      ok = await waitFor(imgReady, settle, 600);
    }
    await sleep(1200);
    return ok;
  } else if (pf.waitForProbe) {
    const ok = await waitFor(() => !!resolveProbe(pf.waitForProbe), settle, 400);
    await sleep(1200);
    return ok;
  }
  await sleep(Math.min(settle, 4000));
  await sleep(1200); // let the applied result propagate before advancing
  return true;
}

/** Sequential wizard driver: navigate ONCE to the entry route, then for each
 *  ordered step fill its controls, click its advance button, and wait for the
 *  next step to render (poll the probe) before continuing. STOPS before the
 *  terminal step — never clicks Publish. (objective auto-advances on card click,
 *  so its step has no advanceButtonText and we just wait for the probe.) */
async function driveSequential(
  directive: UIDirective,
  navigate: (to: string) => void,
  onEvent: ((e: DriveEvent) => void) | undefined,
  delay: number,
  filled: string[],
  missing: string[],
  fieldWaitMs = 8000,
  firstFieldWaitMs = 18000,
): Promise<{ reachedReview: boolean; imageMissing: boolean }> {
  if (isNavigable(directive.route)) {
    onEvent?.({ status: "navigating", message: directive.route });
    navigate(directive.route);
  }
  const steps = directive.steps || [];
  let reachedReview = true;   // assume ok unless the final hop to review is blocked
  let imageMissing = false;   // a waitForImage postFill that never produced an image
  for (let i = 0; i < steps.length; i++) {
    const g = steps[i];
    if (g.terminal) break;                 // never drive/publish the review step
    const next = steps[i + 1];

    // Some steps live on a separate route the prior advance can't reach (e.g. the
    // rich creative editor /start2). Navigate there first; shared campaign state
    // persists, and we wait for the first field to render before filling.
    if (g.navigate && isNavigable(g.route)) {
      onEvent?.({ status: "navigating", message: g.route });
      navigate(g.route);
      if (g.fields[0]) await waitFor(() => !!resolveEl(g.fields[0]), Math.min(9000, firstFieldWaitMs));
      else await sleep(900);
    }

    if (g.fields.length) await fillGroup(g.fields, onEvent, delay, filled, missing, fieldWaitMs, firstFieldWaitMs);

    // AI-assist (e.g. /audience): with the text fields (incl. Industry) filled,
    // click Generate → wait → Apply → wait-to-finish, which fills the hard
    // autocomplete fields (Location/Interests/Age/Gender), BEFORE the normal
    // advance. Defensive: never hangs — falls through to advance on timeout.
    if (g.aiAssist) await runAiAssist(g.aiAssist, onEvent);

    // Post-fill action (e.g. /creative "Generate with AI" → wait for the image)
    // so the step is COMPLETE before we advance. Skipped if the button is absent.
    if (g.postFill) {
      const pfOk = await runPostFill(g.postFill, onEvent);
      if (g.postFill.waitForImage && !pfOk) imageMissing = true;
    }

    // Advance to the next step. The objective step auto-advances when its card
    // is clicked during fillGroup (no advanceButtonText), so we skip the click
    // there and just poll the probe for the next step. Steps 2–5 click their
    // explicit Continue button. When `next` is terminal we still click (e.g.
    // "Continue to Review") to LAND on review, then STOP — never touch review.
    if (g.advanceButtonText) {
      const first = Array.isArray(g.advanceButtonText) ? g.advanceButtonText[0] : g.advanceButtonText;
      onEvent?.({ status: "navigating", message: `advance: ${first}` });
      // RELIABLE ADVANCE: the advance button can be momentarily disabled while
      // validators settle (e.g. /audience while Meta's live reach-estimate is
      // still loading), so a single click can no-op. Re-click until the NEXT
      // step's probe renders, up to 3 attempts, before giving up.
      const probe = g.nextStepProbe;
      let landed = false;
      for (let attempt = 0; attempt < 3 && !landed; attempt++) {
        await clickAdvance(g.advanceButtonText);
        if (!probe) { landed = true; break; }            // nothing to confirm → assume advanced
        landed = await waitFor(() => !!resolveProbe(probe), attempt === 0 ? 12000 : 8000, 400);
        if (!landed) await sleep(900);                   // let validators/estimates settle, then retry the click
      }
      // The hop INTO the terminal (review) step didn't land — a required field on
      // this step (e.g. an empty destination URL or a missing ad image) is blocking
      // "Continue to Review". Signal it so the caller can prompt the user.
      if (probe && !landed && next?.terminal) reachedReview = false;
    } else if (g.nextStepProbe) {
      // auto-advance step (objective card click during fillGroup) → just wait for next.
      await waitFor(() => !!resolveProbe(g.nextStepProbe), 9000);
    }

    if (!next || next.terminal) break;     // landed on/just before review — stop
  }
  return { reachedReview, imageMissing };
}

export async function driveFill(
  directive: UIDirective,
  navigate: (to: string) => void,
  onEvent?: (e: DriveEvent) => void,
  opts?: { stepDelayMs?: number; fieldWaitMs?: number; firstFieldWaitMs?: number },
): Promise<{ filled: string[]; missing: string[] }> {
  const delay = opts?.stepDelayMs ?? 550;
  const fieldWaitMs = opts?.fieldWaitMs ?? 8000;
  const firstFieldWaitMs = opts?.firstFieldWaitMs ?? 18000;
  const filled: string[] = [];
  const missing: string[] = [];

  // Glowing "Sociovia Agent is working" overlay on the REAL pages. Attached to
  // document.body (outside the React root) so it survives SPA route changes as
  // the agent navigates the wizard. Every drive event also updates its status.
  showAgentOverlay("Opening the form…");
  const emit = (e: DriveEvent) => {
    if (e.status === "navigating") setAgentOverlay(prettyDriveStatus(e.message));
    else if (e.status === "filling") setAgentOverlay(`Filling ${String(e.field || "fields").replace(/_/g, " ").toLowerCase()}…`);
    onEvent?.(e);
  };
  let ok = false;
  let incomplete = false;       // drive ran, but a required field needs the user
  let actionMsg = "";
  try {
    // ── Navigate-only handoff: land on the page, then tell the user what to pick/
    //    open (the form/fields only exist after a user choice, or it's a canvas
    //    editor). Don't pretend to fill absent fields. ──
    if (directive.handoff) {
      if (isNavigable(directive.route)) { emit({ status: "navigating", message: directive.route }); navigate(directive.route); }
      incomplete = true; actionMsg = directive.handoff; ok = true;
      return { filled, missing };   // `finally` surfaces actionMsg as an action prompt
    }
    // ── Sequential wizard (e.g. /create): one nav, advance in-place per step ──
    if (directive.interactive === "sequential" && directive.steps?.length) {
      const res = await driveSequential(directive, navigate, emit, delay, filled, missing, fieldWaitMs, firstFieldWaitMs);
      emit({ status: "filled", message: `${filled.length} field(s) prepared` });
      ok = true;
      if (!res.reachedReview) {
        // The creative step couldn't advance to Review — pinpoint what the user
        // still needs to supply so we prompt precisely instead of claiming "done".
        const urlEl = resolveEl({ selector: "url", selectorKind: "id", value: "" }) as HTMLInputElement | null;
        const urlEmpty = !!urlEl && !String(urlEl.value || "").trim();
        const imgOk = Array.from(document.querySelectorAll<HTMLImageElement>("img")).some(
          (i) => /digitaloceanspaces|\/outputs\/|^data:image/.test(i.src) && i.naturalWidth > 10,
        );
        const needs: string[] = [];
        if (!imgOk || res.imageMissing) needs.push("generate the ad image");
        if (urlEmpty) needs.push("add your destination URL");
        actionMsg = (needs.length ? `Almost done — ${needs.join(" and ")}` : "One required field needs your input")
          + ", then click Continue to Review.";
        incomplete = true;
      }
      return { filled, missing };
    }

    const groups: DirectiveStep[] = directive.steps?.length
      ? directive.steps
      : [{ route: directive.route, fields: directive.fields }];
    let openedModal = false;
    let preClicked = false;
    for (const g of groups) {
      // Navigate FIRST — even a fieldless group should land the user on the real
      // page (e.g. a sparse workspace-setup spec with nothing to pre-fill) rather
      // than silently doing nothing.
      if (isNavigable(g.route)) {
        emit({ status: "navigating", message: g.route });
        navigate(g.route);
      }
      if (!g.fields.length) continue;
      // Let the page's data load + render settle before opening a modal or filling
      // — otherwise a late fetch re-renders the page and wipes what we just did.
      await waitForPageSettle();
      // ── Modal flows: click the open-trigger after navigating, before filling.
      //    Only once (the trigger lives on the landing page for the first step). ──
      if (directive.openTrigger && !openedModal) {
        openedModal = true;
        // RELIABLE OPEN: a single click can be lost — the trigger may render before
        // a data fetch resolves, and the late re-render can wipe a modal we just
        // opened (observed on the slow CRM pages: the click "succeeds" but the
        // modal never stays). So CONFIRM the modal by polling for its first field,
        // and re-click the trigger until that field appears — up to 4 attempts.
        const firstField = g.fields[0];
        let modalOpen = false;
        for (let attempt = 0; attempt < 4 && !modalOpen; attempt++) {
          const btn = await waitForButton(directive.openTrigger, attempt === 0 ? 20000 : 6000);
          if (!btn) break;
          btn.scrollIntoView({ behavior: "smooth", block: "center" });
          clickIfEnabled(btn);
          modalOpen = await waitFor(() => !!resolveEl(firstField), attempt === 0 ? 6000 : 5000, 200);
          if (!modalOpen) await sleep(800); // let any in-flight re-render settle, then retry
        }
        if (!modalOpen) emit({ status: "field-missing", field: `trigger:${directive.openTrigger}` });
      }
      // Reveal fields hidden behind a control before filling — click each preClick
      // `count` times, once. Uses clickAnyAdvance so it can target tabs / accordion
      // headers / cards (e.g. the WhatsApp automation "Drip Campaigns" tab), not
      // just <button>s (e.g. the template "Add Button"). After a reveal that opens
      // a section/dialog, give it a beat to render before the next preClick.
      if (directive.preClicks?.length && !preClicked) {
        preClicked = true;
        for (const [pcIndex, pc] of directive.preClicks.entries()) {
          for (let n = 0; n < (pc.count ?? 1); n++) {
            emit({ status: "navigating", message: `add: ${pc.text}` });
            // The FIRST preClick races a cold/forced remount (Approve&fill appends a
            // cache-bust → the heavy page reloads + shows a ~20s loader, and not every
            // page's loader is caught by waitForPageSettle). Poll long enough for the
            // tab/section to render; later reveals (already on-screen) resolve fast.
            await clickAnyAdvance(pc.text, pcIndex === 0 ? 20000 : 9000);
            await sleep(delay); // the next preClick's own poll waits for its (revealed) target to render
          }
        }
      }
      await fillGroup(g.fields, emit, delay, filled, missing, fieldWaitMs, firstFieldWaitMs);
    }
    // AI-assist (e.g. standalone /create/audience): with the typeable fields filled,
    // click Generate → wait → Apply → wait, which fills the hard autocomplete/slider
    // fields. Defensive: runAiAssist never hangs (falls through on timeout).
    if (directive.aiAssist) await runAiAssist(directive.aiAssist, emit);
    // After filling, optionally click a generate-style button (e.g. "AI Generate"
    // / "Generate Flow") to kick off generation. Prepare-only: a generate action,
    // not a publish — the user still reviews the result.
    if (directive.postFill?.click) {
      emit({ status: "navigating", message: `generate: ${directive.postFill.click}` });
      await clickAdvance(directive.postFill.click);
      await sleep(directive.postFill.settleMs ?? 4000);
    }
    emit({ status: "filled", message: `${filled.length} field(s) prepared` });
    ok = true;
  } catch (e: any) {
    emit({ status: "error", message: e?.message || "drive failed" });
    setAgentOverlay("You can take over from here.", "error");
  } finally {
    if (incomplete) setAgentOverlay(actionMsg, "action");
    else if (ok) setAgentOverlay("All set — review the pre-filled details and publish.", "done");
    hideAgentOverlay(incomplete ? 7000 : (ok ? 1500 : 800));
  }
  return { filled, missing };
}

export function highlightSubmit(...texts: string[]): void {
  for (const t of texts) {
    const btn = queryButtonByText(t);
    if (btn) { btn.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
  }
}

/* ════════════════════════════════════════════════════════════════════════
   "Sociovia Agent is working" overlay — a transparent, glowing layer shown on
   the REAL app pages while the agent navigates + fills. Attached to
   document.body (NOT the React root) so it persists across SPA route changes.
   pointer-events: none → purely visual; never blocks the fill or traps the user.
   ════════════════════════════════════════════════════════════════════════ */
const SV_OVERLAY_ID = "sv-agent-overlay";
const SV_OVERLAY_STYLE_ID = "sv-agent-overlay-style";

/** Map a raw drive event message to a friendly, human status line. */
function prettyDriveStatus(msg?: string): string {
  const m = (msg || "").toLowerCase();
  if (m.includes("ai-assist") && m.includes("generate")) return "Generating AI suggestions…";
  if (m.includes("ai-assist") && m.includes("apply")) return "Applying the suggestions…";
  if (m.startsWith("advance")) return "Moving to the next step…";
  if (m.includes("trigger")) return "Opening the editor…";
  if (m.includes("audience")) return "Building your audience…";
  if (m.includes("budget")) return "Setting the budget & schedule…";
  if (m.includes("placement")) return "Choosing placements…";
  if (m.includes("creative")) return "Preparing the creative…";
  if (m.includes("review")) return "Almost there — opening Review…";
  if (m.includes("campaign")) return "Opening the campaign builder…";
  if (m.includes("post") || m.includes("social")) return "Opening the post composer…";
  return "Working on the form…";
}

function injectAgentOverlayStyle(): void {
  if (typeof document === "undefined" || document.getElementById(SV_OVERLAY_STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = SV_OVERLAY_STYLE_ID;
  s.textContent = `
#${SV_OVERLAY_ID}{position:fixed;inset:0;z-index:2147483000;pointer-events:none;opacity:0;transition:opacity .45s ease;font-family:'Hanken Grotesk',system-ui,-apple-system,sans-serif}
#${SV_OVERLAY_ID}.in{opacity:1}
#${SV_OVERLAY_ID}.leaving{opacity:0}
#${SV_OVERLAY_ID} .sv-aura{position:absolute;inset:0;border:1px solid rgba(16,185,129,.28);animation:sv-aura 2.6s ease-in-out infinite}
@keyframes sv-aura{0%,100%{box-shadow:inset 0 0 100px -16px rgba(16,185,129,.30)}50%{box-shadow:inset 0 0 140px -8px rgba(16,185,129,.55)}}
#${SV_OVERLAY_ID} .sv-card{position:absolute;left:50%;bottom:42px;transform:translateX(-50%);display:flex;align-items:center;gap:15px;padding:14px 22px 14px 16px;border-radius:18px;max-width:min(92vw,470px);background:rgba(255,255,255,.84);backdrop-filter:blur(16px) saturate(1.25);-webkit-backdrop-filter:blur(16px) saturate(1.25);border:1px solid rgba(16,185,129,.32);animation:sv-rise .5s cubic-bezier(.2,.9,.3,1.2) both,sv-glow 2.6s ease-in-out infinite}
@keyframes sv-rise{from{opacity:0;transform:translateX(-50%) translateY(18px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
@keyframes sv-glow{0%,100%{box-shadow:0 20px 54px -18px rgba(13,27,42,.42),0 0 30px -10px rgba(16,185,129,.45)}50%{box-shadow:0 20px 54px -18px rgba(13,27,42,.42),0 0 64px -6px rgba(16,185,129,.75)}}
#${SV_OVERLAY_ID} .sv-orb{width:36px;height:36px;flex:none;border-radius:50%;position:relative;background:conic-gradient(from 0deg,#10b981,#34d399,#14b8a6,#10b981);animation:sv-spin 1.05s linear infinite}
#${SV_OVERLAY_ID} .sv-orb::before{content:"";position:absolute;inset:-3px;border-radius:50%;box-shadow:0 0 20px 3px rgba(16,185,129,.6)}
#${SV_OVERLAY_ID} .sv-orb::after{content:"";position:absolute;inset:5px;border-radius:50%;background:#fff}
@keyframes sv-spin{to{transform:rotate(360deg)}}
#${SV_OVERLAY_ID}.done .sv-orb,#${SV_OVERLAY_ID}.error .sv-orb{animation:none;background:#10b981}
#${SV_OVERLAY_ID}.error .sv-orb{background:#e5484d}
#${SV_OVERLAY_ID}.done .sv-orb::after{content:"✓";display:flex;align-items:center;justify-content:center;inset:0;background:transparent;color:#fff;font-weight:800;font-size:18px}
#${SV_OVERLAY_ID}.error .sv-orb::after{content:"!";display:flex;align-items:center;justify-content:center;inset:0;background:transparent;color:#fff;font-weight:800;font-size:18px}
#${SV_OVERLAY_ID}.action .sv-orb{animation:none;background:#f59e0b}
#${SV_OVERLAY_ID}.action .sv-orb::after{content:"!";display:flex;align-items:center;justify-content:center;inset:0;background:transparent;color:#fff;font-weight:800;font-size:18px}
#${SV_OVERLAY_ID}.action .sv-card{animation:sv-rise .5s cubic-bezier(.2,.9,.3,1.2) both;border-color:rgba(245,158,11,.42)}
#${SV_OVERLAY_ID}.action .sv-sub{color:#b45309;white-space:normal}
#${SV_OVERLAY_ID}.action .sv-wait{display:none}
#${SV_OVERLAY_ID}.done .sv-card,#${SV_OVERLAY_ID}.error .sv-card{animation:sv-rise .5s cubic-bezier(.2,.9,.3,1.2) both}
#${SV_OVERLAY_ID} .sv-tx{display:flex;flex-direction:column;gap:2px;min-width:0}
#${SV_OVERLAY_ID} .sv-title{font-weight:700;font-size:14px;letter-spacing:-.01em;color:#0d1b2a}
#${SV_OVERLAY_ID} .sv-sub{font-weight:500;font-size:12.5px;color:#0e9f72;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${SV_OVERLAY_ID}.error .sv-sub{color:#e5484d}
#${SV_OVERLAY_ID} .sv-wait{font-weight:500;font-size:11px;color:#69717e}
#${SV_OVERLAY_ID}.done .sv-wait,#${SV_OVERLAY_ID}.error .sv-wait{display:none}
@media (prefers-reduced-motion:reduce){#${SV_OVERLAY_ID} *{animation:none !important}}
`;
  document.head.appendChild(s);
}

export function showAgentOverlay(sub?: string): void {
  if (typeof document === "undefined") return;
  injectAgentOverlayStyle();
  let el = document.getElementById(SV_OVERLAY_ID);
  if (!el) {
    el = document.createElement("div");
    el.id = SV_OVERLAY_ID;
    el.setAttribute("aria-hidden", "true");
    el.innerHTML =
      '<div class="sv-aura"></div>' +
      '<div class="sv-card"><div class="sv-orb"></div><div class="sv-tx">' +
      '<div class="sv-title">Sociovia Agent is working</div>' +
      '<div class="sv-sub"></div>' +
      "<div class=\"sv-wait\">Please wait — I'm filling this for you</div>" +
      "</div></div>";
    document.body.appendChild(el);
  }
  el.className = "";
  void el.offsetWidth; // reflow so the fade-in transition runs
  el.classList.add("in");
  setAgentOverlay(sub || "Preparing your form…");
}

export function setAgentOverlay(sub: string, state?: "done" | "error" | "action"): void {
  if (typeof document === "undefined") return;
  const el = document.getElementById(SV_OVERLAY_ID);
  if (!el) return;
  el.classList.remove("done", "error", "action");
  const titleEl = el.querySelector(".sv-title");
  const subEl = el.querySelector(".sv-sub");
  if (subEl) subEl.textContent = sub;
  if (state === "done") { el.classList.add("done"); if (titleEl) titleEl.textContent = "Ready for you"; }
  else if (state === "error") { el.classList.add("error"); if (titleEl) titleEl.textContent = "Couldn't finish"; }
  else if (state === "action") { el.classList.add("action"); if (titleEl) titleEl.textContent = "Almost there"; }
  else if (titleEl) titleEl.textContent = "Sociovia Agent is working";
}

export function hideAgentOverlay(delayMs = 0): void {
  if (typeof document === "undefined") return;
  window.setTimeout(() => {
    const el = document.getElementById(SV_OVERLAY_ID);
    if (!el) return;
    el.classList.remove("in");
    el.classList.add("leaving");
    window.setTimeout(() => el.remove(), 550);
  }, Math.max(0, delayMs));
}

// ---- generic spec → directive over any registry flow ----
const OPTION_TYPES = new Set<FieldType>(["select", "combobox", "radio"]);
function norm(s: string): string { return s.toLowerCase().replace(/[^a-z0-9]/g, ""); }

function matchValue(spec: Record<string, any>, semantic: string, aliases?: string[]): any {
  if (spec == null) return undefined;
  // exact semantic, then any explicit alias key (e.g. product_url / link).
  if (spec[semantic] != null) return spec[semantic];
  for (const a of aliases || []) if (spec[a] != null) return spec[a];
  const targets = [semantic, ...(aliases || [])].map(norm);
  for (const [k, v] of Object.entries(spec)) {
    const nk = norm(k);
    if (targets.some((t) => nk === t || t.includes(nk) || nk.includes(t))) return v;
  }
  const tail = semantic.split("_").pop() || "";
  if (tail && spec[tail] != null) return spec[tail];
  return undefined;
}

/** Build a fill directive for any flow in the registry from a semantic spec.
 *  - deep-linkable wizards  → fields grouped into per-step navigable routes.
 *  - sequential wizards     → ordered steps with advance buttons (driven in-place).
 *  - modal flows            → carries `openTrigger` so driveFill opens the modal. */
export function buildDirectiveFromSpec(flowKey: string, spec: Record<string, any>): UIDirective {
  const flow = FLOW_REGISTRY[flowKey];
  if (!flow) return { route: "", fields: [], flowKey };

  const fields: FillField[] = [];
  const bySemantic = new Map<string, FillField>();
  for (const f of flow.fields as FlowField[]) {
    const rawVal = matchValue(spec, f.semantic, f.aliases);
    if (rawVal === undefined || rawVal === null || String(rawVal).trim() === "") continue;
    // Translate a canonical spec value to the value the UI control renders
    // (e.g. objective enum OUTCOME_LEADS -> the card title "Lead Generation"),
    // so option/radio matching clicks the right control instead of falling back
    // to a hardcoded selector. Match exact, then case-insensitively.
    let val = String(rawVal);
    if (f.valueMap) {
      const mapped = f.valueMap[val] ?? f.valueMap[val.toUpperCase()] ?? f.valueMap[val.toLowerCase()];
      if (mapped) val = mapped;
    }
    const ff: FillField = {
      selector: f.selector,
      selectorKind: f.selectorKind,
      value: val,
      type: f.type,
      optionText: OPTION_TYPES.has(f.type) ? val : undefined,
      label: f.semantic,
    };
    fields.push(ff);
    // A semantic can appear on >1 field (e.g. gender variants) — keep the first.
    if (!bySemantic.has(f.semantic)) bySemantic.set(f.semantic, ff);
  }

  const route = flow.navigable === false ? "" : (flow.route || "");
  const sequential = flow.interactive === "sequential";

  let steps: DirectiveStep[] | undefined;
  // Sequential wizard: build every ordered step (even fieldless ones like the
  // terminal review step) so the sequencer knows where to STOP. Advance metadata
  // (advanceButtonText / nextStepProbe / terminal) is carried through verbatim.
  if (sequential && flow.stepRoutes?.length) {
    steps = flow.stepRoutes.map((sr) => {
      const stepFields = sr.fields
        .map((sem) => bySemantic.get(sem))
        .filter((x): x is FillField => !!x);
      return {
        route: sr.route,
        fields: stepFields,
        advanceButtonText: sr.advanceButtonText,
        nextStepProbe: sr.nextStepProbe,
        terminal: sr.terminal,
        aiAssist: sr.aiAssist,
        postFill: sr.postFill,
        navigate: sr.navigate,
      } as DirectiveStep;
    });
  } else if (flow.deepLinkableSteps && flow.stepRoutes?.length) {
    steps = [];
    const used = new Set<string>();
    for (const sr of flow.stepRoutes) {
      const stepFields = sr.fields
        .map((sem) => { used.add(sem); return bySemantic.get(sem); })
        .filter((x): x is FillField => !!x);
      if (stepFields.length) steps.push({ route: sr.route, fields: stepFields });
    }
    const leftover = fields.filter((ff) => !used.has(ff.label || ""));
    if (leftover.length) steps.unshift({ route, fields: leftover });
    if (!steps.length) steps = undefined;
  }

  return {
    route,
    fields,
    steps,
    note: flow.title,
    flowKey,
    interactive: sequential ? "sequential" : undefined,
    openTrigger: flow.openTrigger,
    preClicks: flow.preClicks,
    postFill: flow.postFill,
    aiAssist: flow.aiAssist,
    handoff: flow.handoff,
  };
}

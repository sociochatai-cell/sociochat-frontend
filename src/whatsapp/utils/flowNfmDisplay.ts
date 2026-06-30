/**
 * Shared parsing + display helpers for WhatsApp interactive nfm_reply (Flow) payloads.
 * Used by MessageBubble, conversation list preview, and SSE handlers.
 */

const SKIP_KEYS = new Set([
  'flow_token',
  'wa_id',
  'endpoint_flow_data_merged',
  'endpoint_flow_completed_at',
]);

/** Meta / WhatsApp often echo non-informative strings in nfm_reply.body — hide as primary text. */
export function isGenericFlowBody(body: string | undefined | null, flowName?: string | null): boolean {
  const t = String(body ?? '').trim().toLowerCase();
  if (!t) return true;
  if (['sent', 'response sent', 'completed', 'done', 'submitted', 'ok'].includes(t)) return true;
  if (flowName && t === String(flowName).trim().toLowerCase()) return true;
  return false;
}

export type NfmContentLike = {
  flow_name?: string;
  flow_body?: string;
  response_json?: unknown;
  response_json_raw?: string;
  /** Set by server from Flow JSON (name → label); optional on older rows. */
  flow_field_labels?: Record<string, string>;
};

const FIELD_COMPONENT_TYPES = new Set([
  'TextInput',
  'TextArea',
  'Dropdown',
  'RadioButtonsGroup',
  'CheckboxGroup',
  'DatePicker',
]);

/** Turn opaque field keys into a short title-case fallback (last resort). */
export function humanizeNfmFieldKey(key: string): string {
  const stripped = key.replace(/^[A-Z0-9]{8,}_\d+_/i, '');
  const base = stripped !== key ? stripped : key;
  const words = base.replace(/_/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return key;
  return words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
}

/**
 * Build name→label map from Sociovia flow definitions (same idea as backend
 * ``build_flow_field_label_map_for_account``). Used when ``flow_field_labels``
 * is missing on the message (older payloads).
 */
export function buildClientFlowFieldLabelMap(
  flows: Array<{ flow_json?: unknown }>,
): Record<string, string> {
  const labels: Record<string, string> = {};
  for (const flow of flows) {
    const fj = flow.flow_json;
    if (!fj || typeof fj !== 'object') continue;
    const screens = (fj as { screens?: unknown }).screens;
    if (!Array.isArray(screens)) continue;
    for (const screen of screens) {
      if (!screen || typeof screen !== 'object') continue;
      const layout = (screen as { layout?: { children?: unknown } }).layout;
      const children = layout?.children;
      if (!Array.isArray(children)) continue;
      for (const comp of children) {
        if (!comp || typeof comp !== 'object') continue;
        const c = comp as { type?: string; name?: string; label?: string; title?: string };
        if (!c.type || !FIELD_COMPONENT_TYPES.has(c.type)) continue;
        const name = typeof c.name === 'string' ? c.name.trim() : '';
        if (!name) continue;
        const lab = (typeof c.label === 'string' && c.label.trim()) || (typeof c.title === 'string' && c.title.trim());
        if (lab) {
          labels[name] = lab.trim();
        } else if (!(name in labels)) {
          labels[name] = humanizeNfmFieldKey(name);
        }
      }
    }
  }
  return labels;
}

export function resolveNfmFieldLabel(
  key: string,
  content: NfmContentLike,
  clientLabelMap?: Record<string, string> | null,
): string {
  const fromServer = content.flow_field_labels?.[key];
  if (typeof fromServer === 'string' && fromServer.trim()) return fromServer.trim();
  const fromClient = clientLabelMap?.[key];
  if (typeof fromClient === 'string' && fromClient.trim()) return fromClient.trim();
  return humanizeNfmFieldKey(key);
}

/**
 * Parse response_json (object or JSON string), merge response_json_raw when only flow_token,
 * and flatten a nested `data` object/string like Meta sometimes sends.
 */
export function parseNfmResponseObject(content: NfmContentLike): Record<string, unknown> {
  let obj: Record<string, unknown> = {};
  const rj = content?.response_json;

  if (rj && typeof rj === 'object' && !Array.isArray(rj)) {
    obj = { ...(rj as Record<string, unknown>) };
  } else if (typeof rj === 'string' && rj.trim()) {
    try {
      const p = JSON.parse(rj) as unknown;
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        obj = { ...(p as Record<string, unknown>) };
      }
    } catch {
      /* ignore */
    }
  }

  const onlyToken =
    Object.keys(obj).length === 0 ||
    (Object.keys(obj).length === 1 &&
      'flow_token' in obj &&
      Object.keys(obj).every((k) => k === 'flow_token'));

  if (onlyToken && content.response_json_raw && typeof content.response_json_raw === 'string') {
    try {
      const parsed = JSON.parse(content.response_json_raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        obj = { ...obj, ...(parsed as Record<string, unknown>) };
      }
    } catch {
      /* ignore */
    }
  }

  const nested = obj.data;
  if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
    const merged = { ...obj };
    delete merged.data;
    const inner = nested as Record<string, unknown>;
    for (const [k, v] of Object.entries(inner)) {
      if (merged[k] === undefined || merged[k] === null || merged[k] === '') {
        merged[k] = v;
      }
    }
    obj = merged;
  } else if (nested && typeof nested === 'string' && nested.trim()) {
    try {
      const innerParsed = JSON.parse(nested) as unknown;
      if (innerParsed && typeof innerParsed === 'object' && !Array.isArray(innerParsed)) {
        const merged = { ...obj };
        delete merged.data;
        for (const [k, v] of Object.entries(innerParsed as Record<string, unknown>)) {
          if (merged[k] === undefined || merged[k] === null || merged[k] === '') {
            merged[k] = v;
          }
        }
        obj = merged;
      }
    } catch {
      /* ignore */
    }
  }

  return obj;
}

export function nfmDisplayEntries(obj: Record<string, unknown>): [string, unknown][] {
  return Object.entries(obj).filter(([key]) => !SKIP_KEYS.has(key) && !key.startsWith('__'));
}

export function formatNfmValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Keys: ``${fieldName.toLowerCase()}|${optionId.toLowerCase()}`` → option title from Flow ``data-source``. */
export function buildClientFlowOptionLookup(
  flows: Array<{ flow_json?: unknown }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const OPTION_TYPES = new Set(['Dropdown', 'RadioButtonsGroup', 'CheckboxGroup']);
  for (const flow of flows) {
    const fj = flow.flow_json;
    if (!fj || typeof fj !== 'object') continue;
    const screens = (fj as { screens?: unknown }).screens;
    if (!Array.isArray(screens)) continue;
    for (const screen of screens) {
      if (!screen || typeof screen !== 'object') continue;
      const layout = (screen as { layout?: { children?: unknown } }).layout;
      const children = layout?.children;
      if (!Array.isArray(children)) continue;
      for (const comp of children) {
        if (!comp || typeof comp !== 'object') continue;
        const c = comp as {
          type?: string;
          name?: string;
          'data-source'?: unknown;
        };
        if (!c.type || !OPTION_TYPES.has(c.type)) continue;
        const fname = typeof c.name === 'string' ? c.name.trim() : '';
        if (!fname) continue;
        const fk = fname.toLowerCase();
        const ds = c['data-source'];
        if (!Array.isArray(ds)) continue;
        for (const opt of ds) {
          if (!opt || typeof opt !== 'object') continue;
          const o = opt as { id?: string; title?: string };
          const id = typeof o.id === 'string' ? o.id.trim() : '';
          const title = typeof o.title === 'string' ? o.title.trim() : '';
          if (id && title) {
            out[`${fk}|${id.toLowerCase()}`] = title;
          }
        }
      }
    }
  }
  return out;
}

function formatOneOptionChoice(fieldName: string, raw: string, optionLookup: Record<string, string>): string {
  const k = `${fieldName.toLowerCase()}|${raw.toLowerCase()}`;
  return optionLookup[k] || raw;
}

/** Resolve Dropdown/Radio/Checkbox stored ids (e.g. ``opt_1``) to ``data-source`` titles. */
export function formatNfmFieldDisplayValue(
  fieldName: string,
  value: unknown,
  optionLookup?: Record<string, string> | null,
): string {
  if (value === null || value === undefined) return '';
  if (!optionLookup || Object.keys(optionLookup).length === 0) {
    return formatNfmValue(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((v) => (v == null ? '' : formatOneOptionChoice(fieldName, String(v), optionLookup)))
      .filter(Boolean)
      .join(', ');
  }
  if (typeof value === 'object') {
    return formatNfmValue(value);
  }
  const s = String(value).trim();
  if (!s) return '';
  if (s.includes(',')) {
    return s
      .split(',')
      .map((part) => formatOneOptionChoice(fieldName, part.trim(), optionLookup))
      .join(', ');
  }
  return formatOneOptionChoice(fieldName, s, optionLookup);
}

export function buildNfmInboxSummary(
  content: NfmContentLike,
  clientLabelMap?: Record<string, string> | null,
  optionLookup?: Record<string, string> | null,
): {
  ctaTitle: string;
  lines: string[];
  hasFields: boolean;
} {
  const parsed = parseNfmResponseObject(content);
  const entries = nfmDisplayEntries(parsed);
  const hasFields = entries.length > 0;
  const ctaTitle = content.flow_name?.trim() || 'Flow form';

  if (hasFields) {
    const lines = entries.slice(0, 6).map(([k, v]) => {
      const label = resolveNfmFieldLabel(k, content, clientLabelMap ?? null);
      const val = formatNfmFieldDisplayValue(k, v, optionLookup ?? null).replace(/\s+/g, ' ').trim();
      return `${label}: ${val}`.slice(0, 220);
    });
    return { ctaTitle, lines, hasFields: true };
  }

  const body = content.flow_body?.trim();
  const lines: string[] = [];
  if (body && !isGenericFlowBody(body, content.flow_name)) {
    lines.push(body);
  }
  return { ctaTitle, lines, hasFields: false };
}

/** One line for conversation list + SSE last message text. */
export function buildNfmPreviewSingleLine(
  content: NfmContentLike,
  clientLabelMap?: Record<string, string> | null,
  optionLookup?: Record<string, string> | null,
): string {
  const { ctaTitle, lines, hasFields } = buildNfmInboxSummary(
    content,
    clientLabelMap ?? null,
    optionLookup ?? null,
  );
  if (hasFields && lines.length > 0) {
    return `${ctaTitle} — ${lines.slice(0, 3).join(' · ')}`.slice(0, 280);
  }
  if (lines.length > 0) return lines[0];
  return ctaTitle || 'Flow submitted';
}

export function getById<T extends HTMLElement = HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

export function clickIfEnabled(el: HTMLElement | null): boolean {
  if (!el) return false;
  const disabled = (el as HTMLButtonElement).disabled;
  if (disabled) return false;
  // Radix primitives (Tabs / segmented triggers) activate on the POINTER sequence,
  // NOT a bare synthetic .click() — without this, tab-gated flows can't switch tabs.
  // Dispatch the full sequence first, then the native click for plain buttons/links.
  try {
    const o: PointerEventInit = { bubbles: true, cancelable: true, view: window };
    el.dispatchEvent(new PointerEvent("pointerdown", o));
    el.dispatchEvent(new MouseEvent("mousedown", o));
    el.dispatchEvent(new PointerEvent("pointerup", o));
    el.dispatchEvent(new MouseEvent("mouseup", o));
  } catch { /* PointerEvent may be unavailable (e.g. jsdom) — the native click below still fires */ }
  el.click();
  return true;
}

export function setNativeInputValue(el: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = Object.getPrototypeOf(el);
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function textIncludes(target: string): boolean {
  const bodyText = document.body?.innerText?.toLowerCase() || "";
  return bodyText.includes(target.toLowerCase());
}

export function queryButtonByText(text: string): HTMLButtonElement | null {
  const buttons = Array.from(document.querySelectorAll("button")) as HTMLButtonElement[];
  const wanted = text.toLowerCase();
  return buttons.find((btn) => (btn.innerText || "").toLowerCase().includes(wanted)) || null;
}

export interface TemplateDisplayButton {
  title: string;
  type?: string;
  url?: string;
  phone_number?: string;
}

export interface TemplateInfo {
  name: string;
  body: string | null;
  header: string | null;
  footer: string | null;
  components?: Array<{
    type?: string;
    buttons?: Array<{
      type?: string;
      text?: string;
      url?: string;
      phone_number?: string;
    }>;
  }>;
}

export interface OrderLineItem {
  product_retailer_id?: string;
  quantity?: number;
  item_price?: number | string;
  currency?: string;
  name?: string;
  image_url?: string;
}

export interface OrderDisplayData {
  catalog_id?: string;
  text?: string;
  items: OrderLineItem[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function defaultButtonLabel(btnType?: string): string {
  switch ((btnType || '').toUpperCase()) {
    case 'URL':
      return 'Visit Website';
    case 'PHONE_NUMBER':
      return 'Call';
    case 'CATALOG':
      return 'View Catalog';
    case 'FLOW':
      return 'Open Flow';
    case 'COPY_CODE':
      return 'Copy Code';
    case 'VOICE_CALL':
      return 'Call on WhatsApp';
    case 'QUICK_REPLY':
      return 'Quick Reply';
    default:
      return 'Button';
  }
}

export function templateButtonsFromComponents(
  components?: TemplateInfo['components'],
): TemplateDisplayButton[] {
  if (!Array.isArray(components)) return [];

  const buttons: TemplateDisplayButton[] = [];
  for (const comp of components) {
    if (String(comp?.type || '').toUpperCase() !== 'BUTTONS') continue;
    for (const btn of comp.buttons || []) {
      buttons.push({
        title: btn.text || defaultButtonLabel(btn.type),
        type: btn.type,
        url: btn.url,
        phone_number: btn.phone_number,
      });
    }
  }
  return buttons;
}

export function extractTemplateButtons(
  contentInput: Record<string, unknown> | unknown,
  templates: Record<string, TemplateInfo>,
): TemplateDisplayButton[] {
  const content = parseContentRecord(contentInput);
  const storedButtons = content.buttons;
  if (Array.isArray(storedButtons) && storedButtons.length > 0) {
    return storedButtons.map((btn: any) => ({
      title: btn.title || btn.text || defaultButtonLabel(btn.type),
      type: btn.type,
      url: btn.url,
      phone_number: btn.phone_number,
    }));
  }

  const templateName = String(content.template_name || content.name || '');
  const cached = templateName ? templates[templateName] : undefined;
  const fromCache = templateButtonsFromComponents(cached?.components);
  if (fromCache.length > 0) return fromCache;

  const components = content.components;
  if (Array.isArray(components)) {
    return templateButtonsFromComponents(components as TemplateInfo['components']);
  }

  return [];
}

function normalizeOrderItems(rawItems: unknown): OrderLineItem[] {
  if (!Array.isArray(rawItems)) return [];

  return rawItems
    .map((raw) => {
      const item = asRecord(raw);
      if (!item) return null;

      const amount = asRecord(item.amount);
      let itemPrice = item.item_price;
      if (itemPrice == null && amount) {
        const value = Number(amount.value);
        const offset = Number(amount.offset || 100);
        if (!Number.isNaN(value) && offset > 0) {
          itemPrice = value / offset;
        }
      }

      return {
        product_retailer_id: String(
          item.product_retailer_id || item.retailer_id || item.id || '',
        ),
        quantity: Number(item.quantity ?? 1) || 1,
        item_price: itemPrice as number | string | undefined,
        currency: String(item.currency || 'INR'),
        name: typeof item.name === 'string' ? item.name : typeof item.product_name === 'string' ? item.product_name : undefined,
        image_url: typeof item.image_url === 'string' ? item.image_url : undefined,
      } satisfies OrderLineItem;
    })
    .filter(Boolean) as OrderLineItem[];
}

function parseContentRecord(content: unknown): Record<string, unknown> {
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      return asRecord(parsed) || {};
    } catch {
      return {};
    }
  }
  return asRecord(content) || {};
}

export function extractOrderData(content: unknown): OrderDisplayData {
  const record = parseContentRecord(content);
  const nestedOrder = asRecord(record.order) || {};
  const rawMessage = asRecord(record.raw) || {};
  const rawOrder = asRecord(rawMessage.order) || {};

  const catalog_id = String(
    record.catalog_id || nestedOrder.catalog_id || rawOrder.catalog_id || '',
  ) || undefined;
  const text = String(record.text || nestedOrder.text || rawOrder.text || '') || undefined;
  const items = normalizeOrderItems(
    record.product_items
      || nestedOrder.product_items
      || nestedOrder.items
      || rawOrder.product_items
      || rawOrder.items,
  );

  return { catalog_id, text, items };
}

export function sanitizeCatalogImageUrl(url: string): string {
  if (!url) return '';
  const cleaned = url.trim();
  if (!cleaned) return '';

  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /docs\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?(?:export=download&)?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?id=([a-zA-Z0-9_-]+)(?:&export=download)?/,
    /lh3\.googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match?.[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  return cleaned;
}

/** Build proxied image URL so inbox can load Drive/Meta catalog images reliably. */
export function getOrderProductImageSrc(
  item: OrderLineItem,
  apiPrefix: string,
  workspaceId?: string | null,
): string | null {
  const rawUrl = item.image_url?.trim();
  const productId = item.product_retailer_id?.trim();

  if (!rawUrl && !productId) return null;

  const params = new URLSearchParams();
  if (workspaceId) params.set('workspace_id', workspaceId);
  if (productId) params.set('product_id', productId);
  if (rawUrl) params.set('url', sanitizeCatalogImageUrl(rawUrl));

  return `${apiPrefix}/catalogs/product-image?${params.toString()}`;
}

export function formatOrderPrice(item: OrderLineItem): string {
  if (item.item_price == null || item.item_price === '') return '';
  const currency = item.currency || 'INR';
  const numeric = Number(item.item_price);
  if (Number.isNaN(numeric)) return `${currency} ${item.item_price}`;
  return `${currency} ${numeric.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

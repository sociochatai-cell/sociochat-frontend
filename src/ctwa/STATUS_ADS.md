# WhatsApp Status Ads — Module Guide & API Info

This document explains the **WhatsApp Status Ads** feature: what it is, how it is
wired into the app, the Meta Marketing API calls behind it, and how to create one
to see it working.

> **TL;DR** — A Status Ad is a normal Meta **Messages** campaign whose ad-set
> **placement is pinned to `whatsapp` → `status`**. It reuses the existing CTWA
> ad engine (`/api/ctwa/*`). The only new thing vs a Click-to-WhatsApp ad is the
> `placement` + `ad_type: 'status'` fields on the create-campaign payload.

---

## 1. What it is

| | |
|---|---|
| **Placement** | WhatsApp → Status (the full-screen feed in the Updates tab) |
| **Format** | Vertical **9:16**, recommended **1080 × 1920 px**; video ≤ **30s** |
| **On tap** | Opens a WhatsApp chat with the business number (pre-filled message / ice breakers) |
| **Objective** | `OUTCOME_ENGAGEMENT` (Messages), optimized for conversations |
| **Billed to** | The tenant's **Meta Ad Account** (their budget, not ours) |

Status Ads are **not** a separate Meta API — they are the standard Marketing API
with a specific placement. That is why we reuse the CTWA engine.

---

## 2. Where it lives in the code

| Concern | File |
|---|---|
| Feature flag | `src/config/featureGating.ts` → `whatsapp_status_ads` |
| Sidebar tile | `src/whatsapp/components/NavigationCommandCenter.tsx` (`id: 'status_ads'`) |
| Route | `src/App.tsx` → `/ctwa/status/create` |
| **Page (wizard)** | `src/ctwa/pages/StatusAdCreatorWizard.tsx` |
| Shared types | `src/ctwa/types.ts` → `PlacementSpec`, `AdType`, `CreateCampaignData.placement` |
| API client | `src/ctwa/api.ts` → `createCampaign`, `publishCampaign`, `getCTWAAccounts` |

The wizard is a sibling of `AdCreatorWizard.tsx` (CTWA). The **only** functional
delta is in `buildCampaignData()`:

```ts
ad_type: 'status',
placement: { publisher_platforms: ['whatsapp'], whatsapp_positions: ['status'] },
```

---

## 3. Frontend → Backend flow

```
StatusAdCreatorWizard
  → createCampaign(data)        POST /api/ctwa/campaigns        (saves DRAFT in our DB)
  → publishCampaign(id)         POST /api/ctwa/campaigns/:id/publish   (pushes to Meta)
```

The create payload (`CreateCampaignData`) for a Status Ad looks like:

```jsonc
{
  "workspace_id": "4",
  "ad_account_id": "act_123456789",
  "name": "Diwali Status Ad 2026",
  "ad_type": "status",                                  // NEW
  "placement": {                                        // NEW
    "publisher_platforms": ["whatsapp"],
    "whatsapp_positions": ["status"]
  },
  "daily_budget": 500,
  "budget_currency": "INR",
  "page_id": "1112223334",
  "whatsapp_phone_number_id": "9998887776",
  "targeting": {
    "geo_locations": { "countries": ["IN"] },
    "age_min": 18, "age_max": 65, "genders": [0]
  },
  "creative": {
    "primary_text": "Festive offers are live!",
    "headline": "Shop now",
    "media_type": "image",
    "media_url": "https://cdn.example.com/status-1080x1920.jpg",
    "prefilled_message": "Hi! I saw your Status ad and want to know more."
  }
}
```

---

## 4. Meta Marketing API mapping (backend TODO)

> ⚠️ **The backend must read the new `placement` / `ad_type` fields and forward
> them to Meta.** The frontend already sends them. Below is the exact mapping the
> `/api/ctwa/campaigns/:id/publish` handler needs to produce.

**Prereqs on the Meta app:** `ads_management`, `ads_read`, `business_management`
scopes, App Review + Advanced Access, Business Verification, and a System User
token for the tenant's Ad Account.

### a) Campaign
```
POST /act_<AD_ACCOUNT_ID>/campaigns
{
  "name": "<name>",
  "objective": "OUTCOME_ENGAGEMENT",
  "status": "PAUSED",
  "special_ad_categories": []
}
```

### b) Ad Set — this is where the Status placement is set
```
POST /act_<AD_ACCOUNT_ID>/adsets
{
  "name": "<name> - Ad Set",
  "campaign_id": "<campaign_id>",
  "daily_budget": 50000,                       // minor units (₹500 = 50000 paise)
  "billing_event": "IMPRESSIONS",
  "optimization_goal": "CONVERSATIONS",
  "destination_type": "WHATSAPP",
  "promoted_object": { "page_id": "<PAGE_ID>" },
  "targeting": {
    "geo_locations": { "countries": ["IN"] },
    "age_min": 18, "age_max": 65,

    // 👇 THE STATUS PLACEMENT — from CreateCampaignData.placement
    "publisher_platforms": ["whatsapp"],
    "whatsapp_positions": ["status"]
  },
  "status": "PAUSED"
}
```

### c) Ad Creative (Click-to-WhatsApp CTA on a full-screen asset)
```
POST /act_<AD_ACCOUNT_ID>/adcreatives
{
  "name": "<name> - Creative",
  "object_story_spec": {
    "page_id": "<PAGE_ID>",
    "link_data": {
      "message": "<primary_text>",
      "image_hash": "<uploaded 1080x1920 asset>",
      "call_to_action": {
        "type": "WHATSAPP_MESSAGE",
        "value": {
          "app_destination": "WHATSAPP",
          "whatsapp_number": "<display number>"
        }
      }
    }
  }
}
```

### d) Ad
```
POST /act_<AD_ACCOUNT_ID>/ads
{
  "name": "<name> - Ad",
  "adset_id": "<adset_id>",
  "creative": { "creative_id": "<creative_id>" },
  "status": "PAUSED"
}
```

**Key difference from CTWA:** the CTWA ad-set leaves placements on
auto/Advantage+ (Facebook + Instagram). The Status ad-set **must** send
`publisher_platforms: ["whatsapp"]` + `whatsapp_positions: ["status"]`, otherwise
Meta will not place it in Status.

---

## 5. How to create one (to see it working)

### A. In the UI
1. Log in as a tenant on the **Growth** plan or higher (the tile is gated by
   `whatsapp_status_ads` → min plan `growth`).
2. Open the **Command Center** navigation → click the **Status Ads** tile
   (fuchsia megaphone). Or go directly to `/ctwa/status/create`.
3. Walk the 5 steps: **Accounts → Budget → Creative → Message → Review**.
   - Accounts: pick Ad Account + Facebook Page + WhatsApp number.
   - Creative: upload a **9:16 / 1080×1920** image (or ≤30s video) URL.
4. **Save Draft** (stays local) or **Publish Status Ad** (pushes to Meta).
5. You land on `/ctwa/campaigns` — the campaign list — where the draft/published
   campaign appears.

### B. Verify the placement is correct
- After publish, open **Meta Ads Manager** for that ad account → the new ad set →
  **Placements** should show **WhatsApp → Status** (only).
- Or inspect the outgoing `/adsets` request body and confirm
  `publisher_platforms: ["whatsapp"]` and `whatsapp_positions: ["status"]`.

### C. Quick local smoke test (no Meta call)
Save as **Draft** first — this exercises the whole frontend + `POST
/api/ctwa/campaigns` path and stores `ad_type: 'status'` and the `placement`
object without spending money or hitting Meta. Confirm the row in the campaigns
DB has `ad_type = 'status'`.

---

## 6. Status / what's done vs pending

- ✅ Frontend: feature flag, sidebar tile, route, wizard page, types.
- ✅ Payload carries `ad_type: 'status'` + `placement` to `/api/ctwa/campaigns`.
- ⏳ **Backend TODO:** persist `ad_type` + `placement`, and in the publish
  handler forward `publisher_platforms` / `whatsapp_positions` to the Meta
  `/adsets` call (section 4b). Until then, drafts save but publishing will place
  as a normal CTWA ad.
- ⏳ Optional: filter the campaigns list by `ad_type` so Status vs CTWA are shown
  separately.

---

## 7. Availability caveats (product)

- WhatsApp Status ads rolled out globally (incl. India) in early 2026, but are
  **region-gated** — the EU lagged for regulatory review. If `whatsapp_positions:
  ['status']` is rejected for an account, that account/region isn't enabled yet.
- Pricing is Meta auction (cost-per-conversation); India ≈ ₹15–₹60 per
  conversation depending on audience/creative/competition.

# WhatsApp Automation Module

This module provides complete WhatsApp Business integration for Sociovia, enabling Click-to-WhatsApp (CTWA) ad campaigns.

## 📁 Folder Structure

```
whatsapp_automation/
├── index.ts                    # Main barrel export
├── README.md                   # This documentation
├── api/
│   ├── index.ts               # API barrel export
│   └── whatsappApi.ts         # Centralized WhatsApp API client
├── types/
│   └── index.ts               # TypeScript types for CTWA campaigns
├── components/
│   ├── index.ts               # Components barrel export
│   ├── MultiLocationPicker.tsx # Location targeting with radius
│   ├── IceBreakersEditor.tsx  # Ice breaker button editor
│   ├── MediaPicker.tsx        # AI generation & file upload
│   └── SelectPageModal.tsx    # Facebook/WhatsApp account selector
└── pages/
    ├── index.ts               # Pages barrel export
    ├── EmbeddedSignupStub.tsx # WhatsApp Business onboarding flow
    ├── CreateCTWA.tsx         # CTWA campaign creation wizard
    ├── ConversationsInbox.tsx # WhatsApp conversations inbox
    └── TemplateManager.tsx    # Message template management
```

## 🌐 Backend API Endpoints

All WhatsApp API endpoints are accessed via `/api/whatsapp/*`. Use the `whatsappApi` client for all API calls.

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whatsapp/health` | Module health check |

### WABA Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/link-meta` | Link WhatsApp Business Account |
| GET | `/api/whatsapp/waba?workspace_id={id}` | Get WABA info for workspace |
| GET | `/api/whatsapp/phone-numbers?workspace_id={id}` | Get linked phone numbers |

### Templates
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/templates/sync` | Sync templates from Meta |
| GET | `/api/whatsapp/templates?workspace_id={id}&status=APPROVED` | Get message templates |

### Messaging
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/send-message` | Send a message (text/template/media) |

### Conversations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whatsapp/conversations?workspace_id={id}` | List conversations |
| GET | `/api/whatsapp/conversations/{id}` | Get conversation detail |
| POST | `/api/whatsapp/conversations/{id}/close` | Close conversation |

### CAPI (Conversions API)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/whatsapp/capi/send-lead` | Send lead event to Meta |

### Campaigns
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/whatsapp/campaigns?workspace_id={id}` | List campaigns |
| POST | `/api/whatsapp/campaigns` | Create new campaign |
| POST | `/api/whatsapp/campaigns/{id}/publish` | Publish campaign |

### API Client Usage

```tsx
import { whatsappApi } from '@/whatsapp_automation';

// Check health
const health = await whatsappApi.checkHealth();

// Get WABA info
const wabaInfo = await whatsappApi.getWABA(workspaceId);

// Get phone numbers
const phones = await whatsappApi.getPhoneNumbers(workspaceId);

// Get templates
const templates = await whatsappApi.getTemplates(workspaceId, 'APPROVED');

// Send message
const result = await whatsappApi.sendTextMessage(workspaceId, '+1234567890', 'Hello!');

// Create campaign
const campaign = await whatsappApi.createCampaign(campaignPayload);
```

## 🚀 Routes

### Dashboard Routes (Primary)
| Route | Component | Description |
|-------|-----------|-------------|
| `/dashboard/whatsapp` | `EmbeddedSignupStub` | WhatsApp Automation main entry |
| `/dashboard/whatsapp/setup` | `EmbeddedSignupStub` | WhatsApp Business onboarding |
| `/dashboard/whatsapp/campaign/create` | `CreateCTWA` | Create CTWA campaign |
| `/dashboard/whatsapp/conversations` | `ConversationsInbox` | View and respond to conversations |
| `/dashboard/whatsapp/templates` | `TemplateManager` | Manage message templates |

### Navigation from Dashboard
The Dashboard sidebar includes a "WhatsApp Automation" button with a green message icon that navigates to `/dashboard/whatsapp`.

### Legacy Routes (Backward Compatibility)
| Route | Component |
|-------|-----------|
| `/whatsapp-setup` | `EmbeddedSignupStub` |
| `/workspace/:id/whatsapp-setup` | `EmbeddedSignupStub` |
| `/campaign/create-ctwa` | `CreateCTWA` |
| `/workspace/:id/campaign/create-ctwa` | `CreateCTWA` |

## 📦 Usage

### Import from whatsapp_automation module

```tsx
// Import API client
import { whatsappApi } from '@/whatsapp_automation';

// Import pages
import { 
  EmbeddedSignupStub, 
  CreateCTWA,
  ConversationsInbox,
  TemplateManager
} from '@/whatsapp_automation';

// Import components
import { 
  MultiLocationPicker, 
  IceBreakersEditor,
  MediaPicker,
  SelectPageModal 
} from '@/whatsapp_automation';

// Import types
import type { 
  AudienceLocation,
  IceBreaker,
  CTWAConfig,
  Campaign,
  AdSet,
  Creative 
} from '@/whatsapp_automation';

// Import API types
import type {
  WABAInfo,
  PhoneNumber,
  MessageTemplate,
  Conversation,
  CampaignListItem
} from '@/whatsapp_automation/api';
```

## 🔧 Components

### MultiLocationPicker
Location targeting component with radius support.

```tsx
<MultiLocationPicker
  locations={locations}
  onChange={setLocations}
  maxLocations={10}
/>
```

### IceBreakersEditor
Configure conversation starters for CTWA ads.

```tsx
<IceBreakersEditor
  mode="ice_breakers" // or "prefilled"
  iceBreakers={iceBreakers}
  prefilledMessage={message}
  onModeChange={setMode}
  onIceBreakersChange={setIceBreakers}
  onPrefilledMessageChange={setMessage}
/>
```

### MediaPicker
Media upload with AI generation support.

```tsx
<MediaPicker
  workspaceId={workspaceId}
  selectedMedia={media}
  onMediaChange={setMedia}
  maxMedia={5}
  allowVideo={true}
/>
```

### SelectPageModal
Facebook Page/WhatsApp account selector.

```tsx
<SelectPageModal
  isOpen={isOpen}
  onClose={handleClose}
  onSelect={handleSelect}
  requireWhatsApp={true}
  workspaceId={workspaceId}
/>
```

## 📋 Types

### Core Types
- `AudienceLocation` - Location targeting with radius
- `IceBreaker` - Quick reply button configuration
- `CTWAConfig` - CTWA-specific creative configuration
- `Campaign` - Campaign entity
- `AdSet` - Ad set with targeting
- `Creative` - Ad creative configuration

### API Types
- `CreateCampaignRequest` - Campaign creation payload
- `CreateCampaignResponse` - API response
- `LinkedPage` - Connected Facebook/WhatsApp accounts
- `LinkMetaResponse` - Meta account linking response

### Validation Helpers
- `validateCTWAConfig()` - Validate CTWA configuration
- `validateAudienceLocations()` - Validate location targeting

## 🔗 Dashboard Integration

Add WhatsApp section to Dashboard sidebar:

```tsx
{/* In Dashboard.tsx sidebar */}
<SidebarGroup title="WhatsApp">
  <SidebarItem 
    icon={MessageCircle} 
    href="/dashboard/whatsapp/setup"
  >
    Connect WhatsApp
  </SidebarItem>
  <SidebarItem 
    icon={Send} 
    href="/dashboard/whatsapp/campaign/create"
  >
    Create CTWA Campaign
  </SidebarItem>
</SidebarGroup>
```

## 📝 Meta API Reference

### CTWA Ad Creative JSON Structure
```json
{
  "object_story_spec": {
    "page_id": "123456789",
    "link_data": {
      "call_to_action": {
        "type": "WHATSAPP_MESSAGE",
        "value": {
          "app_destination": "WHATSAPP"
        }
      },
      "page_welcome_message": {
        "type": "VISUAL_EDITOR",
        "ctwa_config": {
          "is_ctwa": true,
          "phone_number_id": "987654321",
          "ice_breakers": [
            { "title": "Learn more", "payload": "LEARN_MORE" },
            { "title": "Get pricing", "payload": "PRICING" }
          ]
        }
      }
    }
  }
}
```

## 🛠️ Development

### Environment Variables
```bash
# .env.local
VITE_API_BASE=https://sociovia-backend-362038465411.europe-west1.run.app/api
```

### Adding New Features
1. Add types to `types/index.ts`
2. Create component in `components/`
3. Export from `components/index.ts`
4. Use in pages or other components

### Testing

#### Install Testing Dependencies (if not already installed)
```bash
npm install -D vitest @testing-library/react @testing-library/user-event @testing-library/jest-dom jsdom
```

#### Add test script to package.json
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

#### Run Tests
```bash
# Run all WhatsApp automation tests
npm run test -- --testPathPattern=whatsapp_automation

# Run specific test file
npm run test -- src/__tests__/MultiLocationPicker.test.tsx
npm run test -- src/__tests__/IceBreakersEditor.test.tsx
npm run test -- src/__tests__/SelectPageModal.test.tsx
```

### Local Development with Mock Data
For local testing without backend, you can use MSW (Mock Service Worker):

```tsx
// src/mocks/handlers.ts
import { rest } from 'msw';

export const handlers = [
  // Mock link-meta endpoint
  rest.post('*/api/link-meta', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        linked: [
          {
            page_id: 'mock_page_123',
            page_name: 'Test Business Page',
            waba_id: 'mock_waba_456',
            phone_number_id: 'mock_phone_789',
          },
        ],
      })
    );
  }),

  // Mock create-campaign endpoint
  rest.post('*/api/create-campaign', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        campaign_id: 'camp_mock_123',
        adset_id: 'adset_mock_456',
        creative_id: 'creative_mock_789',
      })
    );
  }),

  // Mock generate-ai endpoint
  rest.post('*/api/generate-ai', (req, res, ctx) => {
    return res(
      ctx.json({
        success: true,
        images: [
          { id: 'img_1', url: 'https://picsum.photos/400/400?1' },
          { id: 'img_2', url: 'https://picsum.photos/400/400?2' },
        ],
      })
    );
  }),
];
```

## 🔌 API Contracts

### POST /api/link-meta
Link Meta Business accounts (Facebook Page + WhatsApp Business).

**Request:**
```json
{
  "workspace_id": "ws_123",
  "action": "list" // or "link"
}
```

**Response:**
```json
{
  "success": true,
  "linked": [
    {
      "page_id": "123456789",
      "page_name": "My Business Page",
      "waba_id": "waba_001",
      "phone_number_id": "phone_001",
      "instagram_account_id": "ig_001"
    }
  ]
}
```

### POST /api/create-campaign
Create a complete CTWA campaign (campaign + ad set + creative).

**Request:**
```json
{
  "workspace_id": "ws_123",
  "campaign": {
    "name": "Summer Sale CTWA",
    "objective": "OUTCOME_ENGAGEMENT",
    "status": "DRAFT"
  },
  "adset": {
    "name": "Summer Sale - Ad Set",
    "daily_budget": 50000,
    "start_time": "2025-01-01T00:00:00Z",
    "optimization_goal": "CONVERSATIONS",
    "destination_type": "WHATSAPP",
    "targeting": {
      "locations": [
        {
          "id": "loc_1",
          "query": "Mumbai",
          "type": "city",
          "lat": 19.076,
          "lon": 72.877,
          "radius_meters": 25000,
          "included": true
        }
      ],
      "age_min": 18,
      "age_max": 65,
      "gender": "all"
    }
  },
  "creative": {
    "name": "Summer Sale Creative",
    "method": "upload",
    "media_urls": ["https://..."],
    "primary_text": "Shop our summer collection!",
    "headline": "Summer Sale",
    "call_to_action": "WHATSAPP_MESSAGE",
    "ctwa_config": {
      "is_ctwa": true,
      "page_id": "123456789",
      "phone_number_id": "phone_001",
      "ice_breakers": [
        { "id": "ib_1", "title": "Shop now", "payload": "SHOP" },
        { "id": "ib_2", "title": "Get help", "payload": "HELP" }
      ]
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "campaign_id": "camp_123",
  "adset_id": "adset_456",
  "creative_id": "creative_789"
}
```

### POST /api/generate-ai
Generate ad images using AI.

**Request:**
```json
{
  "workspace_id": "ws_123",
  "prompt": "Professional product photo of smartphone",
  "style": "realistic",
  "num_images": 4
}
```

**Response:**
```json
{
  "success": true,
  "images": [
    { "id": "gen_1", "url": "https://..." },
    { "id": "gen_2", "url": "https://..." }
  ]
}
```

## 📚 Related Documentation

- [Meta CTWA Documentation](https://developers.facebook.com/docs/whatsapp/business-management-api/click-to-whatsapp-ads)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Meta Marketing API](https://developers.facebook.com/docs/marketing-apis)

# WhatsApp Test Console

## Overview

The WhatsApp Test Console is an **internal developer tool** for testing the WhatsApp Cloud API integration. It is NOT customer-facing.

**Route:** `/dashboard/whatsapp/test`

## Purpose

- Test WhatsApp Cloud API manually without Postman/cURL
- Validate template payloads, message structure, and API routes
- Debug message delivery issues
- Verify token permissions and configuration

## Supported Message Types

| Type | Description | API Endpoint |
|------|-------------|--------------|
| **Text** | Plain text messages | `POST /api/whatsapp/send/text` |
| **Template** | Pre-approved template messages | `POST /api/whatsapp/send/template` |
| **Template (Advanced)** | Templates with image headers | `POST /api/whatsapp/send/template/advanced` |
| **Media** | Images, videos, audio, documents | `POST /api/whatsapp/send/media` |
| **Interactive** | Buttons and list menus | `POST /api/whatsapp/send/interactive` |

---

## How to Use

### Step 1: Get a Temporary Token

1. Go to [Meta Developer Console](https://developers.facebook.com/)
2. Select your app → **WhatsApp** → **API Setup**
3. Under "Temporary access token", click **Generate new token**
4. Select permissions:
   - ✅ `whatsapp_business_messaging`
   - ✅ `whatsapp_business_management`
5. Copy the token

⚠️ **Token expires in 1 hour!**

### Step 2: Configure the Console

1. Navigate to `/dashboard/whatsapp/test`
2. Paste your access token in the Token field
3. Enter your Phone Number ID (found in Meta Developer Console)
4. Click "Save to Browser" (stores in localStorage only)

### Step 3: Send a Test Message

1. Enter recipient phone number (E.164 format: `919876543210`)
2. Select message type (start with **Template**)
3. For template: use `hello_world` (pre-approved for testing)
4. **DO NOT add body variables** for `hello_world` - it has none!
5. Click "Send Message"
6. Check the API Response panel

---

## Template Messages

### The `hello_world` Template

The `hello_world` template is **pre-approved by Meta** for testing. It has:
- ❌ NO header
- ❌ NO body variables (don't add any!)
- ❌ NO buttons

**Correct usage:**
```json
{
  "to": "919876543210",
  "template_name": "hello_world",
  "language": "en_US"
}
```

**WRONG - will fail with Error 132000:**
```json
{
  "to": "919876543210",
  "template_name": "hello_world",
  "language": "en_US",
  "params": ["John"]  // ❌ hello_world has NO variables!
}
```

### Creating Custom Templates

To create templates with images and variables:

#### Step 1: Go to Meta Business Suite
1. Open [business.facebook.com](https://business.facebook.com)
2. Select your WhatsApp Business Account
3. Go to **WhatsApp Manager** → **Account tools** → **Message templates**

#### Step 2: Create Template
| Field | Description | Example |
|-------|-------------|---------|
| **Name** | lowercase_with_underscores | `order_confirmation` |
| **Category** | Marketing, Utility, or Authentication | `UTILITY` |
| **Language** | Select language | `English (US)` |

#### Step 3: Add Components

**Header (for images):**
- Select Header type: `Image`
- Image URL is provided when sending (dynamic)

**Body (with variables):**
```
Hi {{1}}!

Your order #{{2}} has been confirmed.
Total: {{3}}

Thank you for shopping with us!
```

**Footer:** Optional static text

**Buttons:** Quick Reply or Call-to-Action

#### Step 4: Submit & Wait
- Submit for approval
- Wait 24-48 hours for Meta review
- Status changes from `PENDING` to `APPROVED`

### Sending Templates with Images

When you select **Header type: Image** in the Test Console:
- The advanced endpoint (`/send/template/advanced`) is used automatically
- Provide a **publicly accessible HTTPS URL** for the image

**Example payload:**
```json
{
  "to": "919876543210",
  "template_name": "promo_offer",
  "language": "en_US",
  "header_image_url": "https://example.com/banner.jpg",
  "body_params": ["John", "Summer", "50%"]
}
```

---

## Interactive Messages

### Payload Structure

Interactive messages use a **nested structure**:

**Buttons:**
```json
{
  "to": "919876543210",
  "interactive": {
    "type": "button",
    "body": "Choose an option",
    "header": "Optional Header",
    "footer": "Optional Footer",
    "buttons": [
      {"id": "btn1", "title": "Option 1"},
      {"id": "btn2", "title": "Option 2"}
    ]
  }
}
```

**List:**
```json
{
  "to": "919876543210",
  "interactive": {
    "type": "list",
    "body": "Select from menu",
    "button": "View Options",
    "sections": [
      {
        "title": "Section 1",
        "rows": [
          {"id": "row1", "title": "Item 1", "description": "Description"}
        ]
      }
    ]
  }
}
```

### Limits
- **Buttons:** Maximum 3 buttons, title max 20 characters
- **List:** Maximum 10 sections, 10 rows per section

---

## Common Errors

| Error Code | Message | Cause | Solution |
|------------|---------|-------|----------|
| **10** | Application does not have permission | Token lacks permissions | Regenerate token with `whatsapp_business_messaging` |
| **100** | Invalid parameter | Wrong template name/language | Check exact template name and language code |
| **131047** | Template rejected | Policy violation | Review template content |
| **132000** | Number of parameters does not match | Wrong number of variables | Check template's actual variable count |
| **400** | Phone number is required | Empty payload | Ensure JSON body is sent correctly |

### Why wamid Exists But Message Not Delivered?

A `wamid` (WhatsApp Message ID) does NOT guarantee delivery:

1. **Token lacks permissions** - Error 10
2. **Template not approved** - API accepts but Meta rejects delivery
3. **24-hour window** - Text messages need user to message first
4. **Test number not added** - Recipient must be in test numbers

---

## Configuration Storage

All configuration is stored in **browser localStorage only**:

| Key | Description |
|-----|-------------|
| `wa_test_access_token` | WhatsApp API access token |
| `wa_test_phone_number_id` | Phone Number ID |
| `wa_test_waba_id` | WhatsApp Business Account ID |
| `wa_test_api_version` | API version (default: v22.0) |

❌ Tokens are **never** sent to our backend storage.

---

## File Structure

```
frontend/src/whatsapp/
├── api.ts                      # API client (custom fetch with auth)
├── types.ts                    # TypeScript definitions
├── index.ts                    # Module exports
├── README.md                   # This file
├── components/
│   ├── index.ts                # Component exports
│   ├── TokenConfigPanel.tsx    # Auth configuration
│   ├── MessageTargetForm.tsx   # Recipient input (E.164 validation)
│   ├── MessageTypeTabs.tsx     # Type selector tabs
│   ├── TextComposer.tsx        # Text message form
│   ├── TemplateComposer.tsx    # Template message form
│   ├── MediaComposer.tsx       # Media message form
│   ├── InteractiveComposer.tsx # Interactive message form
│   └── ApiResponseViewer.tsx   # Response display with JSON
└── pages/
    ├── index.ts                # Page exports
    └── WhatsAppTestConsole.tsx # Main console page
```

---

## API Integration

This module uses a **dedicated fetch wrapper** (`waRequest`) for WhatsApp API calls:

```typescript
// Headers sent with each request
{
  "Content-Type": "application/json",
  "Authorization": "Bearer <whatsapp_access_token>"
}
```

### Backend Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/send/text` | POST | Send text message |
| `/api/whatsapp/send/template` | POST | Send simple template |
| `/api/whatsapp/send/template/advanced` | POST | Send template with image header |
| `/api/whatsapp/send/media` | POST | Send media message |
| `/api/whatsapp/send/interactive` | POST | Send interactive message |
| `/api/whatsapp/conversations` | GET | List conversations |
| `/api/whatsapp/conversations/:id` | GET | Get conversation details |
| `/api/whatsapp/health` | GET | Health check |

---

## Quick Test Checklist

- [ ] Token pasted and saved
- [ ] Phone Number ID configured
- [ ] Recipient number in E.164 format (digits only, with country code)
- [ ] Using `hello_world` template for first test
- [ ] **NO body variables added** for `hello_world`
- [ ] Language code is `en_US` (exact match required)
- [ ] Check API Response panel for errors
- [ ] If wamid returned but no delivery, check Meta console logs

---

## Troubleshooting

### "Phone number is required" but I entered it
- Ensure the frontend dev server is restarted after code changes
- Check browser Network tab to see actual payload being sent

### "Body text is required" for Interactive
- Interactive messages require nested structure: `interactive.body` not `body_text`

### Template works in Postman but not here
- Check exact payload format in API Response → "Payload Sent"
- Compare with working Postman request

### Error 132000: Parameter count mismatch
- Your template has fewer/more variables than you're sending
- `hello_world` has **0 variables** - don't add any!

---

## Phase-1 Part-3: Inbox UI

### Overview

The WhatsApp Inbox UI is an **internal/admin-facing** interface for viewing conversations and messages stored by the backend. It provides a WhatsApp Web-like experience for monitoring and responding to customer messages.

**Route:** `/dashboard/whatsapp/inbox`

### Purpose

- **View conversations** stored by the backend webhook ingestion
- **Read incoming/outgoing messages** in chronological order
- **Verify webhook ingestion visually** - see messages appear as they're received
- **Quick reply testing** - send text messages to validate 24-hour window behavior
- **NO automation logic yet** - this is Phase-1, manual interaction only

### Features

#### Conversations List (Left Panel)
- Shows all conversations sorted by last message time (newest first)
- Displays contact phone number and name (if available)
- Shows last message preview (truncated)
- Unread count badge for conversations with unread messages
- Conversation status indicator (open/closed)
- Auto-refreshes every 10 seconds

#### Message Thread (Right Panel)
- Chronological message display (oldest to newest)
- Visual distinction:
  - **Incoming messages**: Left-aligned, muted background
  - **Outgoing messages**: Right-aligned, primary color background
- Message type support:
  - **Text**: Full text display
  - **Template**: Shows template name and body
  - **Media** (image/video/audio/document): Placeholder with type icon
  - **Interactive**: Shows body, header, footer
- Delivery status for outgoing messages:
  - ✅ Sent (single check)
  - ✅✅ Delivered (double check)
  - ✅✅ Read (blue double check)
  - ❌ Failed (error icon with message)
- Auto-refreshes every 5 seconds when conversation is open

#### Message Composer
- Simple text input at bottom of thread
- **Phase-1 limitation**: Text messages only
- Templates and other message types remain in Test Console
- Enter key to send (Shift+Enter for new line)
- Validates 24-hour window behavior

### Real-Time Updates

**Phase-1 uses polling, NOT websockets:**

- **Conversations list**: Polls every 10 seconds
- **Message thread**: Polls every 5 seconds when conversation is selected
- **Why polling?** 
  - Simpler implementation for Phase-1
  - No websocket infrastructure required
  - Sufficient for internal/admin use
  - Can upgrade to websockets in future phases

**Known Limitations:**
- No typing indicators
- No media preview (shows placeholder only)
- No read receipts in real-time (updates on next poll)
- Slight delay (5-10 seconds) before new messages appear

### How It Validates Webhook Ingestion

1. **Send a message** via Test Console or external WhatsApp
2. **Watch the Inbox** - messages should appear within 5-10 seconds
3. **Verify message content** matches what was sent
4. **Check message direction** - incoming vs outgoing
5. **Confirm status updates** - delivery/read receipts appear as webhooks are processed

This provides visual confirmation that:
- Webhooks are being received by the backend
- Messages are being stored in the database
- The webhook processor is working correctly

### File Structure

```
frontend/src/whatsapp/
├── pages/
│   ├── WhatsAppInbox.tsx          # Main inbox page
│   └── WhatsAppTestConsole.tsx    # Test console (Part-2)
├── components/
│   ├── ConversationList.tsx       # Left panel - conversations list
│   ├── ConversationItem.tsx       # Single conversation row
│   ├── ConversationThread.tsx     # Right panel - message thread
│   ├── MessageBubble.tsx          # Individual message display
│   ├── MessageComposer.tsx        # Text input for sending
│   └── EmptyState.tsx             # Empty state placeholder
├── hooks/
│   └── useWhatsAppPolling.ts      # Polling hook for auto-refresh
├── api.ts                         # API client (updated with inbox functions)
└── types.ts                       # TypeScript definitions (updated)
```

### API Endpoints Used

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/whatsapp/conversations` | GET | List all conversations |
| `/api/whatsapp/conversations/:id/messages` | GET | Get messages for a conversation |
| `/api/whatsapp/send/text` | POST | Send text message from inbox |

### Authentication

The Inbox UI uses **hybrid authentication**:
1. **Primary**: Token from localStorage (same as Test Console)
2. **Fallback**: Session-based auth (cookies) if no token available

This allows the Inbox to work with or without a configured token, making it more flexible for different deployment scenarios.

### Usage

1. **Navigate to** `/dashboard/whatsapp/inbox`
2. **Select a conversation** from the left panel
3. **View messages** in the right panel
4. **Send a reply** using the text input at the bottom
5. **Watch for updates** - messages refresh automatically every 5 seconds

### Next Steps (Future Phases)

- **Phase-2 Part-2**: WebSocket integration for real-time updates
- **Phase-3**: Media preview and download
- **Phase-4**: Typing indicators
- **Phase-5**: Automation rules and triggers

---

## Phase-2 Part-1: WhatsApp Business Account Integration

### Overview

Phase-2 Part-1 introduces **Meta OAuth Popup Flow** to connect permanent WhatsApp Business Accounts. This eliminates the need for 1-hour test tokens and enables workspace-level WhatsApp account management.

**Route:** `/whatsapp/settings?workspace_id=<id>`

### Purpose

- **Connect permanent WhatsApp Business Accounts** via Meta OAuth
- **Store encrypted access tokens** securely in database
- **Workspace-level account management** - each workspace can have its own account
- **Automatic token usage** - Inbox and sending use stored tokens automatically
- **No more manual token entry** for production use

### OAuth Popup Flow

The connection process uses a popup-based OAuth flow (same pattern as Facebook Page linking):

```
┌─────────────────────┐                    ┌─────────────────────┐
│   Frontend (8080)   │                    │   Backend (5000)    │
├─────────────────────┤                    ├─────────────────────┤
│                     │                    │                     │
│  Click "Connect"    │───────────────────►│  /connect/popup     │
│                     │                    │  (redirects to FB)  │
│                     │                    │                     │
│  ◄──── FB OAuth popup opens ────────────►│                     │
│                     │                    │                     │
│  User grants perms  │                    │                     │
│                     │                    │                     │
│  ◄──── FB redirects with code ──────────►│  /connect/callback  │
│                     │                    │  - Exchange token   │
│                     │                    │  - Fetch WABA       │
│                     │                    │  - Save to DB       │
│                     │                    │                     │
│  postMessage ◄───────────────────────────│  (popup closes)     │
│  received           │                    │                     │
│                     │                    │                     │
│  Refresh accounts   │                    │                     │
└─────────────────────┘                    └─────────────────────┘
```

### Backend API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/connect/popup` | GET | Redirects to Facebook OAuth URL |
| `/api/whatsapp/connect/callback` | GET | Handles OAuth callback, exchanges token, saves account |
| `/api/whatsapp/connect/start` | GET | Returns config for SDK-based flow (optional) |
| `/api/whatsapp/connect/complete` | POST | Complete connection with code (SDK flow) |
| `/api/whatsapp/accounts` | GET | List connected accounts (no tokens exposed) |
| `/api/whatsapp/accounts/:id/unlink` | PATCH | Soft delete - deactivates account (keeps data) |
| `/api/whatsapp/accounts/:id` | DELETE | Permanent delete - removes account and all data |

### Frontend Components

| Component | Purpose |
|-----------|---------|
| `WhatsAppSettings.tsx` | Main settings page with account list |
| `ConnectWhatsAppButton.tsx` | Opens OAuth popup, listens for completion |
| `WhatsAppAccountCard.tsx` | Displays account info with Unlink/Delete buttons |
| `ConnectionStatusBadge.tsx` | Shows active/inactive status |

### Account Management

**Unlink (Soft Delete):**
- Sets `is_active = false`
- Keeps all data (conversations, messages)
- Account can be re-linked later
- Orange unlink button

**Delete (Hard Delete):**
- Permanently removes account record
- Deletes all related conversations and messages
- Cannot be undone
- Red trash button with confirmation

### Environment Variables Required

```env
# Meta OAuth Configuration
FB_APP_ID=1782321995750055
FB_APP_SECRET=your_app_secret
FB_API_VERSION=v22.0

# WhatsApp Embedded Signup Config ID (from Meta Developer Console)
WHATSAPP_CONFIG_ID=1210552324305744

# OAuth Redirect (must be HTTPS for production)
# Use DevTunnel URL for local development
OAUTH_REDIRECT_BASE=https://sociovia-backend-362038465411.europe-west1.run.app

# Frontend URL (for postMessage targetOrigin)
FRONTEND_BASE_URL=https://sociovia.com

# Token Encryption
WHATSAPP_ENCRYPTION_KEY=your_base64_encryption_key
```

### DevTunnel Setup (Local Development)

Since Meta OAuth requires HTTPS endpoints, use VSCode DevTunnels:

1. **Forward port 5000** (backend) via DevTunnel
2. **Update `.env`:**
   ```env
   OAUTH_REDIRECT_BASE=https://your-tunnel-5000.devtunnels.ms
   ```
3. **Add to Meta Developer Dashboard:**
   - Valid OAuth Redirect URIs: `https://your-tunnel-5000.devtunnels.ms/api/whatsapp/connect/callback`
   - App Domains: `your-tunnel-5000.devtunnels.ms`

### Token Exchange Flow

1. **OAuth code received** → Exchange for short-lived token
2. **Exchange for long-lived token** → Permanent access (60 days+)
3. **Fetch WABA details:**
   - Query `/me/businesses` for owned WhatsApp accounts
   - Extract WABA ID, phone number ID, display number
4. **Encrypt and store** → Token never exposed to frontend

### Database Schema

```sql
-- whatsapp_accounts table
id                      SERIAL PRIMARY KEY
workspace_id            VARCHAR(255)
waba_id                 VARCHAR(64) NOT NULL
phone_number_id         VARCHAR(64) NOT NULL UNIQUE
display_phone_number    VARCHAR(32)
verified_name           VARCHAR(255)
quality_score           VARCHAR(32)
messaging_limit         INTEGER
is_active               BOOLEAN DEFAULT TRUE
access_token_encrypted  TEXT
token_type              VARCHAR(16) DEFAULT 'permanent'
token_expires_at        TIMESTAMP
connected_by_user_id    VARCHAR(64)
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

### Troubleshooting

**"redirect URI is not white-listed"**
- Add callback URL to Meta Developer Console → Facebook Login → Valid OAuth Redirect URIs

**"Could not retrieve WhatsApp Business Account"**
- User must have a WABA linked to their Meta Business Manager
- Ensure `whatsapp_business_management` permission is granted

**Popup opens but nothing happens after OAuth**
- Check `FRONTEND_BASE_URL` matches your browser URL exactly
- Check browser console for postMessage errors
- Verify backend logs for token exchange errors

**"Session flickers between login/dashboard"**
- Use consistent URL (either `localhost` or `127.0.0.1`, not both)
- Session cookies are domain-specific

### Testing the Flow

1. Start backend: `python test.py`
2. Start frontend: `npm run dev`
3. Access: `https://sociovia.com/whatsapp/settings?workspace_id=4`
4. Click "Connect WhatsApp"
5. Complete OAuth in popup
6. Verify account appears in list
7. Test Unlink (should hide account)
8. Test Delete (should remove permanently)

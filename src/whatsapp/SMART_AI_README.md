# WhatsApp Smart AI Chatbot - Complete Documentation

## 🤖 Overview

The WhatsApp Smart AI Chatbot is an intelligent customer service automation powered by **Google Gemini 2.0 Flash** that provides real-time, context-aware responses to customer messages. It serves as the fallback handler when no other automation rules match, ensuring every customer message gets a response.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Feature Components](#feature-components)
3. [Backend Implementation](#backend-implementation)
4. [Frontend Implementation](#frontend-implementation)
5. [Database Schema](#database-schema)
6. [AI Configuration](#ai-configuration)
7. [FAQ Knowledge Base](#faq-knowledge-base)
8. [Intent Detection](#intent-detection)
9. [API Endpoints](#api-endpoints)
10. [Message Processing Flow](#message-processing-flow)
11. [Security & Safety](#security--safety)
12. [Cost Tracking](#cost-tracking)
13. [File Locations](#file-locations)
14. [Troubleshooting](#troubleshooting)
15. [Future Enhancements](#future-enhancements)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Incoming WhatsApp Message                       │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     Automation Engine                                │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │ 1. Check Welcome Message Rules                                  ││
│  │ 2. Check Away/Business Hours Rules                              ││
│  │ 3. Check Keyword Trigger Rules                                  ││
│  │ 4. Check FAQ Knowledge Base  ←── Instant matching (no API call) ││
│  │ 5. AI Chatbot (Fallback)     ←── Gemini API call                ││
│  └─────────────────────────────────────────────────────────────────┘│
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Google Gemini 2.0 Flash                           │
│                                                                       │
│  • Fast response times (~500-1500ms)                                 │
│  • Safety filters for business context                               │
│  • Context-aware (includes conversation history)                     │
│  • Customizable system prompt per account                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    Response sent to WhatsApp                         │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Feature Components

The Smart AI tab in WhatsApp Automation includes two main components:

### 1. AI Chatbot (Gemini-powered)
- Intelligent conversational responses
- Customizable system prompt
- Configurable fallback message
- Real-time testing interface
- Token usage tracking

### 2. FAQ Knowledge Base
- Pre-defined question/answer pairs
- Keyword-based matching
- Faster than AI (no API call needed)
- Category organization
- Match analytics

### Priority Order
```
FAQ Matching → AI Chatbot (if FAQ doesn't match)
```

The FAQ is checked first because:
- Instant response (no API latency)
- Zero cost (no API calls)
- Guaranteed consistent answers
- AI is used for complex/unexpected questions

---

## Backend Implementation

### AI Chatbot Core

**File:** `backend/Sociovia/whatsapp/ai_chatbot.py`

```python
# Configuration defaults
DEFAULT_MODEL = "gemini-2.0-flash"  # Fast model optimized for chat

# Safety settings for business conversations
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]
```

### Default System Prompt

```python
DEFAULT_SYSTEM_PROMPT = """You are a helpful customer service assistant for a business.

RULES:
1. Be polite, professional, and helpful
2. Keep responses concise (under 300 characters ideal for WhatsApp)
3. If you don't know something, say so honestly
4. Never share sensitive information
5. For complex issues, suggest speaking with a human agent
6. Use simple language, avoid jargon
7. Do NOT use markdown formatting (no **, *, _, etc.)

You are speaking via WhatsApp, so keep messages brief and conversational."""
```

**Why these rules?**

| Rule | Reason |
|------|--------|
| Under 300 characters | WhatsApp messages should be scannable on mobile |
| No markdown | WhatsApp doesn't render markdown; shows ugly asterisks |
| Suggest human agent | Never leave customer stuck; escalation path |
| No sensitive info | Prevent AI from leaking business data |

### WhatsAppAIChatbot Class

```python
class WhatsAppAIChatbot:
    """
    AI-powered chatbot for WhatsApp conversations.
    Thread-safe and fail-safe by design.
    """
    
    def __init__(self, config: AIConfig):
        self.config = config
        self._initialize_gemini()
    
    def _initialize_gemini(self):
        """Initialize with API key from environment."""
        api_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        genai.configure(api_key=api_key)
        
        self.model = genai.GenerativeModel(
            model_name=self.config.model,
            generation_config={
                "max_output_tokens": self.config.max_tokens,
                "temperature": self.config.temperature,
            },
            safety_settings=SAFETY_SETTINGS,
            system_instruction=self.config.system_prompt,
        )
    
    def generate_response(self, message: str, context: List[Dict]) -> ChatResponse:
        """Generate AI response with conversation history."""
        # Build history from previous messages
        chat = self.model.start_chat(history=history)
        response = chat.send_message(message)
        
        # Clean markdown from response
        text = self._clean_markdown(response.text)
        
        # Truncate for WhatsApp (max 1000 chars)
        if len(text) > 1000:
            text = text[:997] + "..."
        
        return ChatResponse(message=text, tokens_used=response.usage_metadata.total_token_count)
```

### AIConfig DataClass

```python
@dataclass
class AIConfig:
    enabled: bool = False
    system_prompt: str = DEFAULT_SYSTEM_PROMPT
    model: str = "gemini-2.0-flash"
    max_tokens: int = 256
    temperature: float = 0.7
    fallback_message: str = "I'm sorry, I couldn't process your request. A team member will assist you soon."
    context_messages: int = 5  # Previous messages to include
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `model` | gemini-2.0-flash | Fast model for chat responses |
| `max_tokens` | 256 | ~200 words max response |
| `temperature` | 0.7 | Balanced creativity/consistency |
| `context_messages` | 5 | How many previous messages to remember |

---

## Frontend Implementation

**File:** `frontend/src/whatsapp/pages/WhatsAppAutomation.tsx`

### AIChatbotSection Component

Located in the "Smart AI" tab of WhatsApp Automation page.

```tsx
function AIChatbotSection({ accountId }: { accountId: number }) {
  const [enabled, setEnabled] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState('');
  const [fallbackMessage, setFallbackMessage] = useState(
    "I'm sorry, I couldn't process your request. A team member will assist you soon."
  );
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState(null);
  
  // Load configuration on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/config`)
      .then(res => res.json())
      .then(data => {
        setEnabled(data.enabled);
        setSystemPrompt(data.system_prompt);
        setFallbackMessage(data.fallback_message);
      });
  }, [accountId]);
  
  // Toggle AI on/off
  const handleToggle = async (checked: boolean) => {
    const endpoint = checked ? 'enable' : 'disable';
    await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/${endpoint}`, {
      method: 'POST',
      credentials: 'include'
    });
    setEnabled(checked);
  };
  
  // Test AI response
  const handleTest = async () => {
    const res = await fetch(`${API_BASE}/api/whatsapp/accounts/${accountId}/ai/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: testMessage })
    });
    const data = await res.json();
    setTestResponse({
      message: data.message,
      tokens: data.tokens_used,
      time: data.response_time_ms
    });
  };
}
```

### UI Features

1. **Enable/Disable Toggle** - Quick switch to turn AI on/off
2. **System Prompt Editor** - Customize AI behavior
3. **Fallback Message** - Message when AI fails
4. **Test Chat** - Test AI responses before going live
5. **Token & Time Display** - See usage metrics for each test

---

## Database Schema

### AI Configuration Storage

AI chatbot settings are stored in the `WhatsAppAutomationRule` table with `rule_type = "ai_chat"`:

```python
# Stored in whatsapp_automation_rules table
{
    "id": 1,
    "workspace_id": "ws_123",
    "account_id": 456,
    "name": "AI Chatbot",
    "rule_type": "ai_chat",      # Identifies this as AI config
    "is_active": True,
    "priority": 999,              # Low priority (fallback)
    "response_config": {
        "system_prompt": "You are a helpful assistant...",
        "fallback_message": "I'm sorry...",
        "max_tokens": 256,
        "temperature": 0.7,
        "context_messages": 5
    },
    "trigger_count": 1234,        # Times AI was used
    "last_triggered_at": "2026-01-07T10:30:00Z"
}
```

**Why store in automation_rules?**
- Unified rule management
- Consistent priority handling
- Same admin interface
- Analytics tracking built-in

---

## AI Configuration

### Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | false | Toggle AI on/off |
| `system_prompt` | string | (see above) | Instructions for AI behavior |
| `fallback_message` | string | "I'm sorry..." | Message when AI fails |
| `max_tokens` | integer | 256 | Maximum response length |
| `temperature` | float | 0.7 | 0=deterministic, 1=creative |
| `context_messages` | integer | 5 | Previous messages to include |

### Customizing System Prompt

Example prompts for different business types:

**E-commerce Store:**
```
You are a customer service assistant for [Brand Name] online store.

CONTEXT:
- We sell fashion apparel and accessories
- Delivery takes 3-5 business days
- Returns accepted within 30 days
- Customer support hours: 9am-6pm IST

BEHAVIOR:
- Help with order tracking, returns, sizing questions
- For payment issues, ask customer to email support@brand.com
- Be friendly but professional
- Keep responses under 200 characters
```

**Restaurant/Food Delivery:**
```
You are the virtual assistant for [Restaurant Name].

CONTEXT:
- We serve North Indian cuisine
- Open 11am-11pm daily
- Delivery via Zomato/Swiggy
- Dine-in reservations available

BEHAVIOR:
- Help with menu questions, reservations, delivery status
- Cannot take orders directly - guide to delivery apps
- Share popular dishes when asked for recommendations
```

---

## FAQ Knowledge Base

### Purpose

FAQs provide instant answers without calling the AI API:

| Feature | FAQ | AI Chatbot |
|---------|-----|------------|
| Response Time | < 50ms | 500-2000ms |
| Cost | Free | ~₹0.02-0.05/message |
| Consistency | 100% consistent | Varies slightly |
| Flexibility | Fixed answers | Dynamic responses |

### FAQ Model

**File:** `backend/Sociovia/whatsapp/faq_models.py`

```python
class WhatsAppFAQ(db.Model):
    __tablename__ = "whatsapp_faqs"
    
    id = db.Column(db.Integer, primary_key=True)
    workspace_id = db.Column(db.String(36), nullable=False)
    account_id = db.Column(db.Integer, nullable=False)
    
    question = db.Column(db.Text, nullable=False)
    answer = db.Column(db.Text, nullable=False)
    keywords = db.Column(JSONB, default=list)  # Auto-extracted or manual
    
    category = db.Column(db.String(64))        # e.g., "Shipping", "Returns"
    match_type = db.Column(db.String(32), default="keywords")  # keywords, exact, contains
    match_threshold = db.Column(db.Float, default=0.3)
    
    is_active = db.Column(db.Boolean, default=True)
    priority = db.Column(db.Integer, default=100)
    
    match_count = db.Column(db.Integer, default=0)  # Analytics
    last_matched_at = db.Column(db.DateTime)
```

### Matching Types

| Type | Description | Use Case |
|------|-------------|----------|
| `keywords` | Match based on keyword overlap | Most common questions |
| `exact` | Exact text match (case-insensitive) | Very specific queries |
| `contains` | Message contains FAQ question | Phrase matching |

### Keyword Extraction

Keywords are automatically extracted from questions:

```python
def extract_keywords_from_question(question: str) -> List[str]:
    # Remove stop words: a, an, the, is, are, what, how, etc.
    # Keep meaningful words: order, delivery, refund, hours, etc.
    
    # Example:
    # "What are your business hours?" → ["business", "hours"]
    # "How do I track my order?" → ["track", "order"]
```

### Match Scoring

```python
def calculate_keyword_match_score(message: str, faq_keywords: List[str]) -> float:
    # Score = matched_keywords / total_faq_keywords
    
    # Example:
    # Message: "What are your business hours today?"
    # Message keywords: ["business", "hours", "today"]
    # FAQ keywords: ["business", "hours"]
    # Matches: ["business", "hours"]
    # Score: 2/2 = 1.0 ✓
```

---

## Intent Detection

### Available Intents

The AI can classify incoming messages into intents for routing:

```python
INTENT_TYPES = [
    "greeting",      # Hello, hi, hey, good morning
    "support",       # Need help, issue, problem, not working
    "sales",         # Pricing, buy, purchase, subscribe
    "info",          # What is, how does, tell me about
    "complaint",     # Angry, upset, refund, cancel
    "appointment",   # Book, schedule, meeting, availability
    "order_status",  # Where is my order, tracking, delivery
    "other"          # Catch-all for unclassified
]
```

### Intent Classification

```python
def classify_intent(message: str) -> IntentResult:
    prompt = f"""Classify the following customer message into ONE of these intents:
    - greeting, support, sales, info, complaint, appointment, order_status, other
    
    Message: "{message}"
    
    Respond with ONLY the intent name (one word, lowercase)."""
    
    response = model.generate_content(prompt)
    return IntentResult(intent=response.text.strip().lower())
```

**Use Cases:**
- Route complaints to human agent
- Fast-track order status queries
- Tag conversations for analytics
- Trigger specific automation flows

---

## API Endpoints

### AI Configuration

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/accounts/{id}/ai/config` | GET | Get AI configuration |
| `/api/whatsapp/accounts/{id}/ai/config` | POST | Update AI configuration |
| `/api/whatsapp/accounts/{id}/ai/enable` | POST | Enable AI chatbot |
| `/api/whatsapp/accounts/{id}/ai/disable` | POST | Disable AI chatbot |
| `/api/whatsapp/accounts/{id}/ai/test` | POST | Test AI response |
| `/api/whatsapp/accounts/{id}/ai/intent` | POST | Classify message intent |
| `/api/whatsapp/accounts/{id}/ai/intents` | GET | List available intents |

### FAQ Management

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/whatsapp/accounts/{id}/faqs` | GET | List all FAQs |
| `/api/whatsapp/accounts/{id}/faqs` | POST | Create FAQ |
| `/api/whatsapp/accounts/{id}/faqs/{faq_id}` | GET | Get single FAQ |
| `/api/whatsapp/accounts/{id}/faqs/{faq_id}` | PUT | Update FAQ |
| `/api/whatsapp/accounts/{id}/faqs/{faq_id}` | DELETE | Delete FAQ |
| `/api/whatsapp/accounts/{id}/faqs/bulk` | POST | Bulk import FAQs |
| `/api/whatsapp/accounts/{id}/faqs/test` | POST | Test FAQ matching |

### Example: Test AI Response

**Request:**
```bash
POST /api/whatsapp/accounts/123/ai/test
Content-Type: application/json

{
  "message": "What are your business hours?",
  "context": []
}
```

**Response:**
```json
{
  "success": true,
  "message": "We're open Monday to Friday, 9am to 6pm IST. How can I help you today?",
  "tokens_used": 45,
  "response_time_ms": 823,
  "error": null
}
```

---

## Message Processing Flow

### Complete Flow (FAQ → AI Fallback)

```
1. INCOMING MESSAGE
   └─ "How do I track my order?"
        │
        ▼
2. CHECK FAQ KNOWLEDGE BASE
   ├─ Extract keywords: ["track", "order"]
   ├─ Search FAQs for matches
   ├─ Calculate match scores
   │
   ├── MATCH FOUND (score ≥ threshold)?
   │      │
   │      ├─ YES → Return FAQ answer immediately
   │      │        "You can track your order at mysite.com/track"
   │      │        (No AI call needed!)
   │      │
   │      └─ NO → Continue to AI
        │
        ▼
3. AI CHATBOT (if FAQ didn't match)
   ├─ Load AI config for account
   ├─ Build context (last 5 messages)
   ├─ Generate Gemini prompt
   ├─ Call Gemini API
   ├─ Clean markdown from response
   ├─ Truncate if > 1000 chars
   │
   └─ Return AI response
        │
        ▼
4. SEND TO WHATSAPP
   └─ Message delivered to customer
```

### Error Handling

```
AI API Call
    │
    ├── SUCCESS → Return AI message
    │
    └── FAILURE (timeout, rate limit, etc.)
            │
            └── Return fallback_message:
                "I'm sorry, I couldn't process your request.
                 A team member will assist you soon."
```

---

## Security & Safety

### Safety Filters

Gemini is configured with safety settings to block inappropriate content:

```python
SAFETY_SETTINGS = [
    {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
    {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_MEDIUM_AND_ABOVE"},
]
```

### Markdown Cleaning

WhatsApp doesn't render markdown, so we strip it:

```python
def _clean_markdown(text: str) -> str:
    # Remove **bold**
    text = re.sub(r'\*\*(.+?)\*\*', r'\1', text)
    # Remove *italic*
    text = re.sub(r'\*(.+?)\*', r'\1', text)
    # Remove `code`
    text = re.sub(r'`(.+?)`', r'\1', text)
    # Remove ```code blocks```
    text = re.sub(r'```.*?```', '', text, flags=re.DOTALL)
    return text
```

### Multi-Tenant Isolation

Each WhatsApp account has its own:
- AI configuration
- System prompt
- FAQ knowledge base
- Token usage tracking

```python
# All queries are scoped to account
ai_rule = WhatsAppAutomationRule.query.filter_by(
    workspace_id=workspace_id,
    account_id=account_id,
    rule_type="ai_chat"
).first()
```

---

## Cost Tracking

### Pricing (Approximate - INR)

| Metric | Cost |
|--------|------|
| Input tokens (1K) | ~₹0.005 |
| Output tokens (1K) | ~₹0.015 |
| Average message | ~₹0.02-0.05 |

### Token Usage

Every AI response logs token usage:

```python
ChatResponse(
    message="...",
    tokens_used=45,      # Total tokens consumed
    model_used="gemini-2.0-flash",
    response_time_ms=823
)
```

### Cost Optimization Tips

1. **Use FAQs First** - Zero cost for common questions
2. **Lower max_tokens** - Set to 256 for concise responses
3. **Reduce context_messages** - Less history = fewer input tokens
4. **Optimize system prompt** - Shorter = fewer tokens per request

---

## File Locations

### Backend Files

| File | Description |
|------|-------------|
| `backend/Sociovia/whatsapp/ai_chatbot.py` | Core AI chatbot logic (476 lines) |
| `backend/Sociovia/whatsapp/ai_routes.py` | AI API endpoints (406 lines) |
| `backend/Sociovia/whatsapp/faq_models.py` | FAQ database models (237 lines) |
| `backend/Sociovia/whatsapp/faq_routes.py` | FAQ API endpoints (545 lines) |
| `backend/Sociovia/whatsapp/__init__.py` | Module exports |

### Frontend Files

| File | Description |
|------|-------------|
| `frontend/src/whatsapp/pages/WhatsAppAutomation.tsx` | Smart AI tab UI (2254 lines) |
| `frontend/src/whatsapp/pages/AutomationOverview.tsx` | Feature overview cards |
| `frontend/src/whatsapp/pages/WhatsAppGuide.tsx` | Feature documentation |

---

## Troubleshooting

### AI Not Responding

1. **Check API Key**
   ```bash
   # Ensure environment variable is set
   echo $GEMINI_API_KEY
   ```

2. **Check AI is Enabled**
   ```bash
   GET /api/whatsapp/accounts/{id}/ai/config
   # Should return { "enabled": true }
   ```

3. **Test AI Endpoint**
   ```bash
   POST /api/whatsapp/accounts/{id}/ai/test
   { "message": "Hello" }
   ```

### FAQ Not Matching

1. **Check Keywords**
   - View FAQ to see extracted keywords
   - Add missing keywords manually

2. **Lower Threshold**
   - Default is 0.3 (30% match)
   - Lower to 0.2 for more matches

3. **Check Active Status**
   - Ensure `is_active: true`

### Slow Responses

| Cause | Solution |
|-------|----------|
| Large context | Reduce `context_messages` to 3 |
| Long responses | Lower `max_tokens` to 128 |
| Cold start | First request is slower; subsequent are cached |

---

## Future Enhancements

### Planned Features

- [ ] **RAG Integration** - Search business documents for answers
- [ ] **Function Calling** - Let AI call backend APIs (check inventory, create tickets)
- [ ] **Voice Message Transcription** - Whisper API for voice-to-text
- [ ] **Multi-language Support** - Hindi, Tamil, Telugu auto-detection
- [ ] **Sentiment Analysis** - Detect angry customers for escalation
- [ ] **AI Analytics Dashboard** - Token usage, response times, satisfaction
- [ ] **Conversation Handoff** - Seamless transfer to human agent
- [ ] **Image Understanding** - Analyze product images sent by customers

### Enhancement Ideas

1. **Quick Replies Suggestion**
   - AI suggests button options based on context
   
2. **Proactive Messages**
   - AI drafts follow-up messages for abandoned carts

3. **Learning from Corrections**
   - Human corrections improve future AI responses

---

## Quick Start Guide

### 1. Enable AI Chatbot

1. Go to WhatsApp → Automation → Smart AI tab
2. Toggle "AI Chatbot" switch ON
3. (Optional) Customize system prompt
4. Save configuration

### 2. Add FAQs

1. Go to Smart AI tab → FAQ Knowledge Base
2. Click "Add FAQ"
3. Enter question and answer
4. Keywords auto-extract (or add manually)
5. Save

### 3. Test Before Going Live

1. Use the "Test AI Response" input
2. Type a customer message
3. Click "Send"
4. Review response, tokens used, response time

### 4. Monitor Usage

- Check `trigger_count` in AI config
- Review FAQ `match_count` for popular questions
- Monitor token costs in workspace billing

---

*Documentation maintained by Sociovia Development Team*
*Last updated: January 2026*

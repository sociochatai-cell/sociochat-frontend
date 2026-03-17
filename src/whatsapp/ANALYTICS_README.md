# WhatsApp Business Analytics Dashboard

## 📊 Complete Documentation

This document provides comprehensive details about the WhatsApp Analytics Dashboard, including all metrics, calculations, business value, and implementation details.

**Last Updated:** January 2026

---

## Table of Contents

1. [Overview](#overview)
2. [Executive Summary Metrics](#executive-summary-metrics)
3. [Delivery Funnel](#delivery-funnel)
4. [Category Performance](#category-performance)
5. [Trend Analysis](#trend-analysis)
6. [AI-Powered Insights](#ai-powered-insights)
7. [Real Gemini AI Insights](#real-gemini-ai-insights)
8. [Conversation Insights](#conversation-insights)
9. [Cost Calculations](#cost-calculations)
10. [API Endpoints](#api-endpoints)
11. [Data Flow Architecture](#data-flow-architecture)
12. [Recent Changes](#recent-changes)

---

## Overview

The WhatsApp Business Analytics Dashboard provides business owners with actionable insights about their WhatsApp Business API usage. The dashboard is designed with a **CEO-first approach** - metrics are presented in business-friendly language rather than technical jargon.

### Key Design Principles

| Principle | Implementation |
|-----------|----------------|
| **Business-First Language** | "Delivery Health" instead of "Delivery Rate" |
| **Actionable Insights** | Every metric includes context and recommendations |
| **Period Comparison** | All metrics show trend vs previous period |
| **Cost Visibility** | Real-time cost tracking in INR (₹) |
| **AI-Powered** | Machine learning recommendations for optimization |

---

## Executive Summary Metrics

### 1. Messages Sent

**What it shows:** Total outgoing messages sent to customers in the selected period.

**Calculation:**
```sql
SELECT COUNT(*) 
FROM whatsapp_messages 
WHERE direction = 'outgoing' 
  AND created_at >= {start_date}
  AND conversation.account_id IN (workspace_accounts)
```

**Why it matters:**
- Indicates your WhatsApp engagement activity level
- Higher volume = more customer touchpoints
- Used as base for calculating delivery and read rates

**Business Insight:** Track this to ensure consistent customer communication. Sudden drops may indicate campaign issues or API problems.

---

### 2. Delivery Health (Delivery Rate)

**What it shows:** Percentage of sent messages successfully delivered to customer devices.

**Calculation:**
```
Delivery Rate = (Delivered Messages / Sent Messages) × 100
```

**Status Mapping:**
| WhatsApp Status | Counted As |
|-----------------|------------|
| `sent` | Sent (not yet delivered) |
| `delivered` | Delivered ✓ |
| `read` | Delivered ✓ (also read) |
| `failed` | Failed ✗ |

**Why it matters:**
- **95%+** = Healthy (green indicator)
- **80-95%** = Needs attention (yellow indicator)
- **Below 80%** = Problem (red indicator)

**Common causes of low delivery:**
1. Invalid phone numbers in contact list
2. Customer's phone is off/no internet
3. Customer blocked your business number
4. WhatsApp account issues on customer side

**Business Insight:** Poor delivery rates waste money (you pay per message sent, not delivered). Clean your contact lists regularly.

---

### 3. Customer Attention (Read Rate)

**What it shows:** Percentage of delivered messages that were actually opened and read by customers.

**Calculation:**
```
Read Rate = (Read Messages / Delivered Messages) × 100
```

**Why it matters:**
- Measures actual customer engagement
- **70%+** = Excellent engagement
- **40-70%** = Average
- **Below 40%** = Poor - messages being ignored

**Factors affecting read rate:**
1. **Message timing** - Messages sent at optimal times get read more
2. **Template quality** - Engaging preview text increases opens
3. **Frequency** - Too many messages leads to fatigue
4. **Relevance** - Personalized messages get higher attention

**Business Insight:** This is your "open rate" equivalent for WhatsApp. If read rates are low, customers are ignoring your messages - review your content strategy.

---

### 4. Active Customers

**What it shows:** Unique customers who exchanged messages with your business in the period.

**Calculation:**
```sql
SELECT COUNT(DISTINCT conversation_id) 
FROM whatsapp_messages 
WHERE created_at >= {start_date}
  AND conversation.account_id IN (workspace_accounts)
```

**Why it matters:**
- Shows your active WhatsApp audience size
- Growing number = healthy channel
- Declining number = engagement issues

**Business Insight:** Track this weekly. Compare against your total customer base to understand WhatsApp adoption rate.

---

### 5. Response Speed (Average Response Time)

**What it shows:** How quickly your team responds to customer messages.

**Calculation:**
```python
# For each incoming message, find the next outgoing message
response_time = outgoing_message.created_at - incoming_message.created_at

# Average across all conversations
avg_response_time = sum(response_times) / count(conversations)
```

**Display Format:**
- Seconds: `45s`
- Minutes: `12m`
- Hours: `2h`

**Why it matters:**
- WhatsApp users expect fast responses (unlike email)
- **Under 5 minutes** = Excellent
- **5-30 minutes** = Good
- **Over 1 hour** = Poor

**Business Insight:** Fast responses lead to higher customer satisfaction and conversion rates. Consider automation for common queries.

---

### 6. Estimated Cost

**What it shows:** Approximate WhatsApp Business API charges based on message categories.

**Calculation:** See [Cost Calculations](#cost-calculations) section below.

---

## Delivery Funnel

The delivery funnel visualizes the message journey from sent to read.

```
┌─────────────────────────────────────────┐
│             SENT (100%)                 │  ← All outgoing messages
├─────────────────────────────────────────┤
│         DELIVERED (95%)                 │  ← Reached device
├─────────────────────────────────────────┤
│           READ (62%)                    │  ← Customer opened
└─────────────────────────────────────────┘
         │
         ▼
    FAILED (5%) ← Didn't reach device
```

### Funnel Calculations

| Stage | Formula | Meaning |
|-------|---------|---------|
| **Sent** | Total outgoing messages | Base count (100%) |
| **Delivered** | Status IN ('delivered', 'read') | Reached customer's phone |
| **Read** | Status = 'read' | Customer opened message |
| **Failed** | Status = 'failed' | Delivery failed |

### Conversion Rates

- **Sent → Delivered:** Should be 95%+
- **Delivered → Read:** Should be 60%+
- **Overall (Sent → Read):** Target 55%+

---

## Category Performance

WhatsApp Business API charges different rates based on message category.

### Categories Explained

| Category | Use Case | Examples | India Price (₹) |
|----------|----------|----------|-----------------|
| **UTILITY** | Transactional messages | Order confirmations, shipping updates, appointment reminders | ₹0.15 |
| **MARKETING** | Promotional messages | Offers, discounts, product launches, newsletters | ₹0.78 |
| **AUTHENTICATION** | Security messages | OTP codes, login verification, password resets | ₹0.15 |

### Why Categories Matter

1. **Cost Optimization:** Marketing costs 5x more than Utility
2. **Compliance:** Using wrong category can get templates rejected
3. **Customer Experience:** Right category = right expectations

### Category Assignment

Categories are assigned when creating message templates in Meta Business Manager. The category is stored with each message:

```python
# Template creation assigns category
template.category = "MARKETING"  # or "UTILITY" or "AUTHENTICATION"

# When sending, category is tracked
message.template_category = template.category
```

---

## Trend Analysis

### 7-Day Trend Chart

Shows daily message performance over the selected period.

**Data Points:**
```json
{
  "date": "2026-01-06",
  "sent": 145,
  "delivered": 138,
  "read": 89
}
```

### Trend Calculation

```sql
SELECT 
    DATE(created_at) as date,
    COUNT(*) as sent,
    SUM(CASE WHEN status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
    SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read
FROM whatsapp_messages
WHERE direction = 'outgoing'
  AND created_at >= {start_date}
GROUP BY DATE(created_at)
ORDER BY date ASC
```

### Interpreting Trends

| Pattern | Meaning | Action |
|---------|---------|--------|
| **Consistent lines** | Stable performance | Maintain current strategy |
| **Diverging lines** | Delivery/read issues | Investigate message quality |
| **Spikes** | Campaign activity | Correlate with marketing calendar |
| **Dips** | Reduced activity | Check for system issues |

---

## AI-Powered Insights

### What Makes This Special

Unlike basic analytics, our AI-powered insights provide **predictive and actionable intelligence**.

### Metrics Explained

#### 1. Customer Sentiment Score (0-100)

**Calculation:**
```python
sentiment_score = (read_rate × 0.6) + (delivery_rate × 0.4)
```

**Why this formula:**
- Read rate (60% weight): Direct indicator of customer engagement
- Delivery rate (40% weight): Shows contact list health

**Interpretation:**
| Score | Sentiment | Action |
|-------|-----------|--------|
| 70-100 | Positive | Customers are engaged |
| 40-69 | Neutral | Room for improvement |
| 0-39 | Negative | Urgent attention needed |

#### 2. Engagement Score (0-100)

**Calculation:**
```python
engagement_score = (read_rate + delivery_rate) / 2
```

**Why:** Balanced view of both delivery success and customer attention.

#### 3. Churn Risk Customers

**Calculation:**
```python
inactive_conversations = total_conversations - active_conversations
churn_risk = inactive_conversations × 0.15  # 15% of inactive
```

**Why 15%:** Industry research shows ~15% of inactive customers are at high churn risk.

#### 4. High Value Customers

**Calculation:**
```python
high_value = active_conversations × 0.25  # Top 25% of active
```

**Why 25%:** Pareto principle - ~25% of customers drive significant engagement.

#### 5. Best Send Time

**Calculation:**
```python
# Analyze hourly read rates
for each hour (0-23):
    messages_sent = count(messages sent at this hour)
    messages_read = count(messages read at this hour)
    read_rate = messages_read / messages_sent

best_hour = hour with highest read_rate
```

**Why:** Messages sent at optimal times have higher engagement.

#### 6. Best Send Day

**Calculation:**
```python
# Analyze daily read rates
for each day (Sunday-Saturday):
    messages_sent = count(messages sent on this day)
    messages_read = count(messages read on this day)
    read_rate = messages_read / messages_sent

best_day = day with highest read_rate
```

#### 7. Response Rate

**Calculation:**
```python
incoming_messages = count(direction = 'incoming')
outgoing_messages = count(direction = 'outgoing')
response_rate = (incoming_messages / outgoing_messages) × 100
```

**Why:** Measures how often customers reply to your messages.

#### 8. Customer Satisfaction

**Calculation:**
```python
customer_satisfaction = min(100, read_rate × 1.1)
```

**Why:** High read rates correlate with satisfied, engaged customers.

---

### AI Recommendations Engine

The system generates contextual recommendations based on your data:

```python
recommendations = []

if read_rate < 50:
    recommendations.append("📌 Consider shorter message templates for better read rates")
else:
    recommendations.append("✅ Read rates are healthy - customers are engaged")

if delivery_rate < 90:
    recommendations.append("⚠️ Review phone number quality - some messages aren't delivering")

if total_sent < 100:
    recommendations.append("💡 Increase engagement with scheduled broadcasts")

recommendations.append(f"🎯 Best time to send: {best_day}s at {best_hour}:00")

if response_rate < 20:
    recommendations.append("💬 Try adding call-to-action buttons to encourage replies")

if churn_risk > 10:
    recommendations.append(f"⚡ {churn_risk} customers may be at risk - consider re-engagement")
```

---

## Conversation Insights

### Metrics

| Metric | Calculation | Meaning |
|--------|-------------|---------|
| **Total Conversations** | COUNT(DISTINCT conversation_id) | All WhatsApp threads |
| **Open Conversations** | WHERE is_session_open = true | Active 24-hour windows |
| **With Unread** | WHERE has_unread = true | Need team attention |
| **Active Sessions** | WHERE session_expires_at > NOW() | Can send free-form messages |

### WhatsApp Session Rules

WhatsApp Business API has a **24-hour session window**:

1. **Session Opens:** When customer sends a message
2. **Session Duration:** 24 hours from last customer message
3. **During Session:** Can send free-form messages (no template needed)
4. **After Session:** Must use approved templates (costs money)

---

## Real Gemini AI Insights

### Overview

The analytics system now includes **real Gemini-powered AI insights** that go beyond simple heuristics.

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Clicks "Generate AI Insights"           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   1. Check Cache (24h TTL)                       │
│         Key: insights:{workspace_id}:{data_hash}                 │
│         If cached → Return cached insights immediately           │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼ (cache miss)
┌─────────────────────────────────────────────────────────────────┐
│                   2. Build Analytics Prompt                      │
│  - Business name & industry context                              │
│  - Message volume, delivery rate, read rate                      │
│  - Template performance stats                                    │
│  - Hourly distribution patterns                                  │
│  - Period comparison data                                        │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. Call Vertex AI (Gemini 2.0 Flash)           │
│  - response_mime_type: "application/json"                        │
│  - temperature: 0.7                                              │
│  - max_output_tokens: 1024                                       │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                   4. Parse & Return Insights                     │
│  - 4-5 typed insights (success/warning/tip/critical)             │
│  - Executive summary                                             │
│  - Cache for 24 hours                                            │
│  - Track tokens and cost                                         │
└─────────────────────────────────────────────────────────────────┘
```

### Insight Types

| Type | Color | Use Case |
|------|-------|----------|
| `success` | Green | Positive metrics, achievements |
| `warning` | Yellow | Issues needing attention |
| `tip` | Blue | Optimization suggestions |
| `critical` | Red | Serious problems (used sparingly) |

### Insight Structure

```python
@dataclass
class AnalyticsInsight:
    type: str           # "success", "warning", "tip", "critical"
    title: str          # Short title (max 8 words)
    message: str        # Detailed insight (2-3 sentences)
    action: str         # Specific actionable recommendation
    metric: str         # Related metric name
    confidence: float   # 0.0-1.0 confidence score
```

### Response Format

```json
{
  "success": true,
  "insights": [
    {
      "type": "success",
      "title": "Excellent Delivery Rate",
      "message": "Your 97% delivery rate is above industry average of 92%. This indicates a clean contact list and reliable infrastructure.",
      "action": "Maintain current contact list hygiene practices.",
      "metric": "delivery_rate"
    },
    {
      "type": "warning",
      "title": "Declining Read Rates",
      "message": "Read rates dropped 15% compared to last period. Customers may be experiencing message fatigue.",
      "action": "Review message frequency and consider A/B testing send times.",
      "metric": "read_rate"
    }
  ],
  "summary": "Overall WhatsApp performance is healthy with strong delivery, but engagement needs attention.",
  "metadata": {
    "from_cache": false,
    "generation_time_ms": 1523,
    "tokens_used": 847,
    "cost_inr": 0.000742,
    "model": "gemini-2.0-flash"
  }
}
```

### Cost Tracking

Each AI insights generation tracks:
- Input tokens (prompt)
- Output tokens (response)
- Total cost in INR
- Generation time in milliseconds

### Caching Strategy

**Backend Cache (Redis/Memory):**
- **Cache Key:** `insights:{workspace_id}:{data_hash}`
- **TTL:** 24 hours
- **Invalidation:** Automatic when data changes (hash-based)
- **Manual Refresh:** User can force refresh via button

**Frontend Cache (localStorage):**
- **Cache Key:** `sv_ai_insights_{workspaceId}_{period}`
- **TTL:** 24 hours (checked on load)
- **Sync:** Storage events sync between Dashboard and Analytics pages
- **Structure:**
```json
{
  "data": { /* AI insights response */ },
  "cached_at": 1736270400000
}
```

---

## Cost Calculations

### India WhatsApp Business API Pricing (2024-2026)

| Category | Price per Message | Use Case |
|----------|-------------------|----------|
| **Utility** | ₹0.15 | Order updates, shipping, appointments |
| **Marketing** | ₹0.78 | Promotions, offers, newsletters |
| **Authentication** | ₹0.15 | OTP, verification codes |

### Cost Calculation Formula

```python
# Backend calculation (routes.py)
utility_count = count(messages WHERE template_category = 'UTILITY')
marketing_count = count(messages WHERE template_category = 'MARKETING')
auth_count = count(messages WHERE template_category = 'AUTHENTICATION')

estimated_cost = (utility_count × 0.15) + (marketing_count × 0.78) + (auth_count × 0.15)
```

### Cost Optimization Tips

1. **Use Utility for Transactional:** Order confirmations, shipping updates
2. **Limit Marketing Messages:** Only for genuine promotions
3. **Batch Authentication:** Reduce OTP retries
4. **Clean Contact Lists:** Avoid failed deliveries (still charged)

### Indian Number Formatting

All costs display in Indian number format:
- ₹1,00,000 (one lakh) not ₹100,000
- ₹10,00,000 (ten lakh) not ₹1,000,000

```javascript
cost.toLocaleString('en-IN', { 
  minimumFractionDigits: 2, 
  maximumFractionDigits: 2 
})
// Output: "1,23,456.78"
```

---

## API Endpoints

### Analytics Summary
```
GET /api/whatsapp/analytics/summary?workspace_id={id}&days={7|14|30|90}
```

**Response:**
```json
{
  "success": true,
  "current": {
    "sent": 1250,
    "delivered": 1188,
    "read": 735,
    "failed": 62,
    "delivery_rate": 95.0,
    "read_rate": 61.9,
    "active_customers": 342,
    "estimated_cost": 187.50
  },
  "previous": {
    "sent": 1100,
    "delivered": 1045,
    "read": 680,
    "failed": 55
  },
  "comparison": {
    "sent_change": 13.6,
    "delivered_change": 13.7,
    "read_change": 8.1
  },
  "period_days": 7
}
```

### Analytics Trends
```
GET /api/whatsapp/analytics/trends?workspace_id={id}&days={7|14|30|90}
```

**Response:**
```json
{
  "success": true,
  "daily": [
    {"date": "2026-01-01", "sent": 180, "delivered": 171, "read": 105},
    {"date": "2026-01-02", "sent": 195, "delivered": 185, "read": 120}
  ],
  "period_days": 7
}
```

### Category Performance
```
GET /api/whatsapp/analytics/categories?workspace_id={id}&days={7|14|30|90}
```

**Response:**
```json
{
  "success": true,
  "categories": {
    "utility": {
      "category": "utility",
      "total_sent": 800,
      "delivered": 780,
      "read": 520,
      "failed": 20,
      "delivery_rate": 97.5,
      "read_rate": 66.7,
      "failure_rate": 2.5
    },
    "marketing": {...},
    "authentication": {...}
  }
}
```

### AI Insights
```
GET /api/whatsapp/analytics/ai-insights?workspace_id={id}&days={7|14|30|90}
```

**Response:**
```json
{
  "success": true,
  "sentiment_score": 72,
  "sentiment_trend": "improving",
  "engagement_score": 68,
  "churn_risk_customers": 15,
  "high_value_customers": 85,
  "best_send_hour": 10,
  "best_send_day": "Tuesday",
  "response_rate": 35,
  "avg_conversation_length": 4.5,
  "customer_satisfaction": 76,
  "recommendations": [
    "✅ Read rates are healthy - customers are engaged",
    "✅ Delivery rates are excellent",
    "🎯 Best time to send: Tuesdays at 10:00 based on your data"
  ],
  "data_points": {
    "total_messages": 1250,
    "total_conversations": 342,
    "period_days": 7
  }
}
```

### Real AI Insights (Gemini-Powered)
```
POST /api/whatsapp/analytics/ai-insights/generate
```

**Request:**
```json
{
  "workspace_id": 123,
  "force_refresh": false
}
```

**Response:**
```json
{
  "success": true,
  "insights": [
    {
      "type": "success",
      "title": "Strong Delivery Performance",
      "message": "Your 96.5% delivery rate exceeds industry benchmarks.",
      "action": "Continue current contact list maintenance practices.",
      "metric": "delivery_rate"
    }
  ],
  "summary": "WhatsApp performance is healthy overall.",
  "metadata": {
    "from_cache": false,
    "generation_time_ms": 1847,
    "tokens_used": 923,
    "cost_inr": 0.000812,
    "model": "gemini-2.0-flash"
  }
}
```

### Export Data
```
GET /api/whatsapp/analytics/export?workspace_id={id}&days={7}&format=csv
```

**Response:** CSV file download with columns:
- Date
- Messages Sent
- Delivered
- Read
- Failed
- Delivery Rate (%)
- Read Rate (%)

### Conversation Insights
```
GET /api/whatsapp/analytics/conversations/{conversation_id}
```

**Response:**
```json
{
  "success": true,
  "conversation_id": 123,
  "session_info": {
    "is_open": true,
    "expires_at": "2026-01-08T10:30:00Z"
  },
  "message_stats": {
    "total": 45,
    "outgoing": 23,
    "incoming": 22,
    "delivered": 23,
    "read": 20,
    "failed": 0
  },
  "templates_used": [
    {"name": "order_confirmation", "count": 5},
    {"name": "shipping_update", "count": 3}
  ]
}
```

---

## Data Flow Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                     WhatsApp Business API                      │
│                    (Meta Cloud API v22.0)                      │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                      Webhook Handler                           │
│                   /api/whatsapp/webhook                        │
│                                                                │
│  • Receives message status updates (sent/delivered/read/failed)│
│  • Receives incoming customer messages                         │
│  • Updates database in real-time                               │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                        Database                                │
│                      (PostgreSQL)                              │
│                                                                │
│  Tables:                                                       │
│  • whatsapp_messages (status, direction, category, timestamps) │
│  • whatsapp_conversations (session info, customer data)        │
│  • whatsapp_accounts (workspace linking)                       │
│  • workspace_ai_usage (daily token/cost tracking)              │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                    Analytics API Layer                         │
│                                                                │
│  /api/whatsapp/analytics/summary    → Executive metrics        │
│  /api/whatsapp/analytics/trends     → Daily data points        │
│  /api/whatsapp/analytics/categories → Category breakdown       │
│  /api/whatsapp/analytics/ai-insights→ Heuristic insights       │
│  /api/whatsapp/analytics/generate-insights → Real AI insights  │
│  /api/whatsapp/analytics/export     → CSV/PDF export           │
│  /api/whatsapp/analytics/conversations/{id} → Conversation     │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                   AI Analytics Engine                          │
│                    (ai_analytics.py)                           │
│                                                                │
│  • Vertex AI client (Gemini 2.0 Flash)                        │
│  • 24-hour caching with data hash                             │
│  • Token/cost tracking per request                            │
│  • Structured JSON insights                                   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────┐
│                     React Frontend                             │
│                                                                │
│  Components:                                                   │
│  • ExecutiveSummaryCards  - 6 key metrics                      │
│  • DeliveryFunnel         - Visual message journey             │
│  • CategoryPerformance    - Cost breakdown                     │
│  • TrendChart             - Recharts line graph                │
│  • AIInsightsSection      - Real AI recommendations            │
│  • ConversationInsights   - Team metrics                       │
│  • ExportButtons          - Data export                        │
│                                                                │
│  localStorage Sync:                                            │
│  • sv_ai_insights_{ws}_{period} - Shared AI insights cache     │
│  • Dashboard ↔ Analytics sync via storage events               │
└──────────────────────────────────────────────────────────────┘
```

---

## File Locations

| Component | File Path |
|-----------|-----------|
| **Backend Routes** | `backend/Sociovia/whatsapp/routes.py` |
| **AI Analytics Engine** | `backend/Sociovia/whatsapp/ai_analytics.py` |
| **AI Utilities** | `backend/Sociovia/whatsapp/ai_utils.py` |
| **AI Metrics** | `backend/Sociovia/whatsapp/ai_metrics.py` |
| **Executive Summary** | `frontend/src/whatsapp/components/analytics/ExecutiveSummaryCards.tsx` |
| **Delivery Funnel** | `frontend/src/whatsapp/components/analytics/DeliveryFunnel.tsx` |
| **Category Performance** | `frontend/src/whatsapp/components/analytics/CategoryPerformance.tsx` |
| **Trend Chart** | `frontend/src/whatsapp/components/analytics/TrendChart.tsx` |
| **Conversation Insights** | `frontend/src/whatsapp/components/analytics/ConversationInsights.tsx` |
| **Export Buttons** | `frontend/src/whatsapp/components/analytics/ExportButtons.tsx` |
| **Main Analytics Page** | `frontend/src/whatsapp/pages/WhatsAppAnalytics.tsx` |
| **Dashboard (with analytics)** | `frontend/src/pages/WhatsAppDashboard.tsx` |
| **Analytics Hook** | `frontend/src/whatsapp/hooks/useWhatsAppData.ts` |

---

## Key Backend Files

### ai_analytics.py

Real Gemini-powered analytics insights engine:

```python
# Main function
def generate_analytics_insights(
    workspace_id: int,
    analytics_data: Dict[str, Any],
    business_name: str = "Your Business",
    industry: str = "General",
    force_refresh: bool = False,
) -> AnalyticsInsightsResponse:
    """
    Generate AI-powered analytics insights using Vertex AI (Gemini).
    
    Features:
    - 24-hour caching per workspace
    - Token and cost tracking
    - Structured JSON response
    """
```

### ai_utils.py

Production utilities for AI calls:

```python
# Safe Gemini call with retries
safe_gemini_call(func, *args, **kwargs)

# Caching utilities
cache.get(key)
cache.set(key, value, ttl=3600)
get_cache_key(prefix, *parts)

# Cost calculation
calculate_cost_inr(input_tokens, output_tokens)
```

### ai_metrics.py

Metrics collection and aggregation:

```python
# Metrics collector
collector = MetricsCollector("analytics_insights", workspace_id)
collector.start()
collector.start_phase("generate")
collector.end_phase("generate", tokens_input=100, tokens_output=50)
metrics = collector.finalize(success=True)

# Daily usage aggregation
aggregate_daily_usage(workspace_id, metrics)
```

---

## Future ML Enhancements

The current AI insights use **real Gemini LLM analysis** with heuristic fallback. Future enhancements planned:

1. **Advanced Sentiment Analysis**
   - NLP on message content
   - Emoji sentiment detection
   - Customer tone analysis

2. **Predictive Churn Model**
   - Time-series analysis of engagement
   - Customer behavior patterns
   - Proactive alert system

3. **Send Time Optimization**
   - Per-customer optimal timing
   - Timezone-aware scheduling
   - A/B testing integration

4. **Template Performance Prediction**
   - Predict read rates before sending
   - Suggest template improvements
   - Auto-optimization recommendations

5. **Conversation Summarization**
   - AI-powered conversation summaries
   - Key topic extraction
   - Customer intent classification

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Jan 2026 | Initial release with 6 executive metrics |
| 1.1 | Jan 2026 | Added AI-powered insights (heuristic-based) |
| 1.2 | Jan 2026 | Converted to INR (₹) with Indian formatting |
| 1.3 | Jan 2026 | Added real Gemini AI insights via Vertex AI |
| 1.4 | Jan 2026 | Added conversation insights endpoint |
| 1.5 | Jan 2026 | Added export with full column details |
| 1.6 | Jan 2026 | Manual AI insights trigger, localStorage sync between pages |

---

## Recent Changes (January 2026)

### Real Gemini AI Analytics
- ✅ `ai_analytics.py` - New module for Vertex AI powered insights
- ✅ Uses `gemini-2.0-flash` for fast, cost-effective analysis
- ✅ JSON response format with structured insights
- ✅ 24-hour caching with data-hash-based invalidation
- ✅ Token and cost tracking per request

### Enhanced API Endpoints
- ✅ `POST /api/whatsapp/analytics/generate-insights` - Real AI insights
- ✅ `GET /api/whatsapp/analytics/conversations/{id}` - Conversation details
- ✅ Enhanced export with all columns

### Metrics Collection
- ✅ `ai_metrics.py` - Phase-based timing
- ✅ `ai_utils.py` - Safe Gemini calls with retries
- ✅ Per-workspace daily usage aggregation

### Frontend Components
- ✅ Analytics components in dedicated folder
- ✅ `ExecutiveSummaryCards` - 6 key metrics with comparison
- ✅ `DeliveryFunnel` - Visual message journey
- ✅ `CategoryPerformance` - Cost by category
- ✅ `TrendChart` - Recharts line graph
- ✅ `ConversationInsights` - Session metrics
- ✅ `ExportButtons` - CSV export

### Design Principles
- ✅ Business-first language (CEO-friendly)
- ✅ Indian number formatting (₹1,00,000)
- ✅ Period comparison on all metrics
- ✅ Real-time cost tracking
- ✅ Actionable recommendations

### Manual AI Insights (v1.6)
- ✅ AI insights no longer auto-fetch (saves tokens/cost)
- ✅ Manual "Generate AI Insights" button on both pages
- ✅ Shows token usage, cost (₹), and generation time
- ✅ Badge indicates "Gemini AI" vs "Heuristic" vs "Cached"
- ✅ "Refresh" button to force regenerate

### Cross-Page Synchronization (v1.6)
- ✅ AI insights shared between Dashboard and Analytics via localStorage
- ✅ Storage key: `sv_ai_insights_{workspaceId}_{period}`
- ✅ 24-hour client-side cache (matches backend TTL)
- ✅ Real-time sync via `storage` event listener
- ✅ Generate insights on one page, see them on both immediately

### Backend Fixes (v1.6)
- ✅ Fixed `to_dict()` in `ai_analytics.py` to handle cached dict/object
- ✅ Cache now properly returns insights without `AttributeError`

---

*Documentation maintained by Sociovia Development Team*

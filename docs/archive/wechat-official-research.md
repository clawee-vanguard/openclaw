# WeChat API Research: Building a Chat Bridge to OpenClaw

*Researched: 2026-02-14*

---

## 1. WeChat Official Account (公众号) Types

WeChat recently split the "Official Account" docs into two categories:

### Subscription Account (订阅号) → now called "公众号"
- Designed for **media/content creators** — individuals, organizations
- Messages appear in a **bundled "Subscriptions" folder** (not as a standalone chat)
- Can receive messages from followers (1-on-1 only)
- **Cannot** access group chats at all
- Limited API: can only reply to user messages within 48 hours (customer service API) or passively reply within 5 seconds of receiving a message
- Individuals can register (Chinese ID or passport may work for overseas)

### Service Account (服务号)
- Designed for **businesses** providing services
- Messages appear as a **standalone chat** in the user's contact list (more visible)
- More powerful API access: templates, payments, OAuth, menus, etc.
- Still **1-on-1 only** — no group chat access whatsoever
- Requires **Chinese business license** (营业执照) to register
- Gets 4 broadcast messages per month (vs unlimited for subscription)

### Key Finding: **Neither type can access WeChat group chats (群聊)**

Official Accounts operate in a completely separate messaging paradigm from personal WeChat. They interact with followers, not with group chats. There is **no API** for an Official Account to:
- Join a group chat
- Read group chat messages
- Send messages to group chats

---

## 2. WeChat Official Account API Capabilities

### What it CAN do (1-on-1 with followers):
- **Receive messages**: Text, image, voice, video, location, link (via webhook callback)
- **Passive reply**: Respond to user message within 5 seconds (synchronous reply)
- **Customer Service API**: Send messages to users who interacted in last 48 hours
- **Template messages**: Push structured notifications (Service Account only)
- **Menu management**: Create custom menus with click/URL actions
- **User management**: Get follower list, user info, tagging
- **Media management**: Upload/download images, voice, video, thumb
- **OAuth 2.0**: Web authorization for user identity
- **WeChat Pay**: Payment integration (Service Account only)
- **QR codes**: Generate parametric QR codes for tracking

### What it CANNOT do:
- ❌ Access any group chat
- ❌ Send messages to non-followers
- ❌ Initiate conversations (only respond to user-initiated contact)
- ❌ Access personal WeChat contacts/friends list

### Rate Limits (Service Account):
- API calls: varies by endpoint, generally 5000-50000/day
- Template messages: 100,000/day (with verified account)
- Customer service messages: within 48h window only
- Broadcasts: 4/month (Service Account), 1/day (Subscription Account)

---

## 3. WeChat Mini Program (小程序)

### Can it act as a message bridge? **No, not really.**

Mini Programs are essentially **lightweight apps** that run inside WeChat. They have very limited messaging capabilities:

- **No persistent background execution** — only runs when user opens it
- **No webhook/callback for incoming messages** — it's an app, not a messaging bot
- **Subscribe messages (订阅消息)**: Can send one-time notifications that the user explicitly opts into. Very limited templates, user must click to subscribe each time.
- **Customer service button**: Can open a customer service chat session, but this goes through the Official Account's customer service system
- **No group chat access** at all

### What Mini Programs CAN do:
- Provide a UI within WeChat (like a web app)
- Access WeChat user identity (login)
- Use WeChat Pay
- Access device features (camera, location, etc.)
- Share to chats (but just a card link, not programmatic messaging)

### Potential use as bridge component:
A Mini Program could theoretically serve as a **UI for users to manually forward messages** to an external system, but it cannot automatically intercept or bridge group chat messages. Not useful for our purpose.

---

## 4. WeChat Work (企业微信) — **The Best Official Path**

### Overview
WeChat Work is the enterprise/corporate version of WeChat. It has **by far the most capable API** for group chat management and messaging.

### Key API Capabilities:

#### Application Messaging (应用消息)
- Send messages to users/departments/tags: text, image, voice, video, file, markdown, template cards, mini program notifications
- **Rate limit**: accounts × 200 messages/day per app; max 30/min and 1000/hour per member
- Endpoint: `POST https://qyapi.weixin.qq.com/cgi-bin/message/send`

#### Group Chat APIs (群聊会话)
- **Create group chats**: Up to 2000 members, 1000 groups/day per enterprise
- **Modify group chats**: Add/remove members, change owner, rename
- **Send messages to group chats**: Via `appchat/send` endpoint
- **Receive messages from group chats**: Via callback/webhook
- Supported message types: text, image, voice, video, file, text card, news, markdown

#### Webhook Bot (群机器人)
- Simple webhook URL per group — just POST JSON to send messages
- Supports: text, markdown, image, news, file, voice, template cards
- Rate limit: 20 messages/minute per bot
- **Easiest integration point** — no OAuth needed, just a webhook URL
- Can only SEND, not RECEIVE (one-way)

#### Callback/Event System
- Receive message callbacks for messages sent to the bot/app
- Event callbacks: user changes, group changes, etc.
- Supports AES encryption for security

### Registration Requirements:
- Need a **Chinese business license** (营业执照) to create a WeChat Work organization
- OR: Can be created by an individual with a **Chinese phone number** (limited features)
- Admin verification required
- Can invite external contacts (including non-Chinese users) as members
- **Third-party apps** can be developed and authorized by enterprises

### Interoperability with Personal WeChat:
- WeChat Work users can chat with personal WeChat users (互通)
- External contact management APIs exist
- Group chats can include both WeChat Work and personal WeChat users (external groups)
- **This is the key feature** — a WeChat Work bot could potentially be in a mixed group with personal WeChat users

---

## 5. Registration Requirements Summary

| Platform | Chinese ID | Business License | Phone | Cost |
|----------|-----------|-----------------|-------|------|
| Subscription Account (个人) | Yes (Chinese ID) | No | Chinese phone | Free |
| Subscription Account (企业) | No | Yes (Chinese) | Chinese phone | Free |
| Service Account | No | Yes (Chinese) | Chinese phone | Free + ¥300/yr verification |
| Mini Program | Varies | Recommended | Chinese phone | Free + ¥300/yr verification |
| WeChat Work | No | Yes (Chinese) OR Chinese phone for individual | Chinese phone | Free (basic) |

### For non-Chinese individuals:
- **Official Account**: Some reports of overseas registration with passport, but the process is difficult and unreliable. Overseas business registration exists but requires a business entity.
- **WeChat Work**: Requires Chinese business entity for full features. Individual registration possible with Chinese phone number but limited.
- **All paths** essentially require some Chinese nexus (phone number at minimum, business license for full features).

---

## 6. API Capabilities Comparison

| Feature | Official Account | Mini Program | WeChat Work |
|---------|-----------------|-------------|-------------|
| Receive 1-on-1 messages | ✅ | ❌ | ✅ |
| Send 1-on-1 messages | ✅ (48h window) | ❌ (subscribe msg only) | ✅ |
| Access group chats | ❌ | ❌ | ✅ |
| Create group chats | ❌ | ❌ | ✅ |
| Send to group chats | ❌ | ❌ | ✅ |
| Receive group messages | ❌ | ❌ | ✅ (callback) |
| Webhook integration | ❌ | ❌ | ✅ |
| Media support | ✅ | Limited | ✅ |
| User management | ✅ (followers) | ❌ | ✅ (members) |
| Cross with personal WeChat | Follower model | N/A | ✅ (互通) |

---

## 7. Limitations & Considerations

### WeChat Official Account:
- **Fatal limitation**: Cannot access group chats. Dead end for group bridging.
- 48-hour messaging window for customer service
- Geographic restrictions on some features
- Content censorship and review

### WeChat Work:
- Group chat API restricted to **self-built enterprise apps** with root department visibility
- Max 2000 members per group, 1000 groups created/day
- Webhook bots are send-only (20 msg/min)
- For receiving group messages, need full callback setup
- **External group limitations**: APIs for external contact groups may differ from internal groups
- Message content archiving requires separate license (会话内容存档)

### General:
- All WeChat APIs require **Chinese server infrastructure** (or at least Chinese IP for some operations)
- API calls must go through `api.weixin.qq.com` or `qyapi.weixin.qq.com`
- Content is subject to Chinese content moderation
- Token refresh every 2 hours (access_token)
- Rate limits across all platforms

---

## 8. Recommendation

### For bridging WeChat group messages to OpenClaw:

#### 🥇 Best Official Path: **WeChat Work (企业微信)**
- **Only official API** that supports group chat read/write
- Can create a bot application that receives callbacks for group messages and sends messages to groups
- Can interoperate with personal WeChat users via external contacts
- **Obstacle**: Requires Chinese business license for full functionality

#### 🥈 Pragmatic Alternative: **Wechaty (open-source framework)**
- [wechaty.js.org](https://wechaty.js.org) — open-source chatbot SDK
- Works with personal WeChat accounts via web/iPad/Windows protocols
- Can access group chats, receive/send messages, manage contacts
- **Puppets available**: web protocol (limited/deprecated), iPad protocol (paid), Windows protocol
- **Risk**: Operates in a gray area — uses reverse-engineered protocols, account may get banned
- **Practical**: Many production systems use this despite the risk
- Supports: Node.js, Python, Go, Java, .NET, PHP, Scala

#### 🥉 Hybrid Approach:
1. Set up a **WeChat Work organization** (even with limited individual registration)
2. Create a **self-built application** with message callback
3. Use the **group chat APIs** to create/manage groups
4. Bridge messages via webhook or callback → OpenClaw
5. Invite personal WeChat users to external groups

### For a non-Chinese individual, the most practical paths are:

1. **Use Wechaty** with a personal WeChat account (fastest, riskiest — account ban possible)
2. **Partner with a Chinese entity** to register WeChat Work (safest, most capable, but requires partnership)
3. **Use a WeChat Work individual account** with Chinese phone number (limited but legitimate)
4. **Use an overseas Official Account** for 1-on-1 messaging only (no group chat, but legitimate)

### My Recommendation:
**Start with Wechaty for prototyping** (quick to set up, full group chat access), then **migrate to WeChat Work** for production use once you have a Chinese business entity or partner. The Wechaty ecosystem is mature and well-documented, and gives you the exact API surface needed for a chat bridge (message events, group management, media handling).

For the OpenClaw bridge specifically, the architecture would be:
```
WeChat Group ↔ Wechaty/WeCom Bot ↔ Bridge Server ↔ OpenClaw Gateway
```

---

## References

- WeChat Service Account docs: https://developers.weixin.qq.com/doc/service/guide/
- WeChat Subscription docs: https://developers.weixin.qq.com/doc/subscription/guide/
- WeChat Work API: https://developer.work.weixin.qq.com/document/
- WeChat Work messaging: https://developer.work.weixin.qq.com/document/path/90236
- WeChat Work group chat: https://developer.work.weixin.qq.com/document/path/90245
- Wechaty: https://wechaty.js.org/docs/

# WeChat Bridge/Bot Research for OpenClaw Integration

**Date:** 2026-02-14  
**Purpose:** Evaluate self-hosted WeChat bridge options for OpenClaw channel plugin  
**Target platform:** macOS (Mac Mini M4)

---

## Table of Contents
1. [WeChat API Landscape](#1-wechat-api-landscape)
2. [Open Source Projects Evaluation](#2-open-source-projects-evaluation)
3. [Comparison Table](#3-comparison-table)
4. [Recommended Approach](#4-recommended-approach)
5. [Architecture Design](#5-architecture-design)
6. [Implementation Plan](#6-implementation-plan)
7. [Risk Assessment](#7-risk-assessment)

---

## 1. WeChat API Landscape

### Official APIs

| API | Scope | Personal Use? | Notes |
|-----|-------|--------------|-------|
| **Official Account (公众号)** | Service/subscription accounts | ❌ Business only | Requires business registration, only for broadcast-style messaging |
| **Mini Programs (小程序)** | In-app mini applications | ❌ Not relevant | Cannot access personal messages |
| **WeCom/企业微信 API** | Enterprise WeChat | ⚠️ Possible workaround | Has official APIs, can connect with regular WeChat users via "external contacts" |
| **WeChat Open Platform** | 3rd party app integration | ❌ Business only | OAuth login, sharing, not messaging |

**WeCom is the most viable "official" route** — you can create a WeCom org (free), add yourself, and use the official API to receive/send messages. The catch: it only reaches WeChat users who add your WeCom contact, and the UX is different from personal WeChat messaging.

### Unofficial Protocol Approaches

| Approach | How it works | Status (2025-2026) |
|----------|-------------|-------------------|
| **Web WeChat Protocol** | Reverse-engineers web.wechat.com API | ⚠️ Mostly dead. WeChat disabled web login for most accounts since ~2019. Some accounts (old, UOS-spoofed) still work. |
| **iPad Protocol** | Simulates iPad WeChat client | 🔴 Paid services only (e.g., PadLocal). No open-source implementation. High ban risk. |
| **Mac Protocol** | Reverse-engineers Mac WeChat client | 🔴 Similar to iPad — mostly proprietary/paid |
| **Windows Hook (DLL injection)** | Hooks into WeChat Windows desktop client memory | ✅ **Most active approach in 2025-2026**. Requires Windows. Many open-source projects. |
| **macOS Hook** | Hooks into WeChat macOS client | 🔴 Very limited. WeChat Mac is sandboxed, harder to hook. No active projects. |

**Key insight:** The Windows hook approach dominates the current landscape. Almost all actively maintained projects use it.

---

## 2. Open Source Projects Evaluation

### A. WeChatFerry (微信摆渡人)
- **GitHub:** https://github.com/lich0821/WeChatFerry (⭐ 6.4k, 1.4k forks)
- **Approach:** Windows WeChat client hook (DLL injection)
- **Language:** C++ core, Python/HTTP/gRPC clients
- **Status:** ✅ **Actively maintained** (2025-2026, supports WeChat 3.9.x)
- **Platform:** ❌ **Windows only** (hooks into WeChat.exe)
- **Features:** Text, images, files, voice, @mentions, group management, contact management
- **Integration:** Exposes HTTP/WebSocket API — easy to integrate
- **Ban risk:** Medium — hooks into official client, Tencent can detect injected DLLs
- **Self-hosted:** ✅ Fully self-hosted
- **Notes:** The most feature-complete and actively maintained project. Has Python SDK (`wcferry`) and HTTP server wrapper. Supports DeepSeek/ChatGPT integration out of the box.

### B. WeChatPYAPI
- **GitHub:** https://github.com/mrsanshui/WeChatPYAPI
- **Approach:** Windows WeChat client hook (Python API)
- **Language:** Python
- **Status:** ✅ Active (supports WeChat 3.9.x and 4.x)
- **Platform:** ❌ **Windows only**
- **Features:** Full coverage — text, images, video, files, voice, group management, Moments, CDN download
- **Integration:** Python callback-based + HTTP API
- **Ban risk:** Medium
- **Self-hosted:** ✅

### C. Wechaty
- **GitHub:** https://github.com/wechaty/wechaty (⭐ 17k+)
- **Approach:** Multi-protocol abstraction layer ("puppet" system)
- **Language:** TypeScript (with Python, Go, Java bindings)
- **Status:** ⚠️ **Framework is active, but free puppets are dead/dying**
  - `puppet-wechat` (web protocol) — mostly broken for new accounts
  - `puppet-padlocal` (iPad protocol) — **paid service**, ~¥200/month
  - `puppet-xp` (Windows hook) — requires Windows, less maintained than WeChatFerry
  - `puppet-wechat4u` (web protocol) — same web protocol limitations
- **Platform:** The framework runs anywhere (Node.js), but effective puppets need Windows or a paid service
- **Features:** Depends on puppet — full coverage with paid puppets
- **Integration:** Excellent SDK, event-driven, webhook support
- **Ban risk:** Varies by puppet (web = low but broken, iPad = medium-high, hook = medium)
- **Self-hosted:** ⚠️ Framework yes, but practical use requires paid puppet or Windows
- **Notes:** Great abstraction but the "free + working" combination doesn't exist for personal WeChat in 2026.

### D. openwechat
- **GitHub:** https://github.com/eatmoreapple/openwechat (⭐ 5.5k)
- **Approach:** Web WeChat protocol (with UOS patch to bypass login restriction)
- **Language:** Go
- **Status:** ⚠️ **Works for some accounts** — uses the UOS (Linux desktop) user-agent trick to re-enable web login
- **Platform:** ✅ **Cross-platform** (Go binary — macOS native!)
- **Features:** Text, images, files, emoji — no voice messages, limited group management
- **Integration:** Go library — would need to write an HTTP wrapper
- **Ban risk:** Low (behaves like legitimate web client)
- **Self-hosted:** ✅ Fully self-hosted, no dependencies
- **Caveats:**
  - Only works if your WeChat account has web login enabled (older accounts or UOS-patched)
  - New WeChat accounts (registered after ~2018) may not work at all
  - Can get logged out randomly; WeChat may disable web access at any time
  - No voice message support
  - Limited compared to hook-based approaches

### E. itchat
- **GitHub:** https://github.com/littlecodersh/ItChat
- **Approach:** Web WeChat protocol
- **Status:** 🔴 **Dead** — last updated 2019, web protocol mostly blocked
- **Notes:** Historical significance only. Do not use.

### F. WeCom (企业微信) Bot Approach
- **No specific repo** — uses official WeCom API
- **Approach:** Create a WeCom org → add a bot application → use official webhook/API
- **Status:** ✅ **Official, stable, supported**
- **Platform:** ✅ Cross-platform (it's just REST API calls)
- **Features:** Text, images, files, markdown, voice — through official API
- **Ban risk:** ✅ **Zero** — it's the official API
- **Self-hosted:** ✅ 
- **Limitations:**
  - Only contacts who add your WeCom account can be reached
  - Different UX from personal WeChat
  - Group chats work differently (WeCom groups vs WeChat groups)
  - Cannot access existing personal WeChat groups/contacts directly
  - Requires a WeCom organization (free to create)

---

## 3. Comparison Table

| Feature | WeChatFerry | openwechat | Wechaty (free) | WeCom API |
|---------|------------|------------|----------------|-----------|
| **Working in 2026** | ✅ Yes | ⚠️ Some accounts | ⚠️ Limited | ✅ Yes |
| **macOS native** | ❌ Windows | ✅ Yes | ⚠️ Framework yes | ✅ Yes |
| **Text messages** | ✅ | ✅ | ✅ | ✅ |
| **Images** | ✅ | ✅ | ✅ | ✅ |
| **Voice** | ✅ | ❌ | ⚠️ | ✅ |
| **Files** | ✅ | ✅ | ✅ | ✅ |
| **Group management** | ✅ Full | ⚠️ Basic | ⚠️ | ⚠️ WeCom groups only |
| **@mentions** | ✅ | ⚠️ | ⚠️ | ✅ |
| **Personal contacts** | ✅ | ✅ | ✅ | ❌ WeCom contacts only |
| **Ban risk** | ⚠️ Medium | 🟢 Low | ⚠️ Varies | ✅ None |
| **Self-hosted** | ✅ | ✅ | ⚠️ | ✅ |
| **Webhook/API** | ✅ HTTP/gRPC | ❌ Needs wrapper | ✅ | ✅ |
| **Maintenance** | ✅ Very active | ⚠️ Moderate | ⚠️ | ✅ Official |
| **Ease of integration** | ✅ | ⚠️ | ✅ | ✅ |

---

## 4. Recommended Approach

### Primary Recommendation: **Dual Strategy**

Given the constraints (macOS Mac Mini M4, self-hosted, low ban risk), I recommend a **two-tier approach**:

#### Tier 1: openwechat (Immediate, Native macOS)
- **Why:** Runs natively on macOS, no Windows needed, low ban risk
- **For:** Quick proof of concept, text/image messaging with personal WeChat
- **Risk:** May stop working if Tencent patches UOS web access
- **Setup:** Write a Go HTTP server wrapping openwechat → OpenClaw plugin calls it

#### Tier 2: WeChatFerry via Windows VM (Full-featured, Reliable)
- **Why:** Most feature-complete, actively maintained, proven in production
- **For:** Full WeChat integration including voice, files, group management
- **Setup:** Run a lightweight Windows VM (UTM/Parallels on M4) with WeChat + WeChatFerry → expose HTTP API → OpenClaw connects via webhook
- **The Windows VM can be headless** after initial QR code login

#### Alternative Tier: WeCom API (Zero-risk, Limited Scope)
- If ban risk is unacceptable, use WeCom official API
- Only reaches contacts who add your WeCom identity
- Good for specific use cases (team notifications, customer service)

### Why NOT Wechaty?
Wechaty is a great framework but adds complexity without solving the core problem — you still need a working puppet, and free puppets are broken/limited. Better to use the underlying tool directly.

---

## 5. Architecture Design

```
┌─────────────────────────────────────────────────────────┐
│                    Mac Mini M4                          │
│                                                         │
│  ┌─────────────────────┐    ┌─────────────────────┐    │
│  │   OpenClaw Gateway   │    │  WeChat Bridge       │    │
│  │                      │    │  (Go HTTP Server)    │    │
│  │  ┌────────────────┐  │    │                      │    │
│  │  │ WeChat Channel  │◄─┼───►│  openwechat lib     │    │
│  │  │ Plugin          │  │    │  (Web Protocol)     │    │
│  │  └────────────────┘  │    │                      │    │
│  └─────────────────────┘    └──────────┬────────────┘    │
│                                        │                 │
│                              OR (for full features):     │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Windows VM (UTM)                                 │   │
│  │                                                    │   │
│  │  ┌──────────────┐    ┌──────────────────────┐    │   │
│  │  │ WeChat.exe    │◄──►│ WeChatFerry          │    │   │
│  │  │ (Desktop)     │    │ (Hook + HTTP Server)  │    │   │
│  │  └──────────────┘    └──────────┬───────────┘    │   │
│  │                                  │ :8080          │   │
│  └──────────────────────────────────┼────────────────┘   │
│                                     │                    │
│  ┌─────────────────────┐           │                    │
│  │ OpenClaw Gateway     │◄──────────┘                    │
│  │  └─ WeChat Plugin    │  (HTTP/WebSocket)              │
│  └─────────────────────┘                                │
└─────────────────────────────────────────────────────────┘
                         │
                         ▼
                  ┌─────────────┐
                  │   WeChat     │
                  │   Servers    │
                  └─────────────┘
```

### Components

#### 1. WeChat Bridge Service
A lightweight HTTP/WebSocket server that:
- Connects to WeChat (via openwechat or WeChatFerry)
- Exposes REST API: `POST /send`, `GET /contacts`, `GET /groups`
- Pushes incoming messages via WebSocket or webhook callback
- Handles login (QR code generation, session persistence)

#### 2. OpenClaw Channel Plugin (`channel-wechat`)
A Node.js/TypeScript plugin that:
- Registers with OpenClaw as a channel provider
- Receives messages from bridge via webhook
- Translates OpenClaw message format ↔ WeChat format
- Routes messages to the correct OpenClaw session/agent

#### 3. Message Flow

**Incoming (WeChat → OpenClaw):**
```
WeChat msg → Bridge → webhook POST to OpenClaw → channel plugin → agent
```

**Outgoing (OpenClaw → WeChat):**
```
Agent response → channel plugin → HTTP POST to Bridge → WeChat
```

---

## 6. Implementation Plan

### Phase 1: Proof of Concept with openwechat (1-2 weeks)

1. **Set up openwechat bridge** (Go)
   - Fork/wrap openwechat as HTTP server
   - Endpoints: login (QR), send message, list contacts/groups
   - WebSocket for incoming message push
   - Session persistence (stay logged in)

2. **Build OpenClaw channel plugin** (TypeScript)
   - Implement channel provider interface
   - Handle text messages bidirectionally
   - Map WeChat contacts → OpenClaw users

3. **Test with personal account**
   - Log in via QR code
   - Send/receive text messages
   - Test group message reading

### Phase 2: Full Integration with WeChatFerry (2-3 weeks)

1. **Set up Windows VM** on Mac Mini
   - Install UTM (free, Apple Silicon native)
   - Install Windows 11 ARM + WeChat desktop
   - Install WeChatFerry, start HTTP server
   - Configure port forwarding (VM → host)

2. **Extend bridge API**
   - Image/file/voice send and receive
   - Group management (@mentions, invite, etc.)
   - Contact avatar/info sync

3. **Extend OpenClaw plugin**
   - Rich message types (images, files, voice)
   - Group chat support with @mention handling
   - Message history/context

### Phase 3: Hardening (1-2 weeks)

1. **Reliability**
   - Auto-reconnect on disconnect
   - VM auto-start on boot
   - Health monitoring
   - Login session persistence

2. **Security**
   - Bridge API auth (API key)
   - Encrypted communication between bridge and plugin
   - Rate limiting

3. **Quality of life**
   - Web UI for QR code login
   - Contact/group management dashboard
   - Message search/history

---

## 7. Risk Assessment

### Account Ban Risk

| Method | Risk Level | Mitigation |
|--------|-----------|------------|
| openwechat (web protocol) | **Low** | Behaves like normal web client; don't send bulk messages |
| WeChatFerry (hook) | **Medium** | Don't use on primary account; use a dedicated WeChat account; avoid mass messaging; keep WeChat version pinned |
| WeCom API | **None** | Official API |

### Operational Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Tencent patches web protocol | openwechat stops working | Fall back to WeChatFerry |
| Tencent updates WeChat.exe | WeChatFerry hook breaks | Pin WeChat version; wait for project update (usually days) |
| Windows VM instability | Service interruption | Auto-restart, health checks |
| QR code re-login required | Manual intervention | Session persistence, alerts |

### Legal Considerations
- WeChat ToS prohibits unauthorized automation
- Hook-based approaches technically violate ToS
- WeCom API is fully legitimate
- For personal use, enforcement risk is low
- Don't use for spam/commercial automation

---

## Summary

**For J's Mac Mini M4 setup, the recommended path is:**

1. **Start immediately** with **openwechat** — native macOS, Go binary, low risk, covers 80% of needs (text, images, groups)
2. **If full features needed** (voice, advanced group management), set up a **Windows VM with WeChatFerry** — most reliable and feature-complete
3. **Keep WeCom API as backup** — zero ban risk, official support, but limited to WeCom contacts

The OpenClaw plugin architecture should abstract the bridge backend so either openwechat or WeChatFerry can be swapped without changing the plugin code.

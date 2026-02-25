# GOALS.md — Active Goals

## 🖥️ Mac App
**Status**: Active
- [x] Core chat UI (List-based, streaming, timestamps)
- [x] Session management (tabs, rename, dropdown)
- [x] ~~Goals panel~~ (removed 2026-02-20 - goals now backend-only via scripts)
- [x] Chat header + badges
- [x] Message filtering (sub-agents, heartbeats, etc.)
- [~] Read indicator (2s delay + 1s fade)
- [ ] Markdown rendering in messages

## 🔗 Relay Service
**Status**: Done ✅
- [x] Phase 1 — Core relay server (Go)
- [x] Phase 2 — Gateway plugin (Node.js, 69 tests, >95% coverage)
- [x] Phase 3 — Swift client (99 tests, zero deps)

## 📱 iPhone App
**Status**: Paused (waiting for Mac app to stabilize)
- [ ] Platform guards for iOS
- [ ] iPhone navigation (stack nav)
- [ ] TestFlight setup

## 🏜️ AK Mojave Keeper
**Status**: Active
- [x] Victron energy dashboard (API connected, token in Keychain)
- [~] Battery monitoring (hourly cron, alerts on low/offline)
- [ ] Video surveillance events

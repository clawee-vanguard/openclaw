# Relay v2 Architecture Overhaul - Design & Implementation Plan

**Task ID**: `relay-5`  
**Priority**: High - Foundation for Clawee app integration  
**Status**: In Progress (Claudee implementing)

## 🎯 **Key Architectural Changes**

### 1. **Fingerprint-Based URLs** 
- **Before**: `ws://relay:8443/ws/gateway/{FULL_PUBKEY_BASE64}`
- **After**: `ws://relay:8443/ws/gateway/{16_CHAR_HEX_FINGERPRINT}`
- **Benefits**: Cleaner URLs, faster routing, easier debugging
- **Example**: `ws://relay:8443/ws/gateway/a37e3aba3344d19f`

### 2. **Enhanced Security & Validation**
- Drop connections with missing/wrong fingerprints immediately
- Verify RSA message signatures before forwarding
- Reject invalid signatures (no relay of bad messages)
- Gateway plugin identifies message source (which client)

### 3. **Message Flow Control**
- **Gateway Plugin**: Queues messages (process one at a time)
- **Wait Pattern**: Wait for response before processing next message
- **Broadcasting**: Push responses to ALL registered clients
- **State Management**: Relay manages client connection state only

### 4. **Database Enhancements**
```sql
-- Add fingerprint support
ALTER TABLE routes ADD COLUMN fingerprint TEXT;
CREATE INDEX idx_routes_fingerprint ON routes(fingerprint);

-- Migration: populate fingerprints from existing pubkeys
UPDATE routes SET fingerprint = substr(hex(sha256(gateway_pubkey)), 1, 16);
```

### 5. **Production Security (SQLite Encryption)**
- Use `RELAY_DB_KEY` environment variable for encryption key
- Auto-generate secure key on deployment  
- Encrypt ALL data at rest (routes, clients, messages, logs)
- Zero plaintext data on disk

## 🔄 **Implementation Phases**

### **Phase 1: Foundation Changes** ✅
1. Update WebSocket URL routing to fingerprint-based
2. Add fingerprint column to database schema
3. Update server connection handling
4. **Clean v2 implementation** (no backward compatibility needed)

### **Phase 2: Security Enhancements** ⏳
5. Implement signature verification for all messages
6. Add connection validation (drop bad fingerprints)
7. Add message source identification system
8. Update gateway plugin to handle client identification

### **Phase 3: Advanced Message Handling** ⏳
9. Implement message queueing in gateway plugin
10. Add response broadcasting to all clients
11. Implement proper state management in relay service
12. Ensure relay service only forwards (no business logic)

### **Phase 4: Production Security** ⏳
13. Implement SQLite encryption with env key
14. Add secure key generation for deployment
15. Encrypt all existing data during migration
16. Add database initialization with encryption

### **Phase 5: Testing & Documentation** ⏳
17. Comprehensive testing of all new features
18. Update ARCHITECTURE.md with new message flow
19. Document breaking changes and migration steps
20. Create deployment guide with encryption setup

## 🚨 **Breaking Changes**

### **WebSocket URLs**
- **Old**: Full base64 pubkey in URL (long, unwieldy)
- **New**: 16-character hex fingerprint (clean, fast)
- **Migration**: All clients must update connection strings

### **Database Schema**
- New `fingerprint` column in routes table
- New indexes for fingerprint-based lookup
- Data migration required for existing routes

### **Gateway Plugin Config**
- Must use fingerprint instead of full pubkey in connection URL
- Update OpenClaw plugin configuration
- May need plugin restart after relay deployment

### **Client Applications**
- Update to use fingerprint-based connection URLs
- May need RSA key regeneration if fingerprint calculation changes
- Update pairing flow to exchange fingerprints

## 📋 **Migration Path**

### **Step 1: Deploy New Relay Service**
```bash
# Set encryption key
export RELAY_DB_KEY=$(openssl rand -hex 32)

# Clean v2 deployment (version upgrade)
./deploy-relay-v2.sh --clean-install
```

### **Step 2: Update Gateway Plugin**
```json
{
  "relayUrl": "ws://localhost:8443",
  "fingerprint": "a37e3aba3344d19f", 
  "deviceId": "gateway",
  "deviceSecret": "secure-token"
}
```

### **Step 3: Update Client Apps**
- Generate fingerprints from existing RSA keys
- Update connection strings to use fingerprints
- Test end-to-end message flow

### **Step 4: Finalize v2 Deployment**
- Verify all fingerprint-based connections work
- Test signature verification and encryption
- Update documentation for v2 architecture

## 🏗️ **Architecture After Implementation**

```
CLIENT APP (RSA Key + Fingerprint)
    ↓ ws://relay:8443/ws/client/{FINGERPRINT}
    ↓ [Signed Message]
    ↓
RELAY SERVICE (Signature Verification)
    ↓ [Verified Message Forward]
    ↓
GATEWAY PLUGIN (Message Queue + Client ID)
    ↓ [Process One at a Time]
    ↓
OPENCLAW (Business Logic)
    ↓ [Response]
    ↓
GATEWAY PLUGIN (Broadcast Response)
    ↓ [Same Response to All Clients]
    ↓
RELAY SERVICE (Forward to All)
    ↓ ws://relay:8443/ws/client/{FINGERPRINT}
    ↓
ALL CLIENT APPS (Receive Response)
```

## 📝 **Git Commit Plan**

After implementation completion:

```bash
git add -A
git commit -m "relay-5: Major architecture overhaul

BREAKING CHANGES:
- WebSocket URLs now use fingerprint instead of full pubkey
- Added fingerprint column to routes table
- Implemented message signature verification
- Added SQLite encryption with RELAY_DB_KEY
- Gateway plugin now queues messages and identifies clients
- Response broadcasting to all registered clients

Migration required:
- Update gateway plugin config to use fingerprints
- Set RELAY_DB_KEY environment variable
- Update client apps to fingerprint-based URLs

Security improvements:
- All messages verified before forwarding
- Invalid signatures dropped immediately  
- All data encrypted at rest
- Connection validation enhanced

Features added:
- Message queueing in gateway plugin
- Client identification system
- State management in relay service
- Proper response broadcasting

Closes: relay-5"
```

## 🔄 **Next Steps After Completion**

1. **Clawee App Integration**:
   - Add client RSA key generation to settings
   - Implement fingerprint-based connection config
   - Add relay mode toggle with RSA key management

2. **End-to-End Testing**:
   - Test message flow with multiple clients
   - Verify signature verification works
   - Test SQLite encryption
   - Validate response broadcasting

3. **Production Deployment**:
   - Generate secure `RELAY_DB_KEY`
   - Deploy encrypted relay service
   - Update all client configurations
   - Monitor message flow and performance

This design establishes a **production-ready, secure, and scalable** foundation for the Clawee relay system! 🚀
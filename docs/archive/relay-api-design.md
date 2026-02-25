# Relay Service Registration API Design
## Multi-Layer Encrypted Architecture v2

## Overview
```
Client App ←→ Relay Service ←→ Gateway Plugin ←→ OpenClaw Gateway
    ↓              ↓              ↓                ↓
Client RSA    Relay RSA     Gateway RSA      Gateway APIs
Encryption    Routes        Decryption       (chat.send, etc.)
```

## 1. Setup Flow

### Gateway Plugin Installation & Setup
1. **Gateway plugin installs to OpenClaw**
   - Generates RSA-2048 keypair on installation
   - Stores private key securely in plugin data directory
   - Exposes public key via agent chat

2. **Gateway Registration (Manual via Agent Chat)**
   - Agent displays gateway public key
   - User copies gateway public key
   - User calls `relay-cli` on docker server to register gateway:
   ```bash
   relay-cli gateway register --pubkey "-----BEGIN PUBLIC KEY-----..." --name "my-gateway"
   ```

3. **Gateway Plugin Downloads Relay Public Key**
   - Gateway plugin calls relay service via agent chat
   - Downloads relay service public key for encryption
   - Stores relay pubkey locally for API calls

## 2. Relay Service APIs

### Authentication Model
- **Gateway Fingerprint Auth**: Routes identified by gateway fingerprint
- **Client Signature Verification**: Client requests verified with client pubkey signature  
- **Special Bootstrap API**: `api/gateway/register` allows fingerprint-only auth for first device

### GET /api/relay-pubkey
**Purpose**: Gateway plugin downloads relay service public key
**Auth**: Gateway fingerprint + RSA signature verification
**Request Headers**:
```
X-Gateway-Fingerprint: 496d3646d1a80699
X-Gateway-Signature: base64_rsa_pss_signature
X-Timestamp: 1708646400
```
**Response**:
```json
{
  "publicKey": "-----BEGIN PUBLIC KEY-----\n...",
  "fingerprint": "relay_service_fp", 
  "keyVersion": "v1",
  "expires": "2027-02-22T00:00:00Z"
}
```

### POST /api/gateway/register ⭐ **Special Bootstrap API**
**Purpose**: Forward first device registration to gateway plugin (fingerprint-only auth)
**Auth**: Gateway fingerprint verification ONLY (no client pubkey required)
**Flow**: Relay Service → Gateway Plugin (encrypted payload forwarding)
**Request Headers**:
```
X-Gateway-Fingerprint: 496d3646d1a80699
Content-Type: application/json
```
**Request Body** (Encrypted payload for gateway plugin):
```json
{
  "encryptedData": "base64_aes_encrypted_payload",
  "encryptedKey": "base64_rsa_encrypted_aes_key", 
  "algorithm": "RSA-OAEP+AES-256-GCM"
}
```
**Gateway Plugin Receives** (After decryption):
```json
{
  "type": "relay",
  "api": "devices/primary",
  "data": {
    "deviceId": "2024-mindetta-m4",
    "deviceName": "MacBook Pro M4",
    "clientPubKey": "-----BEGIN PUBLIC KEY-----\n...",
    "timestamp": 1708646400
  }
}
```
**Gateway Plugin Logic**:
- Check if ANY client device already registered locally
- If NO devices: Approve and register as primary device
- If devices exist: Reject (must use standard approval flow)

### POST /api/gateway/{gateway_fingerprint} 
**Purpose**: Forward client requests to gateway plugin (full auth required)
**Auth**: Gateway fingerprint + Client signature verification
**Flow**: Client → Relay Service → Gateway Plugin
**Request Headers**:
```
X-Client-Fingerprint: 82a239990186ecc1
X-Client-Signature: base64_client_rsa_pss_signature  
X-Timestamp: 1708646400
```
**Authentication Logic**:
1. Verify gateway fingerprint exists in routes table
2. Verify client fingerprint exists in clients table for this gateway  
3. Verify client signature with stored client pubkey
4. Forward encrypted payload to gateway plugin
5. Return 403 if any verification fails

### POST /api/devices/register (Internal - Gateway Plugin → Relay Service)
**Purpose**: Gateway plugin registers approved client with relay service
**Auth**: Gateway fingerprint + RSA signature
**Request** (Encrypted with Relay Service Public Key):
```json
{
  "gatewayFingerprint": "496d3646d1a80699",
  "clientDeviceId": "2024-mindetta-m4",
  "clientPubKey": "-----BEGIN PUBLIC KEY-----\n...",
  "clientFingerprint": "82a239990186ecc1", 
  "signature": "base64_gateway_signature",
  "timestamp": 1708646400
}
```

### POST /api/devices/revoke (Internal - Gateway Plugin → Relay Service)
**Purpose**: Gateway plugin revokes client access
**Request** (Encrypted with Relay Service Public Key):
```json
{
  "gatewayFingerprint": "496d3646d1a80699",
  "clientFingerprint": "82a239990186ecc1",
  "reason": "device_lost",
  "signature": "base64_gateway_signature",
  "timestamp": 1708646400
}
```

## 3. Gateway Plugin APIs (Received via Relay Forwarding)

### devices/primary (Bootstrap Registration)
**Purpose**: Register first device (gateway has no existing devices)
**Client Call Flow**:
1. Client encrypts payload with gateway public key
2. Client calls `POST /api/gateway/register` (special bootstrap API)
3. Relay service forwards to gateway plugin (no client signature required)
4. Gateway plugin checks: no existing devices? → Approve
5. Gateway plugin stores client locally
6. Gateway plugin calls relay service to register client
7. Success response

**Payload Structure** (Decrypted at gateway):
```json
{
  "type": "relay", 
  "api": "devices/primary",
  "data": {
    "deviceId": "2024-mindetta-m4",
    "deviceName": "MacBook Pro M4",
    "clientPubKey": "-----BEGIN PUBLIC KEY-----\n...",
    "timestamp": 1708646400
  }
}
```

### devices/register (Standard Registration)  
**Purpose**: Register additional devices (requires existing device approval)
**Client Call Flow**:
1. Client encrypts payload with gateway public key
2. Client calls `POST /api/gateway/{fingerprint}` (requires client signature)
3. Relay service verifies client fingerprint + signature
4. Relay service forwards to gateway plugin
5. Gateway plugin queues for approval by existing device
6. Existing device approves → gateway plugin registers with relay service

**Payload Structure**:
```json
{
  "type": "relay",
  "api": "devices/register", 
  "data": {
    "deviceId": "iPhone-15-Pro",
    "deviceName": "iPhone 15 Pro",
    "clientPubKey": "-----BEGIN PUBLIC KEY-----\n...",
    "timestamp": 1708646400
  }
}
```

### devices/revoke
**Purpose**: Revoke device access
**Payload Structure**:
```json
{
  "type": "relay",
  "api": "devices/revoke",
  "data": {
    "clientFingerprint": "82a239990186ecc1", 
    "reason": "device_lost",
    "timestamp": 1708646400
  }
}
```

### Gateway Internal APIs (Reference Only)
**Purpose**: All other gateway APIs (chat.send, sessions.list, etc.)
**Structure**: Standard OpenClaw gateway API format
**Payload Structure**:
```json
{
  "type": "gateway",
  "api": "chat.send",
  "data": {
    "message": "Hello world",
    "sessionKey": "session_key",
    "params": {...}
  }
}
```
**Note**: Gateway plugin forwards these directly to OpenClaw Gateway. See OpenClaw Gateway API documentation for complete method list.

## 4. Authentication & Authorization Matrix

| API Endpoint | Gateway Auth | Client Auth | Purpose |
|--------------|-------------|-------------|---------|
| `/api/relay-pubkey` | Fingerprint + Signature | None | Gateway downloads relay pubkey |
| `/api/gateway/register` | Fingerprint Only | None | Bootstrap first device |
| `/api/gateway/{fingerprint}` | Route exists | Fingerprint + Signature | Standard client requests |
| `/api/devices/register` | Fingerprint + Signature | N/A | Gateway registers client |
| `/api/devices/revoke` | Fingerprint + Signature | N/A | Gateway revokes client |

## 5. Registration Flow Scenarios

### Scenario 1: First Device (Primary)
```
Client → POST /api/gateway/register (fingerprint auth only)
     ↓
Relay Service (verifies gateway fingerprint) 
     ↓ 
Gateway Plugin (no devices exist → approve)
     ↓
Gateway Plugin → POST /api/devices/register (to relay service)
     ↓
Client registered successfully
```

### Scenario 2: Additional Device  
```
Client → POST /api/gateway/{fingerprint} (client signature required)
     ↓
Relay Service (verifies gateway route + client signature)
     ↓
Gateway Plugin (devices exist → queue for approval)
     ↓ 
Existing Device approves new device
     ↓
Gateway Plugin → POST /api/devices/register (to relay service)
     ↓
Client registered successfully  
```

### Scenario 3: Unauthorized Client
```
Client → POST /api/gateway/{fingerprint} 
     ↓
Relay Service checks client fingerprint → NOT FOUND
     ↓
Return 403 Forbidden (client not registered)
```

## 6. Security Model

### Multi-Layer Verification
1. **Gateway Route Verification**: Fingerprint must exist in routes table
2. **Client Identity Verification**: Fingerprint must exist in clients table  
3. **Signature Verification**: All requests signed with appropriate private key
4. **Payload Encryption**: End-to-end encryption (relay service cannot see content)
5. **Bootstrap Protection**: First device registration protected by gateway-only auth

### Key Benefits
- ✅ **Gateway Authority**: Gateway controls all device registrations
- ✅ **Client Privacy**: Relay service cannot decrypt client payloads  
- ✅ **Bootstrap Security**: First device registration requires gateway pubkey
- ✅ **Signature Integrity**: All requests cryptographically verified
- ✅ **Route Isolation**: Each gateway has isolated client namespace

## 7. Implementation Priority

### Phase 1: Core Infrastructure
1. Relay service RSA key generation
2. Gateway registration via relay-cli  
3. Gateway plugin relay pubkey download
4. Basic encryption/decryption implementation

### Phase 2: Bootstrap Registration  
1. `/api/gateway/register` special endpoint
2. `devices/primary` gateway plugin method
3. Client hybrid encryption implementation
4. First device registration flow

### Phase 3: Standard Registration
1. `/api/gateway/{fingerprint}` endpoint with full auth
2. `devices/register` with approval queue
3. Client signature verification
4. Multi-device management

This design provides:
- ✅ **Secure bootstrap for first device**
- ✅ **Controlled approval for additional devices** 
- ✅ **Complete authentication matrix**
- ✅ **Clear separation between bootstrap and standard flows**
- ✅ **Gateway plugin authority over device management**
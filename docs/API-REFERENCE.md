# OpenClaw WebChat API Reference

## Connection
- Gateway WebSocket: `ws://127.0.0.1:18789` (default)
- Text frames, JSON payloads
- First frame must be `connect` request

## Handshake

### Challenge (Gateway → Client)
```json
{"type":"event","event":"connect.challenge","payload":{"nonce":"…","ts":1737264000000}}
```

### Connect (Client → Gateway)
```json
{
  "type": "req", "id": "…", "method": "connect",
  "params": {
    "minProtocol": 3, "maxProtocol": 3,
    "client": {"id": "clawtalk", "version": "1.0.0", "platform": "ios", "mode": "operator"},
    "role": "operator",
    "scopes": ["operator.read", "operator.write"],
    "auth": {"token": "…"},
    "device": {"id": "…", "publicKey": "…", "signature": "…", "signedAt": …, "nonce": "…"}
  }
}
```

### Hello OK (Gateway → Client)
```json
{"type":"res","id":"…","ok":true,"payload":{"type":"hello-ok","protocol":3}}
```

## Frame Types
- **Request**: `{type:"req", id, method, params}`
- **Response**: `{type:"res", id, ok, payload|error}`
- **Event**: `{type:"event", event, payload}`

## Chat Methods
- `chat.history` — fetch message history
- `chat.send` — send a message (non-blocking, streams response via `chat` events)
- `chat.abort` — stop a running response
- `chat.inject` — append assistant note (no agent run)

## Sessions
- `sessions.list` — list available sessions
- `sessions.patch` — update session settings

## Auth
- Token-based: `connect.params.auth.token`
- Device identity required for non-local connections

## Protocol Source
Full TypeBox schemas: `src/gateway/protocol/schema.ts` in the OpenClaw repo
Generate Swift models: `pnpm protocol:gen:swift`

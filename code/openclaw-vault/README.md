# OpenClaw Vault Plugin

The OpenClaw Vault plugin provides end-to-end encryption for all agent data at rest, including messages, workspace files, and transcripts.

## Architecture

- **Master Key**: Stored securely in macOS Keychain
- **Key Management**: JSON-based key storage with encrypted per-agent keys  
- **Agent Data**: Each agent gets its own encrypted storage vault
- **Encryption**: AES-GCM with PBKDF2 key derivation using node-forge

## Features

### 🔐 Core Security
- Master key stored in macOS Keychain (`openclaw-vault` service)
- Per-agent encryption keys derived from master key
- AES-GCM encryption with authenticated encryption
- PBKDF2 key derivation (10,000 iterations, SHA-256)

### 🗂️ Data Protection
- **Messages**: Encrypt all chat messages and transcripts
- **Workspace Files**: Encrypt MEMORY.md, SOUL.md, AGENTS.md, USER.md, etc.
- **Daily Notes**: Encrypt agent memory files  
- **Auth Profiles**: (Coming soon)

### 🔧 Plugin Hooks
- `message_persist`: Intercepts messages before plaintext storage
- `agent_bootstrap`: Decrypts workspace files on agent startup

### 🛠️ Tools & CLI
- `vault_read` / `vault_write` tools for encrypted file operations
- `openclaw vault status` - Show vault status
- `openclaw vault init` - Initialize vault 
- `openclaw vault migrate` - Migrate existing files to encrypted storage

## Installation

1. Copy plugin to extensions directory:
```bash
cp -r ~/.openclaw/agents/claudee/workspace/openclaw-vault ~/.openclaw/extensions/
```

2. Enable in OpenClaw config:
```json
{
  "plugins": {
    "entries": {
      "vault": {
        "enabled": true,
        "config": {
          "autoMigrate": false,
          "preventPlaintextStorage": false
        }
      }
    }
  }
}
```

3. Restart OpenClaw Gateway:
```bash
openclaw gateway restart
```

4. Initialize vault:
```bash
openclaw vault init
```

## Configuration

```json
{
  "plugins": {
    "entries": {
      "vault": {
        "enabled": true,
        "config": {
          "keychainService": "openclaw-vault",
          "autoMigrate": false,
          "keyRotationDays": 365,
          "dbPath": "~/.openclaw/vault/",
          "preventPlaintextStorage": false
        }
      }
    }
  }
}
```

**Config Options:**
- `keychainService`: macOS Keychain service name for master key
- `autoMigrate`: Auto-migrate existing files on startup
- `keyRotationDays`: Days before key rotation reminder
- `dbPath`: Path for encrypted storage (defaults to ~/.openclaw/vault/)
- `preventPlaintextStorage`: Block plaintext storage completely

## Usage

### Basic Commands

```bash
# Check vault status
openclaw vault status

# Initialize vault (creates master key)
openclaw vault init

# Migrate existing files
openclaw vault migrate --agent-id claudee --workspace ~/.openclaw/agents

# Dry run migration
openclaw vault migrate --dry-run
```

### Agent Tools

```javascript
// Read encrypted file
const result = await vault_read({ 
  file_path: "MEMORY.md", 
  agent_id: "claudee" 
});

// Write encrypted file  
await vault_write({
  file_path: "MEMORY.md",
  content: "# My encrypted memories...",
  agent_id: "claudee"
});
```

### Gateway RPC

```javascript
// Check status
const status = await gateway.rpc("vault.status");

// Encrypt message
await gateway.rpc("vault.encryptMessage", {
  agentId: "claudee",
  sessionId: "session_123", 
  messageData: { text: "Hello world", timestamp: Date.now() }
});
```

## Security Model

1. **Master Key**: 256-bit key generated with cryptographically secure randomness
2. **Key Storage**: Master key stored in macOS Keychain (encrypted at OS level)
3. **Agent Keys**: 256-bit per-agent keys, encrypted with master key
4. **Data Encryption**: AES-GCM (256-bit) with random IV and salt per operation
5. **Key Derivation**: PBKDF2 with 10,000 iterations and SHA-256

## File Structure

```
~/.openclaw/vault/
├── keys.json              # Encrypted agent keys
├── metadata.json          # Vault metadata
├── agent-default/         # Default agent vault
│   ├── files.json         # Encrypted workspace files
│   └── messages.json      # Encrypted message transcripts
└── agent-claudee/         # Agent-specific vault
    ├── files.json
    └── messages.json
```

## Development

### Building
```bash
cd ~/.openclaw/agents/claudee/workspace/openclaw-vault
npm install
```

### Testing Hooks
The plugin registers hooks that can be tested:
- Message persistence is intercepted automatically
- Agent bootstrap decrypts workspace files on startup

### Adding New Features
- Extend `VaultService` for new data types
- Add RPC methods for new operations
- Create additional hooks for new intercept points

## Troubleshooting

### Common Issues

**Vault service not running**
- Ensure plugin is enabled in config
- Restart OpenClaw Gateway
- Check `openclaw vault status`

**Master key not found**
- Run `openclaw vault init`
- Check macOS Keychain Access for `openclaw-vault` entry

**Permission denied on keychain**
- Keychain may require user authorization on first access
- Check macOS Keychain Access permissions

**Hook not intercepting**
- Verify hooks are registered: check startup logs
- Ensure plugin hooks directory exists
- Restart gateway after hook changes

### Logs
Check OpenClaw Gateway logs for vault-related messages:
```bash
openclaw gateway logs | grep -i vault
```

## Roadmap

- [ ] Message hook implementation (depends on OpenClaw fork)
- [ ] Auth profiles encryption
- [ ] Key rotation automation  
- [ ] Backup/restore functionality
- [ ] Multi-device key synchronization
- [ ] Performance optimizations for large datasets

## Security Considerations

- Master key is only in memory when vault service is running
- Agent keys are decrypted on-demand and cached in memory
- All files are encrypted at rest, but decrypted for agent processing
- Plugin runs in-process with OpenClaw Gateway (trusted environment)
- macOS Keychain provides OS-level encryption for master key storage

## License

This plugin is part of the OpenClaw ecosystem and follows the same licensing terms.
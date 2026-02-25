# ARCHITECTURE TERMINOLOGY — OpenClaw & Clawee System

**Lock ID**: relay-server-8 (IMMUTABLE without J's explicit override)

## Core Architecture: Two-Layer System

### Gateway Layer + Relay Layer

The OpenClaw & Clawee system uses a **two-layer architecture** that provides both local gateway management and remote access capabilities. These layers have **distinct pairing processes** that must never be conflated.

## Pairing Process Definitions

### OpenClaw Device Pairing
- **Definition**: Plugin (as gateway client) connects to OpenClaw gateway with device pairing
- **Layer**: Gateway Layer (local)
- **Process**: Gateway Plugin → OpenClaw Gateway registration
- **Authentication**: Plugin credentials with OpenClaw gateway
- **Purpose**: Establishes plugin as authorized gateway client for local management
- **Scope**: Local OpenClaw instance operations
- **Security Model**: Local trust, direct gateway authentication
- **Files/Config**: Gateway plugin configuration, OpenClaw device registry

### Clawee Device Pairing
- **Definition**: Client app connects to plugin over relay service
- **Layer**: Relay Layer (remote) 
- **Process**: Client App → Gateway Plugin pairing via relay service
- **Authentication**: RSA keys, hybrid encryption, relay tokens
- **Purpose**: Enables remote access to gateway functionality through relay
- **Scope**: Remote client access through relay infrastructure
- **Security Model**: End-to-end encryption, zero-trust relay
- **Files/Config**: Relay service routing, client certificates, encrypted device registry

## Key Distinctions

| Aspect | OpenClaw Device Pairing | Clawee Device Pairing |
|--------|-------------------------|----------------------|
| **Layer** | Gateway Layer (local) | Relay Layer (remote) |
| **Direction** | Plugin → Gateway | Client → Plugin |
| **Purpose** | Gateway management | Remote access |
| **Auth Method** | Plugin credentials | RSA + E2E encryption |
| **Trust Model** | Local trust | Zero-trust relay |
| **Network** | Local/direct | Internet/relay |
| **Data Storage** | Gateway device registry | Relay + encrypted client registry |

## Common Mistakes to Avoid

1. **Conflating the pairing processes** - They are completely separate systems
2. **Using "device pairing" without qualification** - Always specify OpenClaw vs Clawee
3. **Mixing authentication methods** - Gateway auth vs relay auth are different
4. **Confusing data storage** - Gateway registry vs relay routing are separate
5. **Assuming single-layer security** - Each layer has its own security model

## Correct Usage Examples

✅ **Correct**:
- "OpenClaw device pairing allows the plugin to register with the local gateway"
- "Clawee device pairing enables remote client access through the relay service" 
- "The client completes Clawee device pairing to establish encrypted relay access"
- "The plugin uses OpenClaw device pairing for local gateway integration"

❌ **Incorrect**:
- "Device pairing connects the client to the gateway" (conflates both)
- "The app registers with OpenClaw" (wrong layer)
- "The plugin pairs with the relay" (wrong direction)
- "Device pairing uses RSA encryption" (unclear which pairing)

## Implementation Guidelines

### Documentation
- Always qualify "device pairing" as "OpenClaw" or "Clawee"
- Include layer information (Gateway Layer / Relay Layer)
- Specify authentication method and security model
- Reference this terminology guide for consistency

### Code & APIs
- Use distinct namespaces: `gateway.device.*` vs `relay.device.*`
- Separate configuration files and data structures
- Different error codes and status messages
- Clear API method names that indicate layer

### Testing
- Test each pairing process independently
- Separate integration test suites
- Mock the opposite layer when testing one layer
- Validate that failures in one layer don't affect the other

## Architectural Benefits

This two-layer separation provides:

1. **Clear Separation of Concerns**: Local gateway management vs remote access
2. **Independent Security Models**: Local trust vs zero-trust relay
3. **Scalable Architecture**: Can scale relay layer without affecting gateway layer
4. **Flexible Deployment**: Can deploy gateway-only or gateway+relay configurations
5. **Maintainable Code**: Clear boundaries prevent coupling and confusion

## Future Considerations

- **Layer Independence**: Changes to one layer should not require changes to the other
- **Protocol Versioning**: Each layer can evolve its protocols independently  
- **Security Updates**: Security improvements can target specific layers
- **Feature Development**: New features should clearly target one layer or specify cross-layer requirements

---

**This terminology is locked by evo protocol (relay-server-8) and cannot be modified without J's explicit approval.**
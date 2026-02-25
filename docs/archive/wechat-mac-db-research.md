# WeChat Mac Local Database Research

> Last updated: 2026-02-14
> Status: Research findings — many open-source tools have been taken down due to Tencent legal action (notably PyWxDump received a lawyer's letter in Oct 2025 and deleted all code).

---

## 1. Where WeChat Mac Stores Its Data

WeChat for Mac stores data under:

```
~/Library/Containers/com.tencent.xinWeChat/Data/Library/Application Support/com.tencent.xinWeChat/
```

Inside this directory, the structure is versioned:

```
<version_hash>/              # e.g., "2.0b4.0.9" or a hash like "a]1b2c3d..."
  └── <account_md5_hash>/   # MD5 of your wxid or UIN
      ├── Message/           # Message databases
      │   ├── msg_0.db
      │   ├── msg_1.db
      │   ├── ...
      │   └── msg_N.db      # Messages sharded across multiple DBs
      ├── Contact/
      │   └── wccontact_new2.db   # Contact database
      ├── Group/
      │   └── group_new.db        # Group info
      ├── Favorites/
      ├── OpenIM/
      └── Session/
          └── session.db          # Recent session/conversation list
```

**Version path**: The first subdirectory corresponds to the WeChat version. It may look like `2.0b4.0.9` or a seemingly random hash. You can identify the active one by looking at modification times.

**Account hash**: The second level is an MD5 hash derived from your WeChat account identifier (wxid). If you only have one account logged in, there will be only one subdirectory.

**Finding the exact path programmatically:**
```bash
find ~/Library/Containers/com.tencent.xinWeChat -name "msg_0.db" 2>/dev/null
```

---

## 2. Database Format

The databases are **SQLite** files, but they are **encrypted** using [SQLCipher](https://www.zetetic.net/sqlcipher/) (AES-256-CBC encryption at the page level).

If you try to open them with a standard `sqlite3` tool, you'll get "file is not a database" or similar errors.

### Key databases:
| File | Contents |
|------|----------|
| `msg_0.db` .. `msg_N.db` | Chat messages, sharded by conversation hash |
| `wccontact_new2.db` | Contacts (friends, groups, official accounts) |
| `group_new.db` | Group membership and metadata |
| `session.db` | Active conversation list / recent chats |
| `MicroMsg.db` (older versions) | Combined messages DB in some earlier versions |

---

## 3. Encryption & Decryption

### How the DB is encrypted
- WeChat uses **SQLCipher** with a 256-bit AES key
- The encryption key is **not** stored on disk in plaintext

### Key derivation on macOS
The encryption key can be extracted from the **running WeChat process memory**. The approach:

1. **Attach to the WeChat process** using `lldb` (macOS debugger)
2. **Find the key in memory** — the SQLCipher key is held as a raw 32-byte value in the process's heap
3. The key is typically found near specific function calls or data structures

#### Method A: Using lldb (most documented approach)

```bash
# 1. Find WeChat PID
pgrep WeChat

# 2. Attach lldb
lldb -p <PID>

# 3. Search for the key in memory
# The key is typically passed to sqlite3_key() — set a breakpoint:
br set -n sqlite3_key
# Then trigger a DB operation (e.g., receive a message)
# When breakpoint hits, inspect the key argument (usually in register x1/rsi, length in x2/rdx)

# Alternative: scan memory for the key pattern
# The key is 32 bytes and often near specific structures
```

#### Method B: Using LLDB with known offsets

Some tools automated this by:
1. Finding the `sqlite3_key` symbol in the WeChat binary
2. Setting a breakpoint on it
3. Reading the key from the first argument register
4. The key is the same for all databases of that account

#### Method C: Keychain (older versions)
In some older WeChat Mac versions (pre-3.x), the key was stored in the macOS Keychain under the WeChat app's keychain group. This is **no longer the case** in recent versions.

### Decrypting the database once you have the key

```python
# Using pysqlcipher3
from pysqlcipher3 import dbapi2 as sqlite

db = sqlite.connect('msg_0.db')
db.execute(f"PRAGMA key = \"x'{hex_key}'\";")
db.execute("PRAGMA cipher_compatibility = 3;")  # or 4 depending on version
# Now you can query normally
cursor = db.execute("SELECT * FROM sqlite_master;")
```

Or using the `sqlcipher` CLI:
```bash
sqlcipher msg_0.db
> PRAGMA key = "x'<64-char-hex-key>'";
> PRAGMA cipher_compatibility = 3;
> .tables
```

### SQLCipher version notes
- WeChat Mac 3.x+ typically uses SQLCipher 4 defaults (or sometimes compatibility mode 3)
- You may need to try different `cipher_page_size` and `kdf_iter` values
- Common settings: `cipher_page_size = 1024`, `kdf_iter = 64000` (SQLCipher 3 compat) or `kdf_iter = 256000` (SQLCipher 4)

---

## 4. Existing Tools & Projects

### ⚠️ Major caveat: Tencent crackdown
As of October 2025, **PyWxDump** (the most popular tool, ~15k+ stars) was taken down after the author received a formal lawyer's letter from Tencent/WeChat legal. The repo now contains only a notice. Many forks have also been removed.

### Projects (historical/archived — may need to find cached forks):

| Project | Platform | Status | Notes |
|---------|----------|--------|-------|
| **PyWxDump** (xaoyaoo) | Windows primarily, some Mac | ❌ Deleted Oct 2025 | Was the gold standard. Automated key extraction + DB decryption + web viewer |
| **WeChatExporter** (BlueMatthew) | Mac/Win (iOS backups) | ✅ Active | Reads **iTunes/Finder backups** of iOS WeChat, NOT the Mac app directly |
| **WeChatExporter** (tsycnh) | Mac (iOS backups) | ⚠️ Abandoned | Same — iOS backup reader |
| **wechat-dump** (ppwwyyxx) | Linux/Mac | ⚠️ Old | Early tool for Android WeChat DB, some Mac support |
| **WeChatMsg** (LC044) | Windows | ❓ May be taken down | Similar to PyWxDump, Windows-focused |
| **mac-wechat-decrypt** (various) | Mac | ❓ Scattered forks | Various one-off scripts for Mac key extraction |

### Finding surviving forks
Since main repos are being taken down, search for:
- Archived copies on archive.org
- GitLab mirrors
- Chinese platforms: Gitee, CSDN blog posts with code snippets
- The PyWxDump approach was well-documented in blog posts before takedown

---

## 5. Real-Time Monitoring

### Approach A: Poll the SQLite database
Once decrypted (or accessing via SQLCipher with the key), you can poll for new messages:

```python
import time

last_rowid = get_max_rowid()
while True:
    time.sleep(2)  # Poll every 2 seconds
    new_messages = query("SELECT * FROM MSG WHERE localId > ?", last_rowid)
    for msg in new_messages:
        process_message(msg)
        last_rowid = msg['localId']
```

**Caveats:**
- SQLite WAL mode: WeChat uses WAL (Write-Ahead Logging), so you need to handle WAL correctly
- File locking: Opening the DB read-only while WeChat has it open works in WAL mode
- You MUST open with the correct SQLCipher key each time
- Messages across sharded DBs: You need to watch ALL `msg_*.db` files

### Approach B: Filesystem events (fsevents / kqueue)
Monitor the `Message/` directory for file changes:

```python
from watchdog import Observer, FileSystemEventHandler
# Watch for modifications to msg_*.db files
# When a change is detected, query for new messages
```

This is more efficient than polling but still requires opening the encrypted DB to read content.

### Approach C: LLDB injection / function hooking
More advanced: hook WeChat's message processing functions using DYLD injection or lldb to intercept messages as they arrive in memory (before DB write). This is fragile and breaks with updates.

### Recommended approach
**Filesystem events + DB polling hybrid**: Watch for file modifications, then query the DB when changes are detected. This minimizes unnecessary DB access while catching messages promptly.

---

## 6. Sending Messages

There is **no official API** for sending messages through WeChat Mac. Options:

### Option A: macOS Accessibility API (UI Automation)
Use AppleScript or the Accessibility framework to automate the WeChat UI:

```applescript
tell application "WeChat" to activate
tell application "System Events"
    tell process "WeChat"
        -- Find the search field, type contact name
        -- Select conversation
        -- Type message in the input field
        -- Press Enter to send
    end tell
end tell
```

**Pros:** Works without touching internals, survives updates
**Cons:** Fragile UI automation, requires WeChat window visible, slow, can't run headless

### Option B: AppleScript + Accessibility (more robust)

```python
import subprocess

def send_wechat_message(contact, message):
    script = f'''
    tell application "WeChat" to activate
    delay 0.5
    tell application "System Events"
        tell process "WeChat"
            -- Cmd+F to search
            keystroke "f" using command down
            delay 0.3
            keystroke "{contact}"
            delay 1
            keystroke return
            delay 0.5
            keystroke "{message}"
            keystroke return
        end tell
    end tell
    '''
    subprocess.run(['osascript', '-e', script])
```

### Option C: Direct protocol (extremely difficult)
WeChat uses a proprietary protocol (mmtls + protobuf). Reverse engineering it is:
- Legally risky (Tencent actively pursues this)
- Technically difficult (certificate pinning, device binding, encryption)
- Results in account bans
- **Not recommended**

### Option D: WeChat Bot frameworks (web/enterprise)
- **WeChat Work (企业微信) API**: If messages are for business use, WeChat Work has official APIs
- **itchat / wechaty**: These used web WeChat protocol, which Tencent has **disabled for most accounts** since ~2019

### Recommended for sending
**Accessibility API automation** is the most practical approach. It's what most working WeChat Mac automation tools use. Pair it with `cliclick` or `PyAutoGUI` for more reliable UI interaction.

---

## 7. Schema Details

### Message table (in msg_*.db)

The main message table is typically named `MSG` (or `Chat_<hash>` in older versions):

```sql
CREATE TABLE MSG (
    localId INTEGER PRIMARY KEY AUTOINCREMENT,
    TalkerId INTEGER,           -- Sender ID (foreign key to contact)
    MsgSvrId INTEGER,           -- Server message ID (unique)
    Type INTEGER,               -- Message type (see below)
    SubType INTEGER,            -- Message subtype
    IsSender INTEGER,           -- 0 = received, 1 = sent by me
    CreateTime INTEGER,         -- Unix timestamp
    Sequence INTEGER,           -- Ordering sequence
    StatusEx INTEGER,
    FlagEx INTEGER,
    Status INTEGER,
    MsgSource TEXT,             -- XML metadata (for group msgs, contains sender info)
    Content TEXT,               -- Message content (text, XML for media, etc.)
    CompressContent BLOB,       -- Compressed content for some message types
    Reserved0 INTEGER,
    Reserved1 INTEGER,
    Reserved2 TEXT,
    Reserved3 TEXT,
    Reserved4 TEXT,
    Reserved5 TEXT,
    Reserved6 TEXT
);
```

### Message types (Type field)
| Type | Meaning |
|------|---------|
| 1 | Text message |
| 3 | Image |
| 34 | Voice message |
| 42 | Business card / contact share |
| 43 | Video |
| 47 | Animated sticker (emoji) |
| 48 | Location |
| 49 | App message (link, file, mini-program, etc.) — check SubType |
| 10000 | System message (red packet, recall, etc.) |
| 10002 | System notification (revoked messages) |

### SubType for Type=49 (app messages)
| SubType | Meaning |
|---------|---------|
| 5 | Shared link/article |
| 6 | File transfer |
| 8 | Animated GIF (from emoji panel) |
| 19 | Chat history (forwarded) |
| 33/36 | Mini program |
| 57 | Quote/reply message |
| 2000 | Transfer money |
| 2001 | Red packet |

### Group chats vs DMs
- **DMs**: `TalkerId` maps to the contact directly. The conversation is identified by the contact's `wxid` (e.g., `wxid_abc123`)
- **Group chats**: The conversation identifier ends with `@chatroom` (e.g., `12345678@chatroom`). The `MsgSource` XML field contains `<msgsource><atuserlist>...</atuserlist></msgsource>` and individual sender info
- In group messages, `Content` often has the format: `wxid_sender:\n<actual content>`

### Contact table (wccontact_new2.db)

```sql
CREATE TABLE WCContact (
    userName TEXT PRIMARY KEY,    -- wxid or group chatroom ID
    dbContactRemark BLOB,        -- Protobuf-encoded remark/alias info
    dbContactChatRoom BLOB,      -- Protobuf-encoded chatroom member list (for groups)
    dbContactHeadImage BLOB,     -- Avatar info
    dbContactProfile BLOB,       -- Profile data
    dbContactSocial BLOB,        -- Social/moments data
    dbContactEncryptSecret BLOB, -- Encryption info
    type INTEGER,                -- Contact type flags
    certificationFlag INTEGER,
    ...
);
```

**Note:** Many fields in the contact DB use **protobuf serialization**, not plain text. You'll need to decode them.

### Media handling
- **Images**: Stored as files in the `Message/MessageTemp/` or a dedicated media directory, referenced by MsgSvrId
- **Voice**: Stored as `.aud` files (SILK codec), need conversion to play
- **Video**: Stored as `.mp4` in the media directory
- **Files**: Stored in a file cache directory, referenced from the XML in Content

---

## 8. macOS Version Considerations

### WeChat Mac version differences

| Version Range | Notes |
|---------------|-------|
| **2.x** | Older format, key sometimes in Keychain, simpler DB structure |
| **3.0 - 3.5** | SQLCipher 3 compatible, message sharding introduced |
| **3.6 - 3.8+** | SQLCipher 4 defaults in some builds, protobuf changes, message table structure changes |
| **4.0+** (if exists) | May have further structural changes |

### Key changes over time:
- **DB sharding**: Newer versions split messages across more `msg_*.db` files
- **Protobuf evolution**: Contact and group data structures change between versions
- **Encryption parameters**: SQLCipher compatibility version may change
- **Storage path**: The version hash in the path changes with major updates

### Apple Silicon considerations
- On M1/M2/M3/M4 Macs, WeChat runs natively (ARM64)
- LLDB attachment works the same, but register names differ (x0-x7 vs rdi/rsi for ARM vs x86)
- SIP considerations are identical

---

## 9. Privacy / Security Restrictions

### System Integrity Protection (SIP)
- **SIP does NOT prevent** reading files in `~/Library/Containers/` — this is user data
- SIP DOES prevent attaching debuggers to Apple-signed processes, but **WeChat is not Apple-signed** (it's signed by Tencent), so `lldb` can attach
- However, you may need to grant Terminal/your IDE "Developer Tools" permission or disable SIP for debugging

### macOS App Sandbox
- WeChat is sandboxed (`~/Library/Containers/com.tencent.xinWeChat/`)
- **Your own process CAN read these files** — the sandbox restricts WeChat from accessing other apps, not other apps from accessing WeChat's container
- You need **Full Disk Access** permission for your script/terminal to read the Containers directory (starting with macOS Mojave 10.14+)

### TCC (Transparency, Consent, and Control)
- Grant **Full Disk Access** to Terminal.app (or your Python interpreter) in System Preferences → Privacy & Security → Full Disk Access
- Without this, you'll get "Operation not permitted" errors when accessing the Containers directory

### Debugger restrictions
- To attach `lldb` to WeChat for key extraction: you need either SIP disabled or the process must not have hardened runtime with debugger restriction
- WeChat's entitlements may vary; test with `codesign -d --entitlements :- /Applications/WeChat.app`
- Alternatively, use `csrutil disable` in Recovery Mode (not recommended for daily use)

### Legal considerations
- Tencent has been actively sending legal notices to projects that facilitate WeChat data extraction (see PyWxDump takedown in Oct 2025)
- Reading your own data for personal backup is generally defensible
- Distributing tools or using this for others' accounts is legally risky

---

## 10. Recommended Architecture for a WeChat Bridge

```
┌──────────────────────────────────────────────┐
│                WeChat Mac App                 │
│   (running, logged in, receiving messages)    │
└──────────┬───────────────────────┬───────────┘
           │ writes encrypted DB   │ UI available
           ▼                       ▼
┌─────────────────────┐  ┌──────────────────────┐
│  Message Reader      │  │  Message Sender       │
│                      │  │                       │
│  1. Extract key via  │  │  1. AppleScript/      │
│     lldb (once)      │  │     Accessibility API │
│  2. Open msg_*.db    │  │  2. Automate UI to    │
│     with SQLCipher   │  │     type & send       │
│  3. Poll / fsevents  │  │                       │
│     for new messages │  │                       │
└──────────┬──────────┘  └──────────┬────────────┘
           │                        │
           ▼                        ▼
┌──────────────────────────────────────────────┐
│              Bridge Service                   │
│  - Receives new messages from Reader          │
│  - Exposes API / webhook for external use     │
│  - Accepts send requests → routes to Sender   │
│  - Handles message deduplication              │
│  - Converts media (SILK→audio, etc.)          │
└──────────────────────────────────────────────┘
```

### Implementation steps:

1. **One-time key extraction**: Attach lldb to running WeChat, extract the SQLCipher key, store it securely
2. **DB watcher**: Use `watchdog` (Python) to monitor `msg_*.db` file changes
3. **Message reader**: On change detected, open DB with `pysqlcipher3`, query for new messages since last seen `localId`
4. **Message sender**: Use `pyobjc` + Accessibility APIs or `osascript` for UI automation
5. **Bridge API**: Simple HTTP/WebSocket server that forwards messages bidirectionally

### Key dependencies:
```
pip install pysqlcipher3 watchdog pyobjc
brew install sqlcipher
```

### Risks & mitigations:
- **Key changes on re-login**: Re-extract key if WeChat is logged out/in
- **DB schema changes on update**: Version-detect and adapt queries
- **WeChat WAL checkpointing**: Open DB in read-only mode, handle WAL properly
- **Rate limiting on sends**: Don't send too fast via UI automation or risk detection

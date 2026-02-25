import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";

type VaultConfig = {
  keychainService?: string;
  autoMigrate?: boolean;
  keyRotationDays?: number;
  dbPath?: string;
};

interface EncryptedData {
  data: string;
  iv: string;
  salt: string;
  tag: string;
}

interface AgentKeyRecord {
  agentId: string;
  encryptedKey: EncryptedData;
  createdAt: number;
  lastRotated: number;
}

interface VaultMetadata {
  initializedAt: number;
  version: string;
}

interface FileRecord {
  filePath: string;
  encryptedData: EncryptedData;
  originalPath: string;
  createdAt: number;
  updatedAt: number;
}

class KeyManager {
  private masterKey: Buffer | null = null;
  private readonly keychainService: string;
  readonly dbPath: string;
  private readonly keysFile: string;
  private readonly metadataFile: string;

  constructor(config: VaultConfig) {
    this.keychainService = config.keychainService || "openclaw-vault";
    this.dbPath = config.dbPath || path.join(os.homedir(), ".openclaw", "vault");
    this.keysFile = path.join(this.dbPath, "keys.json");
    this.metadataFile = path.join(this.dbPath, "metadata.json");

    if (!existsSync(this.dbPath)) {
      mkdirSync(this.dbPath, { recursive: true });
    }
  }

  initialize(): void {
    this.loadMasterKeyFromKeychain();
    this.initializeMetadata();
  }

  private loadMasterKeyFromKeychain(): void {
    try {
      const result = execSync(
        `security find-generic-password -w -s "${this.keychainService}" -a openclaw`,
        { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }
      );
      this.masterKey = Buffer.from(result.trim(), "base64");
    } catch {
      this.generateMasterKey();
    }
  }

  private generateMasterKey(): void {
    this.masterKey = crypto.randomBytes(32);
    const base64Key = this.masterKey.toString("base64");

    try {
      execSync(
        `security add-generic-password -s "${this.keychainService}" -a openclaw -w "${base64Key}" -U`,
        { stdio: ["pipe", "pipe", "ignore"] }
      );
    } catch (error) {
      throw new Error(`Failed to store master key in keychain: ${error}`);
    }
  }

  private initializeMetadata(): void {
    if (!existsSync(this.metadataFile)) {
      const metadata: VaultMetadata = {
        initializedAt: Date.now(),
        version: "1.0.0",
      };
      writeFileSync(this.metadataFile, JSON.stringify(metadata, null, 2));
    }
  }

  private loadAgentKeys(): AgentKeyRecord[] {
    if (!existsSync(this.keysFile)) return [];
    try {
      return JSON.parse(readFileSync(this.keysFile, "utf8")) as AgentKeyRecord[];
    } catch {
      return [];
    }
  }

  private saveAgentKeys(keys: AgentKeyRecord[]): void {
    writeFileSync(this.keysFile, JSON.stringify(keys, null, 2));
  }

  generateAgentKey(agentId: string): Buffer {
    if (!this.masterKey) throw new Error("Master key not available");

    const keys = this.loadAgentKeys();
    const existing = keys.find(k => k.agentId === agentId);
    if (existing) {
      return Buffer.from(this.decrypt(existing.encryptedKey, this.masterKey), "base64");
    }

    const agentKey = crypto.randomBytes(32);
    const encryptedKey = this.encrypt(agentKey.toString("base64"), this.masterKey);
    const now = Date.now();

    keys.push({ agentId, encryptedKey, createdAt: now, lastRotated: now });
    this.saveAgentKeys(keys);
    return agentKey;
  }

  getAgentKey(agentId: string): Buffer | null {
    if (!this.masterKey) return null;

    const keys = this.loadAgentKeys();
    const keyRecord = keys.find(k => k.agentId === agentId);
    if (!keyRecord) return null;

    try {
      return Buffer.from(this.decrypt(keyRecord.encryptedKey, this.masterKey), "base64");
    } catch {
      return null;
    }
  }

  encrypt(data: string, key: Buffer): EncryptedData {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, "sha256");

    const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      data: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      salt: salt.toString("base64"),
      tag: tag.toString("base64"),
    };
  }

  decrypt(encrypted: EncryptedData, key: Buffer): string {
    const salt = Buffer.from(encrypted.salt, "base64");
    const iv = Buffer.from(encrypted.iv, "base64");
    const data = Buffer.from(encrypted.data, "base64");
    const tag = Buffer.from(encrypted.tag, "base64");

    const derivedKey = crypto.pbkdf2Sync(key, salt, 10000, 32, "sha256");

    const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);

    return decrypted.toString("utf8");
  }

  getVaultStatus(): {
    initialized: boolean;
    keyCount: number;
    dbSize?: number;
    masterKeyExists: boolean;
  } {
    const initialized = existsSync(this.metadataFile);
    const keys = this.loadAgentKeys();

    let dbSize = 0;
    try {
      if (existsSync(this.keysFile)) dbSize += statSync(this.keysFile).size;
      if (existsSync(this.metadataFile)) dbSize += statSync(this.metadataFile).size;
    } catch { /* ignore */ }

    return {
      initialized,
      keyCount: keys.length,
      dbSize,
      masterKeyExists: this.masterKey !== null,
    };
  }

  close(): void {
    this.masterKey = null;
  }
}

class AgentVault {
  private readonly agentId: string;
  private readonly agentDir: string;
  private readonly filesFile: string;
  private readonly keyManager: KeyManager;

  constructor(agentId: string, keyManager: KeyManager) {
    this.agentId = agentId;
    this.keyManager = keyManager;
    this.agentDir = path.join(keyManager.dbPath, `agent-${agentId}`);
    this.filesFile = path.join(this.agentDir, "files.json");

    if (!existsSync(this.agentDir)) {
      mkdirSync(this.agentDir, { recursive: true });
    }
  }

  private loadFiles(): FileRecord[] {
    if (!existsSync(this.filesFile)) return [];
    try {
      return JSON.parse(readFileSync(this.filesFile, "utf8")) as FileRecord[];
    } catch {
      return [];
    }
  }

  private saveFiles(files: FileRecord[]): void {
    writeFileSync(this.filesFile, JSON.stringify(files, null, 2));
  }

  storeFile(filePath: string, content: string): void {
    const key = this.keyManager.getAgentKey(this.agentId);
    if (!key) throw new Error(`No encryption key found for agent ${this.agentId}`);

    const files = this.loadFiles();
    const encryptedData = this.keyManager.encrypt(content, key);
    const now = Date.now();

    const existingIndex = files.findIndex(f => f.filePath === filePath);
    const fileRecord: FileRecord = {
      filePath,
      encryptedData,
      originalPath: filePath,
      createdAt: existingIndex === -1 ? now : files[existingIndex].createdAt,
      updatedAt: now,
    };

    if (existingIndex === -1) files.push(fileRecord);
    else files[existingIndex] = fileRecord;

    this.saveFiles(files);
  }

  readFile(filePath: string): string | null {
    const key = this.keyManager.getAgentKey(this.agentId);
    if (!key) return null;

    const files = this.loadFiles();
    const fileRecord = files.find(f => f.filePath === filePath);
    if (!fileRecord) return null;

    try {
      return this.keyManager.decrypt(fileRecord.encryptedData, key);
    } catch {
      return null;
    }
  }
}

class VaultService {
  private keyManager: KeyManager;
  private agentVaults: Map<string, AgentVault> = new Map();
  private api: OpenClawPluginApi;

  constructor(api: OpenClawPluginApi, config: VaultConfig) {
    this.api = api;
    this.keyManager = new KeyManager(config);
  }

  getKeyManager(): KeyManager {
    return this.keyManager;
  }

  start(): void {
    this.api.logger.info("Starting Vault service...");
    this.keyManager.initialize();
    this.api.logger.info("Vault service started successfully");
  }

  stop(): void {
    this.api.logger.info("Stopping Vault service...");
    this.agentVaults.clear();
    this.keyManager.close();
    this.api.logger.info("Vault service stopped");
  }

  private getAgentVault(agentId: string): AgentVault {
    if (this.agentVaults.has(agentId)) return this.agentVaults.get(agentId)!;

    let key = this.keyManager.getAgentKey(agentId);
    if (!key) key = this.keyManager.generateAgentKey(agentId);

    const vault = new AgentVault(agentId, this.keyManager);
    this.agentVaults.set(agentId, vault);
    return vault;
  }

  encryptAndStore(agentId: string, filePath: string, content: string): void {
    const vault = this.getAgentVault(agentId);
    vault.storeFile(filePath, content);
  }

  decryptAndRead(agentId: string, filePath: string): string | null {
    const vault = this.getAgentVault(agentId);
    return vault.readFile(filePath);
  }

  getStatus() {
    return {
      ...this.keyManager.getVaultStatus(),
      activeAgentVaults: this.agentVaults.size,
    };
  }
}

let vaultService: VaultService | null = null;

export default function register(api: OpenClawPluginApi) {
  const config = api.config.plugins?.entries?.vault?.config || {};
  vaultService = new VaultService(api, config);

  // Register background service
  api.registerService({
    id: "vault-service",
    start: () => vaultService!.start(),
    stop: () => vaultService!.stop(),
  });

  // Register the message_persist hook for transparent transcript encryption
  // Uses api.on() for typed hooks (not api.registerHook which is for legacy internal hooks)
  api.on('message_persist', (event, ctx) => {
    // Guard: skip if already encrypted
    if ((event.message as any)?._vault) return;

    if (!vaultService) return;

    const keyManager = vaultService.getKeyManager();
    const agentId = ctx.agentId || 'default';
    const key = keyManager.getAgentKey(agentId) || keyManager.generateAgentKey(agentId);

    // Encrypt the entire message content
    const plaintext = JSON.stringify(event.message);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      message: {
        ...event.message,
        content: '__VAULT_ENCRYPTED__',
        _vault: {
          v: 1,
          data: encrypted.toString('base64'),
          iv: iv.toString('base64'),
          tag: tag.toString('base64'),
        },
      } as any,
    };
  }, { priority: 100 });

  // Register Gateway RPC methods
  api.registerGatewayMethod("vault.status", ({ respond }) => {
    try {
      const status = vaultService?.getStatus() || { error: "Service not started" };
      respond(true, status);
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  api.registerGatewayMethod("vault.readFile", ({ params, respond }) => {
    try {
      if (!vaultService) { respond(false, { error: "Vault service not started" }); return; }
      const { agentId, filePath } = params;
      if (!agentId || !filePath) { respond(false, { error: "Missing required parameters: agentId, filePath" }); return; }
      const content = vaultService.decryptAndRead(agentId, filePath);
      if (content === null) { respond(false, { error: "File not found in vault" }); return; }
      respond(true, { content });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  api.registerGatewayMethod("vault.writeFile", ({ params, respond }) => {
    try {
      if (!vaultService) { respond(false, { error: "Vault service not started" }); return; }
      const { agentId, filePath, content } = params;
      if (!agentId || !filePath || !content) { respond(false, { error: "Missing required parameters: agentId, filePath, content" }); return; }
      vaultService.encryptAndStore(agentId, filePath, content);
      respond(true, { success: true, message: `File encrypted and stored: ${filePath}` });
    } catch (error) {
      respond(false, { error: error instanceof Error ? error.message : String(error) });
    }
  });

  // Register vault_read tool
  api.registerTool({
    name: "vault_read",
    description: "Read encrypted file from vault",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path of the file to read from vault" },
        agent_id: { type: "string", description: "Agent ID (defaults to current agent)" },
      },
      required: ["file_path"],
    },
    handler: async ({ file_path, agent_id }) => {
      if (!vaultService) return { error: "Vault service not started" };
      const agentId = agent_id || "default";
      try {
        const content = vaultService.decryptAndRead(agentId, file_path);
        if (content === null) return { error: "File not found in vault" };
        return { content };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  // Register vault_write tool
  api.registerTool({
    name: "vault_write",
    description: "Write encrypted file to vault",
    inputSchema: {
      type: "object",
      properties: {
        file_path: { type: "string", description: "Path of the file to store in vault" },
        content: { type: "string", description: "Content to encrypt and store" },
        agent_id: { type: "string", description: "Agent ID (defaults to current agent)" },
      },
      required: ["file_path", "content"],
    },
    handler: async ({ file_path, content, agent_id }) => {
      if (!vaultService) return { error: "Vault service not started" };
      const agentId = agent_id || "default";
      try {
        vaultService.encryptAndStore(agentId, file_path, content);
        return { success: true, message: `File encrypted and stored: ${file_path}` };
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },
  });

  // Register CLI command
  api.registerCli(
    ({ program }) => {
      const vaultCmd = program.command("vault").description("OpenClaw Vault operations");

      vaultCmd
        .command("status")
        .description("Show vault status")
        .action(async () => {
          if (!vaultService) { console.log("❌ Vault service not running"); return; }
          const status = vaultService.getStatus();
          console.log("🔐 Vault Status:");
          console.log(`  Initialized: ${status.initialized ? "✅" : "❌"}`);
          console.log(`  Master Key: ${status.masterKeyExists ? "✅" : "❌"}`);
          console.log(`  Agent Keys: ${status.keyCount}`);
          console.log(`  Active Vaults: ${status.activeAgentVaults}`);
          if (status.dbSize) console.log(`  Storage Size: ${(status.dbSize / 1024).toFixed(2)} KB`);
        });

      vaultCmd
        .command("init")
        .description("Initialize vault (create master key and storage)")
        .action(async () => {
          try {
            const km = new KeyManager(config);
            km.initialize();
            console.log("✅ Vault initialized successfully");
            km.close();
          } catch (error) {
            console.error("❌ Initialization failed:", error);
          }
        });
    },
    { commands: ["vault"] }
  );

  api.logger.info("Vault plugin registered successfully");
}

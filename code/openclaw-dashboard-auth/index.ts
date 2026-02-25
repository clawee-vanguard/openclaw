import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { IncomingMessage, ServerResponse } from "node:http";
import { parse as parseUrl } from "node:url";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";

interface DashboardAuthConfig {
  enabled?: boolean;
  passwordHash: string;
  sessionTimeout?: number;
  cookieName?: string;
}

interface Session {
  token: string;
  lastActivity: number;
  expires: number;
}

const sessions = new Map<string, Session>();
const TOKEN_LENGTH = 32;

// Clean up expired sessions every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expires < now) {
      sessions.delete(token);
    }
  }
}, 5 * 60 * 1000);

function parseCookies(cookie: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookie) return cookies;
  
  cookie.split(';').forEach(c => {
    const [name, value] = c.trim().split('=');
    if (name && value) {
      cookies[name] = decodeURIComponent(value);
    }
  });
  return cookies;
}

function setCookie(res: ServerResponse, name: string, value: string, maxAge?: number) {
  const cookie = `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Strict${maxAge ? `; Max-Age=${maxAge}` : ''}`;
  res.setHeader('Set-Cookie', cookie);
}

function clearCookie(res: ServerResponse, name: string) {
  setCookie(res, name, '', 0);
}

function isAuthenticated(req: IncomingMessage, config: DashboardAuthConfig): boolean {
  if (!config.enabled) return true;
  
  const cookies = parseCookies(req.headers.cookie || '');
  const sessionToken = cookies[config.cookieName || 'openclaw_auth'];
  
  if (!sessionToken) return false;
  
  const session = sessions.get(sessionToken);
  if (!session) return false;
  
  const now = Date.now();
  if (session.expires < now) {
    sessions.delete(sessionToken);
    return false;
  }
  
  // Update last activity and extend expiration
  session.lastActivity = now;
  session.expires = now + (config.sessionTimeout || 900) * 1000;
  
  return true;
}

function createSession(config: DashboardAuthConfig): string {
  const token = randomBytes(TOKEN_LENGTH).toString('hex');
  const now = Date.now();
  const timeoutMs = (config.sessionTimeout || 900) * 1000;
  
  sessions.set(token, {
    token,
    lastActivity: now,
    expires: now + timeoutMs
  });
  
  return token;
}

function getLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OpenClaw Dashboard - Login</title>
    <style>
        :root {
            --bg-primary: #0f0f23;
            --bg-secondary: #10101a;
            --bg-tertiary: #1a1a2e;
            --text-primary: #cccccc;
            --text-secondary: #999999;
            --accent-primary: #00d4aa;
            --accent-secondary: #0099cc;
            --error: #ff6b6b;
            --border: #333346;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
            color: var(--text-primary);
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .login-container {
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 2rem;
            width: 100%;
            max-width: 400px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        }

        .logo {
            text-align: center;
            margin-bottom: 2rem;
        }

        .logo h1 {
            color: var(--accent-primary);
            font-size: 1.8rem;
            font-weight: 600;
            letter-spacing: -0.02em;
        }

        .logo p {
            color: var(--text-secondary);
            font-size: 0.9rem;
            margin-top: 0.5rem;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            margin-bottom: 0.5rem;
            color: var(--text-primary);
            font-weight: 500;
        }

        .form-group input {
            width: 100%;
            padding: 0.75rem;
            background: var(--bg-secondary);
            border: 1px solid var(--border);
            border-radius: 6px;
            color: var(--text-primary);
            font-size: 1rem;
            transition: border-color 0.2s ease;
        }

        .form-group input:focus {
            outline: none;
            border-color: var(--accent-primary);
            box-shadow: 0 0 0 3px rgba(0, 212, 170, 0.1);
        }

        .login-button {
            width: 100%;
            padding: 0.75rem;
            background: linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%);
            border: none;
            border-radius: 6px;
            color: white;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: opacity 0.2s ease;
        }

        .login-button:hover {
            opacity: 0.9;
        }

        .login-button:active {
            transform: translateY(1px);
        }

        .error {
            background: rgba(255, 107, 107, 0.1);
            border: 1px solid var(--error);
            border-radius: 6px;
            padding: 0.75rem;
            margin-bottom: 1rem;
            color: var(--error);
            font-size: 0.9rem;
            text-align: center;
        }

        .footer {
            text-align: center;
            margin-top: 2rem;
            color: var(--text-secondary);
            font-size: 0.8rem;
        }

        @media (max-width: 480px) {
            .login-container {
                margin: 1rem;
                padding: 1.5rem;
            }
        }
    </style>
</head>
<body>
    <div class="login-container">
        <div class="logo">
            <h1>OpenClaw</h1>
            <p>Dashboard Access</p>
        </div>
        
        ${error ? `<div class="error">${error}</div>` : ''}
        
        <form method="POST" action="/login">
            <div class="form-group">
                <label for="password">Password</label>
                <input type="password" id="password" name="password" required autofocus>
            </div>
            
            <button type="submit" class="login-button">Sign In</button>
        </form>
        
        <div class="footer">
            Secure access to your OpenClaw dashboard
        </div>
    </div>
</body>
</html>`;
}

const plugin = {
  id: "openclaw-dashboard-auth",
  name: "Dashboard Authentication",
  description: "Password authentication for the OpenClaw webchat dashboard",
  configSchema: {
    parse(value: unknown): DashboardAuthConfig {
      const config = (value as Record<string, unknown>) || {};
      return {
        enabled: Boolean(config.enabled ?? true),
        passwordHash: String(config.passwordHash || ''),
        sessionTimeout: Number(config.sessionTimeout || 900),
        cookieName: String(config.cookieName || 'openclaw_auth')
      };
    },
    uiHints: {
      enabled: {
        label: "Enable Dashboard Authentication",
        help: "When enabled, requires password authentication to access the dashboard"
      },
      passwordHash: {
        label: "Password Hash (bcrypt)",
        sensitive: true,
        help: "Use 'openclaw dashboard-auth hash-password' to generate this value"
      },
      sessionTimeout: {
        label: "Session Timeout (seconds)",
        help: "How long before inactive sessions expire (default: 900 = 15 minutes)"
      },
      cookieName: {
        label: "Cookie Name",
        advanced: true,
        help: "Name of the session cookie (default: openclaw_auth)"
      }
    }
  },
  
  register(api: OpenClawPluginApi) {
    const config = plugin.configSchema.parse(api.pluginConfig) as DashboardAuthConfig;
    
    if (!config.enabled) {
      api.logger.info("[dashboard-auth] Authentication disabled");
      return;
    }

    if (!config.passwordHash) {
      api.logger.error("[dashboard-auth] No password hash configured. Use 'openclaw dashboard-auth hash-password' to generate one.");
      return;
    }

    api.logger.info("[dashboard-auth] Dashboard authentication enabled");

    // Register HTTP handler to intercept dashboard requests
    api.registerHttpHandler(async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
      const url = parseUrl(req.url || '', true);
      const path = url.pathname || '';
      
      // Only intercept root path and static assets (but not API/RPC calls)
      if (!path.startsWith('/') || path.startsWith('/rpc') || path.startsWith('/api')) {
        return false; // Let other handlers process
      }

      // Handle login form submission
      if (path === '/login' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const params = new URLSearchParams(body);
            const password = params.get('password') || '';
            
            if (!password) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(getLoginPage("Password is required"));
              return;
            }

            // Verify password
            const isValid = await bcrypt.compare(password, config.passwordHash);
            
            if (isValid) {
              // Create session and set cookie
              const sessionToken = createSession(config);
              setCookie(res, config.cookieName || 'openclaw_auth', sessionToken, config.sessionTimeout);
              
              // Redirect to dashboard
              res.writeHead(302, { 'Location': '/' });
              res.end();
              return;
            } else {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              res.end(getLoginPage("Invalid password"));
              return;
            }
          } catch (error) {
            api.logger.error(`[dashboard-auth] Login error: ${error}`);
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(getLoginPage("Login failed. Please try again."));
          }
        });
        
        return true; // We handled this request
      }

      // Handle logout
      if (path === '/logout') {
        const cookies = parseCookies(req.headers.cookie || '');
        const sessionToken = cookies[config.cookieName || 'openclaw_auth'];
        if (sessionToken) {
          sessions.delete(sessionToken);
        }
        clearCookie(res, config.cookieName || 'openclaw_auth');
        res.writeHead(302, { 'Location': '/' });
        res.end();
        return true;
      }

      // Check if authenticated for dashboard access
      if (!isAuthenticated(req, config)) {
        // Show login page
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getLoginPage());
        return true; // We handled this request
      }

      // User is authenticated, let the request continue to the dashboard
      return false;
    });

    // Register RPC methods for managing authentication
    api.registerGatewayMethod("dashboard-auth.status", ({ respond }) => {
      respond(true, {
        enabled: config.enabled,
        activeSessions: sessions.size,
        sessionTimeout: config.sessionTimeout
      });
    });

    api.registerGatewayMethod("dashboard-auth.invalidate-sessions", ({ respond }) => {
      const count = sessions.size;
      sessions.clear();
      respond(true, { invalidated: count });
    });

    // Register CLI commands
    api.registerCli(({ program }) => {
      const dashboardAuthCmd = program
        .command('dashboard-auth')
        .description('Manage dashboard authentication');

      dashboardAuthCmd
        .command('hash-password')
        .description('Generate bcrypt hash for a password')
        .action(async () => {
          const readline = require('readline');
          const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
          });

          rl.stdoutMuted = true;
          rl.question('Enter password to hash: ', (password: string) => {
            rl.stdoutMuted = false;
            
            if (!password) {
              console.log('\nPassword cannot be empty');
              rl.close();
              return;
            }

            bcrypt.hash(password, 12, (err: any, hash: string) => {
              if (err) {
                console.log('\nError generating hash:', err.message);
              } else {
                console.log('\nBcrypt hash generated:');
                console.log(hash);
                console.log('\nAdd this to your config under plugins.entries.dashboard-auth.config.passwordHash');
              }
              rl.close();
            });
          });

          rl._writeToOutput = function(stringToWrite: string) {
            if (rl.stdoutMuted && stringToWrite !== '\n') {
              rl.output.write('*');
            } else {
              rl.output.write(stringToWrite);
            }
          };
        });

      dashboardAuthCmd
        .command('status')
        .description('Show authentication status')
        .action(() => {
          console.log(`Dashboard Auth Status:`);
          console.log(`  Enabled: ${config.enabled}`);
          console.log(`  Active Sessions: ${sessions.size}`);
          console.log(`  Session Timeout: ${config.sessionTimeout}s`);
          console.log(`  Cookie Name: ${config.cookieName}`);
        });
        
      dashboardAuthCmd
        .command('clear-sessions')
        .description('Clear all active sessions')
        .action(() => {
          const count = sessions.size;
          sessions.clear();
          console.log(`Cleared ${count} active sessions`);
        });
    }, { commands: ['dashboard-auth'] });
  }
};

export default plugin;
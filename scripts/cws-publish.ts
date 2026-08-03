#!/usr/bin/env bun
/**
 * Upload (and optionally publish) a Chrome Web Store package via API v2.
 *
 * Required env:
 *   CWS_SERVICE_ACCOUNT_JSON  — service account key JSON
 *   CWS_PUBLISHER_ID          — publisher UUID
 *   CWS_EXTENSION_ID          — 32-char extension id
 *
 * Usage:
 *   bun run scripts/cws-publish.ts              # zip + upload + publish
 *   bun run scripts/cws-publish.ts --upload-only
 *   bun run scripts/cws-publish.ts --status
 *   bun run scripts/cws-publish.ts --zip path/to.zip
 */
import { JWT } from "google-auth-library";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const SCOPE = "https://www.googleapis.com/auth/chromewebstore";
const API = "https://chromewebstore.googleapis.com";

type Args = {
  statusOnly: boolean;
  uploadOnly: boolean;
  skipZip: boolean;
  zipPath: string | null;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    statusOnly: false,
    uploadOnly: false,
    skipZip: false,
    zipPath: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--status":
        args.statusOnly = true;
        break;
      case "--upload-only":
        args.uploadOnly = true;
        break;
      case "--skip-zip":
        args.skipZip = true;
        break;
      case "--zip": {
        const next = argv[++i];
        if (!next) throw new Error("--zip requires a path");
        args.zipPath = next;
        break;
      }
      case "--help":
      case "-h":
        console.log(`Usage: bun run scripts/cws-publish.ts [--status | --upload-only] [--zip PATH] [--skip-zip]`);
        process.exit(0);
        break;
      default:
        throw new Error(`Unknown arg: ${a}`);
    }
  }
  return args;
}

function requireEnv(name: string): string {
  const v = process.env[name]?.trim();
  if (!v) throw new Error(`Missing env ${name}`);
  return v;
}

function itemPath(publisherId: string, extensionId: string): string {
  return `publishers/${publisherId}/items/${extensionId}`;
}

async function getAccessToken(saJson: string): Promise<string> {
  const keys = JSON.parse(saJson) as {
    client_email: string;
    private_key: string;
  };
  const client = new JWT({
    email: keys.client_email,
    key: keys.private_key,
    scopes: [SCOPE],
  });
  const tok = await client.authorize();
  if (!tok.access_token) throw new Error("Failed to obtain access token");
  return tok.access_token;
}

async function fetchStatus(
  token: string,
  publisherId: string,
  extensionId: string,
): Promise<unknown> {
  const url = `${API}/v2/${itemPath(publisherId, extensionId)}:fetchStatus`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`fetchStatus ${res.status}: ${body.slice(0, 500)}`);
  return JSON.parse(body) as unknown;
}

async function uploadZip(
  token: string,
  publisherId: string,
  extensionId: string,
  zipPath: string,
): Promise<unknown> {
  const url = `${API}/upload/v2/${itemPath(publisherId, extensionId)}:upload`;
  const bytes = readFileSync(zipPath);
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/zip",
      "Content-Length": String(bytes.byteLength),
    },
    body: bytes,
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`upload ${res.status}: ${body.slice(0, 800)}`);
  return body ? (JSON.parse(body) as unknown) : {};
}

async function publishItem(
  token: string,
  publisherId: string,
  extensionId: string,
): Promise<unknown> {
  const url = `${API}/v2/${itemPath(publisherId, extensionId)}:publish`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ publishType: "DEFAULT_PUBLISH" }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`publish ${res.status}: ${body.slice(0, 800)}`);
  return body ? (JSON.parse(body) as unknown) : {};
}

function latestChromeZip(): string {
  const out = join(process.cwd(), ".output");
  const zips = readdirSync(out)
    .filter((f) => f.endsWith("-chrome.zip") || f.endsWith(".chrome.zip") || (f.endsWith(".zip") && f.includes("chrome")))
    .map((f) => join(out, f))
    .filter((p) => statSync(p).isFile())
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!zips[0]) {
    throw new Error(`No chrome zip found in ${out}. Run bun run zip first.`);
  }
  return zips[0];
}

async function runZip(): Promise<void> {
  const proc = Bun.spawn(["bun", "run", "zip"], {
    cwd: process.cwd(),
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) throw new Error(`bun run zip failed (${code})`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const saJson = requireEnv("CWS_SERVICE_ACCOUNT_JSON");
  const publisherId = requireEnv("CWS_PUBLISHER_ID");
  const extensionId = requireEnv("CWS_EXTENSION_ID");

  const token = await getAccessToken(saJson);

  if (args.statusOnly) {
    const status = await fetchStatus(token, publisherId, extensionId);
    console.log(JSON.stringify(status, null, 2));
    return;
  }

  if (!args.zipPath && !args.skipZip) {
    console.log("Building zip…");
    await runZip();
  }

  const zipPath = args.zipPath ?? latestChromeZip();
  console.log(`Uploading ${zipPath}…`);
  const uploaded = await uploadZip(token, publisherId, extensionId, zipPath);
  console.log("Upload OK:", JSON.stringify(uploaded, null, 2));

  if (args.uploadOnly) {
    console.log("Skipping publish (--upload-only). Submit from the dashboard or re-run without the flag.");
    return;
  }

  console.log("Submitting for publish/review…");
  const published = await publishItem(token, publisherId, extensionId);
  console.log("Publish submitted:", JSON.stringify(published, null, 2));

  const status = await fetchStatus(token, publisherId, extensionId);
  console.log("Current status:", JSON.stringify(status, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

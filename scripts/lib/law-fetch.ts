// Downloads the XML and TXT exports of an act from the Riigi Teataja public API and keeps a copy
// in .cache/law/. The XML endpoint is documented in the Riigi Teataja FAQ; the TXT endpoint is
// undocumented (the site's own scripts use it) and may change (DESIGN.md section 9).

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LawImportError } from './law-text.ts';

export type ExportFormat = 'xml' | 'txt';

const API = 'https://www.riigiteataja.ee/public-api/api/v1/akt';
const ATTEMPTS = 3;
const TIMEOUT_MS = 60_000;

export interface LoadOptions {
  cacheDir: string;
  /** Read the cached copy only and never touch the network. */
  offline: boolean;
  log: (message: string) => void;
}

export interface LoadedExport {
  text: string;
  url: string;
  bytes: number;
  /** "downloaded", or "cache" when read from .cache/law/. */
  from: 'downloaded' | 'cache';
}

export function exportUrl(edition: string, format: ExportFormat): string {
  return `${API}/${edition}/${format}`;
}

/**
 * Returns the export as text with LF line breaks. Downloads it unless `offline` is set; when the
 * download fails and a cached copy exists, uses that copy and says so.
 */
export async function loadExport(edition: string, format: ExportFormat, options: LoadOptions): Promise<LoadedExport> {
  const url = exportUrl(edition, format);
  const cachePath = join(options.cacheDir, `${edition}.${format}`);

  if (options.offline) {
    const cached = await readCache(cachePath);
    if (!cached) throw new LawImportError(`--offline: no cached copy of ${url} at ${cachePath}`);
    return { text: decode(cached, cachePath), url, bytes: cached.length, from: 'cache' };
  }

  let bytes: Uint8Array;
  try {
    bytes = await download(url);
  } catch (error) {
    const cached = await readCache(cachePath);
    if (!cached) throw new LawImportError(`Download failed: ${url}: ${errorMessage(error)}`);
    options.log(`WARNING: download failed (${errorMessage(error)}); using the cached copy ${cachePath}`);
    return { text: decode(cached, cachePath), url, bytes: cached.length, from: 'cache' };
  }

  const text = decode(bytes, url);
  await mkdir(options.cacheDir, { recursive: true });
  await writeFile(cachePath, bytes);
  return { text, url, bytes: bytes.length, from: 'downloaded' };
}

async function download(url: string): Promise<Uint8Array> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`.trim());
        // A client error (a wrong edition id, say) will not go away on a retry.
        if (response.status < 500) throw Object.assign(error, { final: true });
        throw error;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length === 0) throw new Error('empty response');
      return bytes;
    } catch (error) {
      lastError = error;
      if ((error as { final?: boolean }).final) break;
      if (attempt < ATTEMPTS) await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
  throw lastError;
}

async function readCache(path: string): Promise<Uint8Array | null> {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

function decode(bytes: Uint8Array, source: string): string {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new LawImportError(`${source} is not valid UTF-8`);
  }
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    const cause = (error as { cause?: unknown }).cause;
    return cause instanceof Error ? `${error.message} (${cause.message})` : error.message;
  }
  return String(error);
}

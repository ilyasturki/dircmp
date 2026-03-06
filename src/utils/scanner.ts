import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileEntry, ScanResult } from '~/utils/types';

async function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function walkDirectory(
  rootPath: string,
  currentPath: string,
  result: ScanResult
): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(currentPath, { withFileTypes: true });
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'EACCES' || code === 'EPERM') {
      const relativePath = path.relative(rootPath, currentPath);
      result.set(relativePath, {
        name: path.basename(currentPath),
        relativePath,
        isDirectory: true,
        size: 0,
        modifiedTime: new Date(),
        contentHash: null,
        error: `Permission denied: ${code}`,
      });
      return;
    }
    throw err;
  }

  for (const entry of entries) {
    const fullPath = path.join(currentPath, entry.name);
    const relativePath = path.relative(rootPath, fullPath);

    try {
      let isDirectory = entry.isDirectory();
      let resolvedPath = fullPath;

      if (entry.isSymbolicLink()) {
        try {
          resolvedPath = await fsp.realpath(fullPath);
          const stat = await fsp.stat(resolvedPath);
          isDirectory = stat.isDirectory();
        } catch {
          result.set(relativePath, {
            name: entry.name,
            relativePath,
            isDirectory: false,
            size: 0,
            modifiedTime: new Date(),
            contentHash: null,
            error: 'Broken symlink',
          });
          continue;
        }
      }

      if (isDirectory) {
        const stat = await fsp.stat(fullPath);
        result.set(relativePath, {
          name: entry.name,
          relativePath,
          isDirectory: true,
          size: 0,
          modifiedTime: stat.mtime,
          contentHash: null,
        });
        await walkDirectory(rootPath, fullPath, result);
      } else {
        const stat = await fsp.stat(resolvedPath);
        let contentHash: string | null = null;
        try {
          contentHash = await hashFile(resolvedPath);
        } catch {
          // hash failure is non-fatal
        }
        result.set(relativePath, {
          name: entry.name,
          relativePath,
          isDirectory: false,
          size: stat.size,
          modifiedTime: stat.mtime,
          contentHash,
        });
      }
    } catch (err: unknown) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'EACCES' || code === 'EPERM') {
        result.set(relativePath, {
          name: entry.name,
          relativePath,
          isDirectory: false,
          size: 0,
          modifiedTime: new Date(),
          contentHash: null,
          error: `Permission denied: ${code}`,
        });
      } else {
        throw err;
      }
    }
  }
}

export async function scanDirectory(rootPath: string): Promise<ScanResult> {
  const result: ScanResult = new Map();
  await walkDirectory(rootPath, rootPath, result);
  return result;
}

export function getEntriesAtPath(
  scan: ScanResult,
  dirPath: string
): FileEntry[] {
  const entries: FileEntry[] = [];
  for (const [relPath, entry] of scan) {
    const parent = path.dirname(relPath);
    const normalizedDir = dirPath === '' ? '.' : dirPath;
    if (parent === normalizedDir && relPath !== dirPath) {
      entries.push(entry);
    }
  }
  return entries;
}

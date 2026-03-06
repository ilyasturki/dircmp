import fsp from 'node:fs/promises';
import path from 'node:path';
import { structuredPatch } from 'diff';
import type {
  ScanResult,
  CompareEntry,
  DiffResult,
  DiffHunk,
  DiffLine,
  DiffStatus,
} from './types.js';
import { getEntriesAtPath } from './scanner.js';

function hasDescendantDiff(
  leftScan: ScanResult,
  rightScan: ScanResult,
  dirPath: string
): boolean {
  const prefix = dirPath === '' ? '' : dirPath + path.sep;

  const leftPaths = new Set<string>();
  for (const [relPath, entry] of leftScan) {
    if (relPath.startsWith(prefix) && !entry.isDirectory) {
      leftPaths.add(relPath);
    }
  }

  const rightPaths = new Set<string>();
  for (const [relPath, entry] of rightScan) {
    if (relPath.startsWith(prefix) && !entry.isDirectory) {
      rightPaths.add(relPath);
    }
  }

  for (const p of leftPaths) {
    const rightEntry = rightScan.get(p);
    if (!rightEntry) return true;
    const leftEntry = leftScan.get(p)!;
    if (leftEntry.contentHash !== rightEntry.contentHash) return true;
  }

  for (const p of rightPaths) {
    if (!leftPaths.has(p)) return true;
  }

  return false;
}

export function compareAtPath(
  leftScan: ScanResult,
  rightScan: ScanResult,
  dirPath: string
): CompareEntry[] {
  const leftEntries = getEntriesAtPath(leftScan, dirPath);
  const rightEntries = getEntriesAtPath(rightScan, dirPath);

  const leftMap = new Map(leftEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]));
  const rightMap = new Map(rightEntries.map((e) => [e.name + (e.isDirectory ? '/' : ''), e]));

  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);
  const entries: CompareEntry[] = [];

  for (const key of allKeys) {
    const left = leftMap.get(key);
    const right = rightMap.get(key);
    const isDir = (left?.isDirectory ?? right?.isDirectory) as boolean;
    const name = (left?.name ?? right?.name) as string;
    const relativePath = (left?.relativePath ?? right?.relativePath) as string;

    // Handle same name but different types (file vs dir)
    if (left && right && left.isDirectory !== right.isDirectory) {
      entries.push({
        relativePath: left.relativePath,
        name: left.name,
        isDirectory: left.isDirectory,
        status: 'only-left',
        left,
      });
      entries.push({
        relativePath: right.relativePath,
        name: right.name,
        isDirectory: right.isDirectory,
        status: 'only-right',
        right,
      });
      continue;
    }

    let status: DiffStatus;
    if (!left) {
      status = 'only-right';
    } else if (!right) {
      status = 'only-left';
    } else if (isDir) {
      status = hasDescendantDiff(leftScan, rightScan, relativePath)
        ? 'modified'
        : 'identical';
    } else {
      status =
        left.contentHash === right.contentHash ? 'identical' : 'modified';
    }

    entries.push({ relativePath, name, isDirectory: isDir, status, left, right });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return entries;
}

function isBinary(buffer: Buffer): boolean {
  const len = Math.min(buffer.length, 8192);
  for (let i = 0; i < len; i++) {
    if (buffer[i] === 0) return true;
  }
  return false;
}

export async function getFileDiff(
  leftRoot: string,
  rightRoot: string,
  relativePath: string
): Promise<DiffResult> {
  let leftContent = '';
  let rightContent = '';
  let leftBuf: Buffer | null = null;
  let rightBuf: Buffer | null = null;

  const [leftResult, rightResult] = await Promise.allSettled([
    fsp.readFile(path.join(leftRoot, relativePath)),
    fsp.readFile(path.join(rightRoot, relativePath)),
  ]);

  if (leftResult.status === 'fulfilled') {
    leftBuf = leftResult.value;
    leftContent = leftBuf.toString('utf-8');
  }
  if (rightResult.status === 'fulfilled') {
    rightBuf = rightResult.value;
    rightContent = rightBuf.toString('utf-8');
  }

  if ((leftBuf && isBinary(leftBuf)) || (rightBuf && isBinary(rightBuf))) {
    return { isBinary: true, hunks: [] };
  }

  const patch = structuredPatch(
    `a/${relativePath}`,
    `b/${relativePath}`,
    leftContent,
    rightContent,
    '',
    '',
    { context: 3 }
  );

  const hunks: DiffHunk[] = patch.hunks.map((h) => {
    const header = `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`;
    const lines: DiffLine[] = h.lines.map((line) => {
      if (line.startsWith('+')) {
        return { type: 'added', content: line.slice(1) };
      } else if (line.startsWith('-')) {
        return { type: 'removed', content: line.slice(1) };
      } else {
        return { type: 'context', content: line.slice(1) };
      }
    });
    return { header, lines };
  });

  return { isBinary: false, hunks };
}

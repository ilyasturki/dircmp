import path from 'node:path';
import type {
  ScanResult,
  CompareEntry,
  DiffStatus,
} from '~/utils/types';
import { getEntriesAtPath } from '~/utils/scanner';

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
        depth: 0,
        isExpanded: false,
      });
      entries.push({
        relativePath: right.relativePath,
        name: right.name,
        isDirectory: right.isDirectory,
        status: 'only-right',
        right,
        depth: 0,
        isExpanded: false,
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

    entries.push({ relativePath, name, isDirectory: isDir, status, left, right, depth: 0, isExpanded: false });
  }

  entries.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return entries;
}

export function buildVisibleTree(
  leftScan: ScanResult,
  rightScan: ScanResult,
  expandedDirs: Set<string>
): CompareEntry[] {
  const result: CompareEntry[] = [];

  function walk(dirPath: string, depth: number) {
    const entries = compareAtPath(leftScan, rightScan, dirPath);
    for (const entry of entries) {
      const isExpanded = entry.isDirectory && expandedDirs.has(entry.relativePath);
      result.push({ ...entry, depth, isExpanded });
      if (isExpanded) {
        walk(entry.relativePath, depth + 1);
      }
    }
  }

  walk('', 0);
  return result;
}


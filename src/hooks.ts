import { useEffect, useRef, useState, type Dispatch } from 'react';
import { useInput, useApp } from 'ink';
import type { WriteStream } from 'tty';
import type { Action, ViewMode } from '~/utils/types';
import { scanDirectory } from '~/utils/scanner';
import { getFileDiff } from '~/utils/compare';
import { keymap } from '~/keymap';

export function useTerminalDimensions(stdout: WriteStream | undefined) {
  const [dimensions, setDimensions] = useState({
    columns: stdout?.columns ?? 80,
    rows: stdout?.rows ?? 24,
  });

  useEffect(() => {
    if (!stdout) return;
    const onResize = () => {
      setDimensions({ columns: stdout.columns, rows: stdout.rows });
    };
    stdout.on('resize', onResize);
    return () => {
      stdout.off('resize', onResize);
    };
  }, [stdout]);

  return dimensions;
}

export function useDirectoryScan(leftDir: string, rightDir: string, dispatch: Dispatch<Action>) {
  useEffect(() => {
    Promise.all([scanDirectory(leftDir), scanDirectory(rightDir)])
      .then(([leftScan, rightScan]) => {
        dispatch({ type: 'SCAN_COMPLETE', leftScan, rightScan });
      })
      .catch((err) => {
        dispatch({ type: 'SCAN_ERROR', error: String(err) });
      });
  }, [leftDir, rightDir]);
}

export function useKeymap(viewMode: ViewMode, dispatch: Dispatch<Action>) {
  const { exit } = useApp();
  const pendingKeyRef = useRef('');
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useInput((input, key) => {
    const pending = pendingKeyRef.current + input;

    // Check for sequence matches first
    for (const shortcut of keymap) {
      if (shortcut.mode !== 'global' && shortcut.mode !== viewMode) continue;
      if (!shortcut.sequence) continue;
      if (pending === shortcut.sequence) {
        pendingKeyRef.current = '';
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        if (shortcut.effect.type === 'exit') exit();
        else dispatch(shortcut.effect.action);
        return;
      }
      // If this input could be the start of a sequence, buffer it
      if (shortcut.sequence.startsWith(pending) && pending.length < shortcut.sequence.length) {
        pendingKeyRef.current = pending;
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = setTimeout(() => {
          pendingKeyRef.current = '';
        }, 500);
        return;
      }
    }

    // No sequence match — clear pending and check normal shortcuts
    pendingKeyRef.current = '';
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);

    for (const shortcut of keymap) {
      if (shortcut.mode !== 'global' && shortcut.mode !== viewMode) continue;
      if (shortcut.sequence) continue;
      if (!shortcut.match(input, key)) continue;
      if (shortcut.effect.type === 'exit') exit();
      else dispatch(shortcut.effect.action);
      return;
    }
  });
}

export function useFileDiff(selectedFile: string | null, leftDir: string, rightDir: string, dispatch: Dispatch<Action>) {
  useEffect(() => {
    if (!selectedFile) return;
    let cancelled = false;
    getFileDiff(leftDir, rightDir, selectedFile).then((result) => {
      if (!cancelled) {
        dispatch({ type: 'DIFF_LOADED', diffResult: result });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedFile, leftDir, rightDir]);
}

import { useEffect, useState, type Dispatch } from 'react';
import type { WriteStream } from 'tty';
import type { Action } from '~/types.js';
import { scanDirectory } from '~/scanner.js';
import { getFileDiff } from '~/compare.js';

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

import {useEffect, useRef, useState} from 'react';
import type {ClassifiedStat} from '../../main/types';

const MAX_POINTS = 30;

/**
 * Keeps a rolling per-container history of CPU fractions so we can draw
 * sparklines. Keyed by container name; prunes containers that disappear.
 */
export function useCpuHistory(stats: ClassifiedStat[]): Record<string, number[]> {
  const [history, setHistory] = useState<Record<string, number[]>>({});
  const ref = useRef(history);
  ref.current = history;

  useEffect(() => {
    const next: Record<string, number[]> = {};
    for (const stat of stats) {
      const prev = ref.current[stat.name] ?? [];
      next[stat.name] = [...prev, stat.cpu].slice(-MAX_POINTS);
    }
    setHistory(next);
  }, [stats]);

  return history;
}

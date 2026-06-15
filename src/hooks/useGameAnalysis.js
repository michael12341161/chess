import { useEffect, useMemo, useRef, useState } from 'react';
import { analyzeCompletedGame } from '../services/analysis/gameAnalysis.js';

const initialState = {
  status: 'idle',
  report: null,
  error: null,
  progress: { done: 0, total: 0 },
};

export function useGameAnalysis(state, options = {}) {
  const [analysis, setAnalysis] = useState(initialState);
  const key = useMemo(() => {
    if (!state?.result) return null;
    return `${state.result}:${state.resultReason ?? ''}:${state.history.length}`;
  }, [state]);
  const activeKeyRef = useRef(null);

  useEffect(() => {
    if (!key) {
      activeKeyRef.current = null;
      setAnalysis(initialState);
      return undefined;
    }

    let cancelled = false;
    activeKeyRef.current = key;
    setAnalysis({ status: 'analyzing', report: null, error: null, progress: { done: 0, total: state.history.length } });

    analyzeCompletedGame(state, {
      ...options,
      onProgress: (progress) => {
        if (!cancelled) {
          setAnalysis((current) => ({ ...current, progress }));
        }
      },
    })
      .then((report) => {
        if (!cancelled && activeKeyRef.current === key) {
          setAnalysis({ status: 'ready', report, error: null, progress: { done: report?.analyzedPlyCount ?? 0, total: report?.totalPlyCount ?? 0 } });
        }
      })
      .catch((error) => {
        if (!cancelled && activeKeyRef.current === key) {
          setAnalysis({ status: 'error', report: null, error, progress: { done: 0, total: state.history.length } });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [key]);

  return analysis;
}

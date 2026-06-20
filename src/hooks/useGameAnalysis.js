import { useEffect, useMemo, useReducer } from 'react';
import { analyzeCompletedGame } from '../services/analysis/gameAnalysis.js';

const initialState = {
  status: 'idle',
  report: null,
  error: null,
  progress: { done: 0, total: 0 },
};

function analysisReducer(state, action) {
  switch (action.type) {
    case 'idle':
      return initialState;
    case 'analyzing':
      return { status: 'analyzing', report: null, error: null, progress: { done: 0, total: action.total } };
    case 'progress':
      return { ...state, progress: action.progress };
    case 'ready':
      return {
        status: 'ready',
        report: action.report,
        error: null,
        progress: { done: action.report?.analyzedPlyCount ?? 0, total: action.report?.totalPlyCount ?? 0 },
      };
    case 'error':
      return { status: 'error', report: null, error: action.error, progress: { done: 0, total: action.total } };
    default:
      return state;
  }
}

export function useGameAnalysis(state, options = {}) {
  const [analysis, dispatch] = useReducer(analysisReducer, initialState);
  const key = state?.result ? `${state.result}:${state.resultReason ?? ''}:${state.history.length}` : null;
  const analysisOptions = useMemo(() => ({
    preferStockfish: options.preferStockfish ?? true,
    movetime: options.movetime ?? 90,
    depth: options.depth ?? 2,
    limit: options.limit,
  }), [options.depth, options.limit, options.movetime, options.preferStockfish]);

  useEffect(() => {
    if (!key) {
      dispatch({ type: 'idle' });
      return undefined;
    }

    let cancelled = false;
    dispatch({ type: 'analyzing', total: state.history.length });

    analyzeCompletedGame(state, {
      ...analysisOptions,
      onProgress: (progress) => {
        if (!cancelled) dispatch({ type: 'progress', progress });
      },
    })
      .then((report) => {
        if (!cancelled) dispatch({ type: 'ready', report });
      })
      .catch((error) => {
        if (!cancelled) dispatch({ type: 'error', error, total: state.history.length });
      });

    return () => {
      cancelled = true;
    };
  }, [analysisOptions, key, state]);

  return analysis;
}

import { useCallback, useEffect, useMemo, useReducer } from 'react';
import { BLACK, WHITE } from '../utils/constants.js';

function initialTimes(initialMinutes) {
  const seconds = initialMinutes * 60;
  return { [WHITE]: seconds, [BLACK]: seconds };
}

function clockReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return {
        times: initialTimes(action.minutes),
        lastTurn: action.turn,
      };
    case 'switch-turn':
      if (state.lastTurn === action.turn) return state;
      return {
        times: {
          ...state.times,
          [state.lastTurn]: state.times[state.lastTurn] + action.incrementSeconds,
        },
        lastTurn: action.turn,
      };
    case 'tick':
      return {
        ...state,
        times: {
          ...state.times,
          [action.turn]: Math.max(0, state.times[action.turn] - 1),
        },
      };
    case 'set':
      return {
        ...state,
        times: typeof action.times === 'function' ? action.times(state.times) : action.times,
      };
    default:
      return state;
  }
}

export function useClock({ initialMinutes = 10, incrementSeconds = 0, turn = WHITE, paused = false, result = null }) {
  const [clockState, dispatch] = useReducer(clockReducer, null, () => ({
    times: initialTimes(initialMinutes),
    lastTurn: turn,
  }));

  const reset = useCallback(
    (nextTurn = turn) => {
      dispatch({ type: 'reset', minutes: initialMinutes, turn: nextTurn });
    },
    [initialMinutes, turn],
  );

  useEffect(() => {
    dispatch({ type: 'switch-turn', turn, incrementSeconds });
  }, [incrementSeconds, turn]);

  useEffect(() => {
    if (paused || result) return undefined;
    const timer = window.setInterval(() => {
      dispatch({ type: 'tick', turn });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [paused, result, turn]);

  const setTimes = useCallback((nextTimes) => {
    dispatch({ type: 'set', times: nextTimes });
  }, []);

  const expired = useMemo(() => {
    if (clockState.times[WHITE] === 0) return WHITE;
    if (clockState.times[BLACK] === 0) return BLACK;
    return null;
  }, [clockState.times]);

  return { times: clockState.times, setTimes, expired, reset };
}

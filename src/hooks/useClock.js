import { useCallback, useEffect, useMemo, useState } from 'react';
import { BLACK, WHITE } from '../utils/constants.js';

export function useClock({ initialMinutes = 10, incrementSeconds = 0, turn = WHITE, paused = false, result = null }) {
  const initialSeconds = initialMinutes * 60;
  const [times, setTimes] = useState({ [WHITE]: initialSeconds, [BLACK]: initialSeconds });
  const [lastTurn, setLastTurn] = useState(turn);

  const reset = useCallback(
    (nextTurn = turn) => {
      const nextInitialSeconds = initialMinutes * 60;
      setTimes({ [WHITE]: nextInitialSeconds, [BLACK]: nextInitialSeconds });
      setLastTurn(nextTurn);
    },
    [initialMinutes, turn],
  );

  useEffect(() => {
    reset(turn);
  }, [initialMinutes]);

  useEffect(() => {
    if (turn !== lastTurn) {
      setTimes((current) => ({
        ...current,
        [lastTurn]: current[lastTurn] + incrementSeconds,
      }));
      setLastTurn(turn);
    }
  }, [turn, lastTurn, incrementSeconds]);

  useEffect(() => {
    if (paused || result) return undefined;
    const timer = window.setInterval(() => {
      setTimes((current) => ({
        ...current,
        [turn]: Math.max(0, current[turn] - 1),
      }));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [turn, paused, result]);

  const expired = useMemo(() => {
    if (times[WHITE] === 0) return WHITE;
    if (times[BLACK] === 0) return BLACK;
    return null;
  }, [times]);

  return { times, setTimes, expired, reset };
}

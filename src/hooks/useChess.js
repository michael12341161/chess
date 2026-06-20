import { useCallback, useMemo, useRef, useState } from 'react';
import { GameEngine } from '../chess/engine/GameEngine.js';
import { legalMovesForSquare } from '../chess/engine/MoveGenerator.js';
import { getPiece } from '../utils/helpers.js';
import { PIECES } from '../utils/constants.js';
import { audioManager } from '../services/audio/AudioManager.js';

export function useChess(fen, options = {}) {
  const engineRef = useRef(null);
  if (!engineRef.current) {
    engineRef.current = new GameEngine(fen);
  }
  const [state, setState] = useState(() => engineRef.current.getState());
  const [selectedSquare, setSelectedSquare] = useState(null);
  const [pendingPromotion, setPendingPromotion] = useState(null);

  const selectedMoves = useMemo(
    () => (selectedSquare ? legalMovesForSquare(state, selectedSquare) : []),
    [state, selectedSquare],
  );

  const legalTargets = useMemo(() => selectedMoves.map((move) => move.to), [selectedMoves]);

  const commitState = useCallback((nextState, playedMove) => {
    setState(nextState);
    setSelectedSquare(null);
    if (playedMove?.promotion) audioManager.promote();
    else if (playedMove?.captured) audioManager.capture();
    else audioManager.move();
  }, []);

  const move = useCallback(
    (from, to, promotion) => {
      const beforeCount = engineRef.current.getState().history.length;
      const nextState = engineRef.current.move(from, to, promotion);
      const playedMove = nextState.history[beforeCount];
      commitState(nextState, playedMove);
      return nextState;
    },
    [commitState],
  );

  const moveObject = useCallback(
    (moveObjectValue) => {
      const beforeCount = engineRef.current.getState().history.length;
      const nextState = engineRef.current.moveObject(moveObjectValue);
      const playedMove = nextState.history[beforeCount];
      commitState(nextState, playedMove);
      return nextState;
    },
    [commitState],
  );

  const onSquareClick = useCallback(
    (square) => {
      if (state.result) return;
      const piece = getPiece(state.board, square);
      const selectedMove = selectedMoves.find((candidate) => candidate.to === square);

      if (selectedMove) {
        if (selectedMove.piece.type === PIECES.PAWN && selectedMove.promotion && !options.autoQueen) {
          setPendingPromotion({ from: selectedMove.from, to: selectedMove.to });
          return;
        }
        move(selectedMove.from, selectedMove.to, selectedMove.promotion);
        return;
      }

      if (piece?.color === state.turn) {
        setSelectedSquare(square);
      } else {
        setSelectedSquare(null);
      }
    },
    [move, options.autoQueen, selectedMoves, state],
  );

  const promote = useCallback(
    (pieceType) => {
      if (!pendingPromotion) return;
      move(pendingPromotion.from, pendingPromotion.to, pieceType);
      setPendingPromotion(null);
    },
    [move, pendingPromotion],
  );

  const reset = useCallback(
    (nextFen) => {
      const nextState = engineRef.current.reset(nextFen);
      setState(nextState);
      setSelectedSquare(null);
      setPendingPromotion(null);
    },
    [],
  );

  const undo = useCallback(() => {
    const nextState = engineRef.current.undo();
    setState(nextState);
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, []);

  const loadState = useCallback((savedState) => {
    const nextState = engineRef.current.loadState(savedState);
    setState(nextState);
    setSelectedSquare(null);
    setPendingPromotion(null);
  }, []);

  const resign = useCallback((color = state.turn) => {
    const nextState = engineRef.current.resign(color);
    setState(nextState);
  }, [state.turn]);

  const agreeDraw = useCallback(() => {
    const nextState = engineRef.current.agreeDraw();
    setState(nextState);
  }, []);

  return {
    engine: engineRef.current,
    state,
    selectedSquare,
    legalTargets,
    selectedMoves,
    pendingPromotion,
    onSquareClick,
    move,
    moveObject,
    promote,
    reset,
    undo,
    loadState,
    resign,
    agreeDraw,
    fen: engineRef.current.fen(),
    pgn: engineRef.current.pgn(),
  };
}

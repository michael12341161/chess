import { generateLegalMoves, legalMovesForSquare } from './MoveGenerator.js';
import { applyMoveToState, createGameState, drawByAgreement, resign } from './StateManager.js';
import { stateToFen } from '../../utils/fen.js';
import { cloneState } from '../../utils/helpers.js';
import { exportPgn } from '../../utils/pgn.js';

export class GameEngine {
  constructor(fen) {
    this.state = createGameState(fen);
    this.undoStack = [];
  }

  getState() {
    return cloneState(this.state);
  }

  loadState(state) {
    this.state = cloneState(state);
    this.undoStack = [];
    return this.getState();
  }

  loadFen(fen) {
    this.state = createGameState(fen);
    this.undoStack = [];
    return this.getState();
  }

  legalMoves(square) {
    return square ? legalMovesForSquare(this.state, square) : generateLegalMoves(this.state);
  }

  move(from, to, promotion) {
    const next = applyMoveToState(this.state, { from, to, promotion });
    if (next !== this.state) {
      this.undoStack.push(cloneState(this.state));
      this.state = next;
    }
    return this.getState();
  }

  moveObject(move) {
    const next = applyMoveToState(this.state, move);
    if (next !== this.state) {
      this.undoStack.push(cloneState(this.state));
      this.state = next;
    }
    return this.getState();
  }

  undo() {
    if (this.undoStack.length === 0) return this.getState();
    this.state = this.undoStack.pop();
    return this.getState();
  }

  reset(fen) {
    return this.loadFen(fen);
  }

  resign(color) {
    this.state = resign(this.state, color);
    return this.getState();
  }

  agreeDraw() {
    this.state = drawByAgreement(this.state);
    return this.getState();
  }

  fen() {
    return stateToFen(this.state);
  }

  pgn(tags) {
    return exportPgn(this.state, tags);
  }
}

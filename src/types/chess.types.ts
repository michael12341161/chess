export type Color = 'w' | 'b';
export type PieceType = 'p' | 'r' | 'n' | 'b' | 'q' | 'k';

export interface ChessPiece {
  color: Color;
  type: PieceType;
}

export interface ChessMove {
  from: string;
  to: string;
  piece: ChessPiece;
  captured?: ChessPiece | null;
  promotion?: PieceType;
  flags?: string[];
  san?: string;
  lan?: string;
  fen?: string;
}

export interface ChessState {
  board: Array<Array<ChessPiece | null>>;
  turn: Color;
  castling: Record<Color, { k: boolean; q: boolean }>;
  enPassant: string | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  history: ChessMove[];
  result: string | null;
  resultReason: string | null;
}

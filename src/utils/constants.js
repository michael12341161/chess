export const WHITE = 'w';
export const BLACK = 'b';

export const COLORS = {
  WHITE,
  BLACK,
};

export const COLOR_NAMES = {
  [WHITE]: 'White',
  [BLACK]: 'Black',
};

export const PIECES = {
  PAWN: 'p',
  ROOK: 'r',
  KNIGHT: 'n',
  BISHOP: 'b',
  QUEEN: 'q',
  KING: 'k',
};

export const PIECE_NAMES = {
  [PIECES.PAWN]: 'Pawn',
  [PIECES.ROOK]: 'Rook',
  [PIECES.KNIGHT]: 'Knight',
  [PIECES.BISHOP]: 'Bishop',
  [PIECES.QUEEN]: 'Queen',
  [PIECES.KING]: 'King',
};

export const PIECE_SYMBOLS = {
  [WHITE]: {
    [PIECES.KING]: '♔',
    [PIECES.QUEEN]: '♕',
    [PIECES.ROOK]: '♖',
    [PIECES.BISHOP]: '♗',
    [PIECES.KNIGHT]: '♘',
    [PIECES.PAWN]: '♙',
  },
  [BLACK]: {
    [PIECES.KING]: '♚',
    [PIECES.QUEEN]: '♛',
    [PIECES.ROOK]: '♜',
    [PIECES.BISHOP]: '♝',
    [PIECES.KNIGHT]: '♞',
    [PIECES.PAWN]: '♟',
  },
};

export const PIECE_LETTERS = {
  [PIECES.PAWN]: '',
  [PIECES.ROOK]: 'R',
  [PIECES.KNIGHT]: 'N',
  [PIECES.BISHOP]: 'B',
  [PIECES.QUEEN]: 'Q',
  [PIECES.KING]: 'K',
};

export const PROMOTION_PIECES = [
  PIECES.QUEEN,
  PIECES.ROOK,
  PIECES.BISHOP,
  PIECES.KNIGHT,
];

export const PIECE_VALUES = {
  [PIECES.PAWN]: 100,
  [PIECES.KNIGHT]: 320,
  [PIECES.BISHOP]: 330,
  [PIECES.ROOK]: 500,
  [PIECES.QUEEN]: 900,
  [PIECES.KING]: 20000,
};

export const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
export const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];
export const BOARD_SIZE = 8;
export const INITIAL_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const GAME_RESULTS = {
  ACTIVE: 'active',
  WHITE_WINS: '1-0',
  BLACK_WINS: '0-1',
  DRAW: '1/2-1/2',
};

export const DRAW_REASONS = {
  STALEMATE: 'stalemate',
  FIFTY_MOVE: 'fifty-move rule',
  THREEFOLD: 'threefold repetition',
  INSUFFICIENT_MATERIAL: 'insufficient material',
};

export const DEFAULT_SETTINGS = {
  boardTheme: 'tournament',
  soundEnabled: true,
  legalMoveHints: true,
  autoQueen: false,
  clockMinutes: 10,
  incrementSeconds: 0,
  flipped: false,
};

export const STORAGE_KEYS = {
  SETTINGS: 'chess-platform-settings',
  SAVED_GAMES: 'chess-platform-saved-games',
  ANALYSIS_GAME: 'chess-platform-analysis-game',
  PROFILE: 'chess-platform-profile',
  LOCAL_ACCOUNTS: 'chess-platform-local-accounts',
  LEADERBOARD: 'chess-platform-leaderboard',
};

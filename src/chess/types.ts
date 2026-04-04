export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type Color = 'white' | 'black';

export interface Piece {
  type: PieceType;
  color: Color;
}

export interface Position {
  row: number; // 0 = rank 8 (top), 7 = rank 1 (bottom)
  col: number; // 0 = file a (left), 7 = file h (right)
}

export interface Move {
  from: Position;
  to: Position;
  promotion?: PieceType;
  castling?: 'kingside' | 'queenside';
  enPassant?: boolean;
}

export type Board = (Piece | null)[][];

export type GameStatus = 'playing' | 'check' | 'checkmate' | 'stalemate';

export interface CastlingRights {
  white: { kingside: boolean; queenside: boolean };
  black: { kingside: boolean; queenside: boolean };
}

export interface GameState {
  board: Board;
  currentTurn: Color;
  selectedSquare: Position | null;
  validMoves: Move[];
  status: GameStatus;
  enPassantTarget: Position | null;
  castlingRights: CastlingRights;
  moveHistory: Move[];
  capturedPieces: { white: Piece[]; black: Piece[] };
  promotionPending: { from: Position; to: Position } | null;
  lastMove: Move | null;
  lastMoveWasCapture: boolean;
}

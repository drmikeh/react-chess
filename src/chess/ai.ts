import type { Board, CastlingRights, Color, Move, Piece, Position } from './types';
import { getAllLegalMoves, applyMoveToBoard, isInCheck, updateCastlingRights } from './engine';

const PIECE_VALUES: Record<string, number> = {
  pawn: 100,
  knight: 320,
  bishop: 330,
  rook: 500,
  queen: 900,
  king: 20000,
};

// Piece-square tables from white's perspective (row 0 = rank 8 = black's back rank)
const PST: Record<string, number[][]> = {
  pawn: [
    [0,   0,   0,   0,   0,   0,   0,   0],
    [50,  50,  50,  50,  50,  50,  50,  50],
    [10,  10,  20,  30,  30,  20,  10,  10],
    [5,    5,  10,  25,  25,  10,   5,   5],
    [0,    0,   0,  20,  20,   0,   0,   0],
    [5,   -5, -10,   0,   0, -10,  -5,   5],
    [5,   10,  10, -20, -20,  10,  10,   5],
    [0,    0,   0,   0,   0,   0,   0,   0],
  ],
  knight: [
    [-50, -40, -30, -30, -30, -30, -40, -50],
    [-40, -20,   0,   0,   0,   0, -20, -40],
    [-30,   0,  10,  15,  15,  10,   0, -30],
    [-30,   5,  15,  20,  20,  15,   5, -30],
    [-30,   0,  15,  20,  20,  15,   0, -30],
    [-30,   5,  10,  15,  15,  10,   5, -30],
    [-40, -20,   0,   5,   5,   0, -20, -40],
    [-50, -40, -30, -30, -30, -30, -40, -50],
  ],
  bishop: [
    [-20, -10, -10, -10, -10, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,  10,  10,   5,   0, -10],
    [-10,   5,   5,  10,  10,   5,   5, -10],
    [-10,   0,  10,  10,  10,  10,   0, -10],
    [-10,  10,  10,  10,  10,  10,  10, -10],
    [-10,   5,   0,   0,   0,   0,   5, -10],
    [-20, -10, -10, -10, -10, -10, -10, -20],
  ],
  rook: [
    [0,   0,   0,   0,   0,   0,   0,   0],
    [5,  10,  10,  10,  10,  10,  10,   5],
    [-5,  0,   0,   0,   0,   0,   0,  -5],
    [-5,  0,   0,   0,   0,   0,   0,  -5],
    [-5,  0,   0,   0,   0,   0,   0,  -5],
    [-5,  0,   0,   0,   0,   0,   0,  -5],
    [-5,  0,   0,   0,   0,   0,   0,  -5],
    [0,   0,   0,   5,   5,   0,   0,   0],
  ],
  queen: [
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
    [-10,   0,   0,   0,   0,   0,   0, -10],
    [-10,   0,   5,   5,   5,   5,   0, -10],
    [-5,    0,   5,   5,   5,   5,   0,  -5],
    [0,     0,   5,   5,   5,   5,   0,  -5],
    [-10,   5,   5,   5,   5,   5,   0, -10],
    [-10,   0,   5,   0,   0,   0,   0, -10],
    [-20, -10, -10,  -5,  -5, -10, -10, -20],
  ],
  king: [
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-30, -40, -40, -50, -50, -40, -40, -30],
    [-20, -30, -30, -40, -40, -30, -30, -20],
    [-10, -20, -20, -20, -20, -20, -20, -10],
    [20,   20,   0,   0,   0,   0,  20,  20],
    [20,   30,  10,   0,   0,  10,  30,  20],
  ],
};

function getPST(piece: Piece, row: number, col: number): number {
  const table = PST[piece.type];
  if (!table) return 0;
  // Mirror vertically for black pieces
  const r = piece.color === 'white' ? row : 7 - row;
  return table[r][col];
}

function evaluateBoard(board: Board): number {
  let score = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (!p) continue;
      const val = PIECE_VALUES[p.type] + getPST(p, r, c);
      score += p.color === 'white' ? val : -val;
    }
  }
  return score;
}

// Order captures first (MVV-LVA) for better alpha-beta pruning
function orderMoves(moves: Move[], board: Board): Move[] {
  return [...moves].sort((a, b) => {
    const ca = board[a.to.row][a.to.col];
    const cb = board[b.to.row][b.to.col];
    return (cb ? PIECE_VALUES[cb.type] : 0) - (ca ? PIECE_VALUES[ca.type] : 0);
  });
}

function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: Position | null,
): number {
  if (depth === 0) return evaluateBoard(board);

  const moves = getAllLegalMoves(board, color, castlingRights, enPassantTarget);
  if (moves.length === 0) {
    if (isInCheck(board, color)) return maximizing ? -100000 + depth : 100000 - depth;
    return 0; // stalemate
  }

  const ordered = orderMoves(moves, board);
  const nextColor: Color = color === 'white' ? 'black' : 'white';

  if (maximizing) {
    let best = -Infinity;
    for (const move of ordered) {
      const newBoard = applyMoveToBoard(board, move);
      const piece = board[move.from.row][move.from.col]!;
      const captured = board[move.to.row][move.to.col];
      const newCR = updateCastlingRights(castlingRights, piece, move, captured);
      let newEP: Position | null = null;
      if (piece.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
        newEP = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
      }
      best = Math.max(best, minimax(newBoard, depth - 1, alpha, beta, false, nextColor, newCR, newEP));
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const move of ordered) {
      const newBoard = applyMoveToBoard(board, move);
      const piece = board[move.from.row][move.from.col]!;
      const captured = board[move.to.row][move.to.col];
      const newCR = updateCastlingRights(castlingRights, piece, move, captured);
      let newEP: Position | null = null;
      if (piece.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
        newEP = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
      }
      best = Math.min(best, minimax(newBoard, depth - 1, alpha, beta, true, nextColor, newCR, newEP));
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

export function getBestMove(
  board: Board,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: Position | null,
  depth = 3,
): Move | null {
  const moves = getAllLegalMoves(board, color, castlingRights, enPassantTarget);
  if (moves.length === 0) return null;

  // Only consider queen promotion to reduce branching factor
  const filtered = moves.filter(m => !m.promotion || m.promotion === 'queen');
  // Shuffle for variety among equal moves
  for (let i = filtered.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
  }

  const ordered = orderMoves(filtered, board);
  const maximizing = color === 'white';
  let bestScore = maximizing ? -Infinity : Infinity;
  let bestMove = ordered[0];
  const nextColor: Color = color === 'white' ? 'black' : 'white';

  for (const move of ordered) {
    const newBoard = applyMoveToBoard(board, move);
    const piece = board[move.from.row][move.from.col]!;
    const captured = board[move.to.row][move.to.col];
    const newCR = updateCastlingRights(castlingRights, piece, move, captured);
    let newEP: Position | null = null;
    if (piece.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
      newEP = { row: (move.from.row + move.to.row) / 2, col: move.from.col };
    }
    const score = minimax(newBoard, depth - 1, -Infinity, Infinity, !maximizing, nextColor, newCR, newEP);
    if (maximizing ? score > bestScore : score < bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }

  return bestMove;
}

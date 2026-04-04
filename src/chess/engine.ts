import type {
  Board, CastlingRights, Color, GameState, GameStatus, Move, Piece, PieceType, Position,
} from './types';

export function initializeBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
  for (let col = 0; col < 8; col++) {
    board[0][col] = { type: backRank[col], color: 'black' };
    board[1][col] = { type: 'pawn', color: 'black' };
    board[6][col] = { type: 'pawn', color: 'white' };
    board[7][col] = { type: backRank[col], color: 'white' };
  }
  return board;
}

export function initializeGameState(): GameState {
  return {
    board: initializeBoard(),
    currentTurn: 'white',
    selectedSquare: null,
    validMoves: [],
    status: 'playing',
    enPassantTarget: null,
    castlingRights: {
      white: { kingside: true, queenside: true },
      black: { kingside: true, queenside: true },
    },
    moveHistory: [],
    capturedPieces: { white: [], black: [] },
    promotionPending: null,
    lastMove: null,
  };
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function findKing(board: Board, color: Color): Position | null {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c];
      if (p?.type === 'king' && p.color === color) return { row: r, col: c };
    }
  }
  return null;
}

export function isSquareAttacked(board: Board, pos: Position, byColor: Color): boolean {
  const { row, col } = pos;

  // Pawn attacks: a byColor pawn attacks this square from the row it would occupy
  const pawnRow = byColor === 'white' ? row + 1 : row - 1;
  for (const dc of [-1, 1]) {
    if (inBounds(pawnRow, col + dc)) {
      const p = board[pawnRow][col + dc];
      if (p?.type === 'pawn' && p.color === byColor) return true;
    }
  }

  // Knight attacks
  for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
    const r = row + dr, c = col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p?.type === 'knight' && p.color === byColor) return true;
    }
  }

  // Rook / Queen (straight lines)
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'rook' || p.type === 'queen')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  // Bishop / Queen (diagonals)
  for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
    let r = row + dr, c = col + dc;
    while (inBounds(r, c)) {
      const p = board[r][c];
      if (p) {
        if (p.color === byColor && (p.type === 'bishop' || p.type === 'queen')) return true;
        break;
      }
      r += dr; c += dc;
    }
  }

  // King adjacency
  for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
    const r = row + dr, c = col + dc;
    if (inBounds(r, c)) {
      const p = board[r][c];
      if (p?.type === 'king' && p.color === byColor) return true;
    }
  }

  return false;
}

export function isInCheck(board: Board, color: Color): boolean {
  const kingPos = findKing(board, color);
  if (!kingPos) return false;
  return isSquareAttacked(board, kingPos, color === 'white' ? 'black' : 'white');
}

export function updateCastlingRights(
  rights: CastlingRights,
  piece: Piece,
  move: Move,
  capturedPiece: Piece | null,
): CastlingRights {
  const r = {
    white: { ...rights.white },
    black: { ...rights.black },
  };
  if (piece.type === 'king') {
    r[piece.color].kingside = false;
    r[piece.color].queenside = false;
  }
  if (piece.type === 'rook') {
    if (move.from.row === 7 && move.from.col === 0) r.white.queenside = false;
    if (move.from.row === 7 && move.from.col === 7) r.white.kingside = false;
    if (move.from.row === 0 && move.from.col === 0) r.black.queenside = false;
    if (move.from.row === 0 && move.from.col === 7) r.black.kingside = false;
  }
  // A captured rook also loses castling rights
  if (capturedPiece?.type === 'rook') {
    if (move.to.row === 7 && move.to.col === 0) r.white.queenside = false;
    if (move.to.row === 7 && move.to.col === 7) r.white.kingside = false;
    if (move.to.row === 0 && move.to.col === 0) r.black.queenside = false;
    if (move.to.row === 0 && move.to.col === 7) r.black.kingside = false;
  }
  return r;
}

function getPseudoLegalMoves(
  board: Board,
  pos: Position,
  castlingRights: CastlingRights,
  enPassantTarget: Position | null,
): Move[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const moves: Move[] = [];
  const { row, col } = pos;
  const { color, type } = piece;
  const opp = color === 'white' ? 'black' : 'white';

  const push = (toRow: number, toCol: number, extra?: Partial<Move>) =>
    moves.push({ from: pos, to: { row: toRow, col: toCol }, ...extra });

  switch (type) {
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1;
      const startRow = color === 'white' ? 6 : 1;
      const promoRow = color === 'white' ? 0 : 7;
      const promos: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

      // Forward 1
      if (inBounds(row + dir, col) && !board[row + dir][col]) {
        if (row + dir === promoRow) {
          promos.forEach(pt => push(row + dir, col, { promotion: pt }));
        } else {
          push(row + dir, col);
          // Forward 2 from starting rank
          if (row === startRow && !board[row + 2 * dir][col]) {
            push(row + 2 * dir, col);
          }
        }
      }

      // Diagonal captures
      for (const dc of [-1, 1]) {
        const nr = row + dir, nc = col + dc;
        if (inBounds(nr, nc)) {
          if (board[nr][nc]?.color === opp) {
            if (nr === promoRow) {
              promos.forEach(pt => push(nr, nc, { promotion: pt }));
            } else {
              push(nr, nc);
            }
          }
          if (enPassantTarget?.row === nr && enPassantTarget?.col === nc) {
            push(nr, nc, { enPassant: true });
          }
        }
      }
      break;
    }

    case 'knight':
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && board[nr][nc]?.color !== color) push(nr, nc);
      }
      break;

    case 'bishop':
      for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
        let r = row + dr, c = col + dc;
        while (inBounds(r, c)) {
          if (board[r][c]?.color === color) break;
          push(r, c);
          if (board[r][c]) break;
          r += dr; c += dc;
        }
      }
      break;

    case 'rook':
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        let r = row + dr, c = col + dc;
        while (inBounds(r, c)) {
          if (board[r][c]?.color === color) break;
          push(r, c);
          if (board[r][c]) break;
          r += dr; c += dc;
        }
      }
      break;

    case 'queen':
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        let r = row + dr, c = col + dc;
        while (inBounds(r, c)) {
          if (board[r][c]?.color === color) break;
          push(r, c);
          if (board[r][c]) break;
          r += dr; c += dc;
        }
      }
      break;

    case 'king': {
      for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) {
        const nr = row + dr, nc = col + dc;
        if (inBounds(nr, nc) && board[nr][nc]?.color !== color) push(nr, nc);
      }
      const backRow = color === 'white' ? 7 : 0;
      if (row === backRow && col === 4) {
        if (castlingRights[color].kingside && !board[backRow][5] && !board[backRow][6]) {
          push(backRow, 6, { castling: 'kingside' });
        }
        if (castlingRights[color].queenside && !board[backRow][3] && !board[backRow][2] && !board[backRow][1]) {
          push(backRow, 2, { castling: 'queenside' });
        }
      }
      break;
    }
  }

  return moves;
}

export function applyMoveToBoard(board: Board, move: Move): Board {
  const b = board.map(row => [...row]);
  const piece = b[move.from.row][move.from.col]!;

  if (move.castling) {
    const r = move.from.row;
    if (move.castling === 'kingside') {
      b[r][6] = piece; b[r][4] = null;
      b[r][5] = b[r][7]; b[r][7] = null;
    } else {
      b[r][2] = piece; b[r][4] = null;
      b[r][3] = b[r][0]; b[r][0] = null;
    }
    return b;
  }

  if (move.enPassant) {
    b[move.from.row][move.to.col] = null; // remove captured pawn
  }

  b[move.to.row][move.to.col] = move.promotion
    ? { type: move.promotion, color: piece.color }
    : piece;
  b[move.from.row][move.from.col] = null;
  return b;
}

export function getLegalMoves(
  board: Board,
  pos: Position,
  castlingRights: CastlingRights,
  enPassantTarget: Position | null,
): Move[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];

  const opp = piece.color === 'white' ? 'black' : 'white';
  const pseudo = getPseudoLegalMoves(board, pos, castlingRights, enPassantTarget);

  return pseudo.filter(move => {
    // Castling: king cannot be in check or pass through attacked squares
    if (move.castling) {
      if (isInCheck(board, piece.color)) return false;
      const r = move.from.row;
      const passThrough = move.castling === 'kingside' ? [5, 6] : [3, 2];
      for (const c of passThrough) {
        if (isSquareAttacked(board, { row: r, col: c }, opp)) return false;
      }
    }
    const newBoard = applyMoveToBoard(board, move);
    return !isInCheck(newBoard, piece.color);
  });
}

export function getAllLegalMoves(
  board: Board,
  color: Color,
  castlingRights: CastlingRights,
  enPassantTarget: Position | null,
): Move[] {
  const all: Move[] = [];
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if (board[r][c]?.color === color) {
        all.push(...getLegalMoves(board, { row: r, col: c }, castlingRights, enPassantTarget));
      }
    }
  }
  return all;
}

export function makeMove(state: GameState, move: Move): GameState {
  const { board, castlingRights, moveHistory, capturedPieces } = state;
  const piece = board[move.from.row][move.from.col]!;
  const captured = move.enPassant
    ? board[move.from.row][move.to.col]
    : board[move.to.row][move.to.col];

  const newBoard = applyMoveToBoard(board, move);
  const newCastlingRights = updateCastlingRights(castlingRights, piece, move, captured);

  let newEnPassantTarget: Position | null = null;
  if (piece.type === 'pawn' && Math.abs(move.to.row - move.from.row) === 2) {
    newEnPassantTarget = {
      row: (move.from.row + move.to.row) / 2,
      col: move.from.col,
    };
  }

  const newCaptured = {
    white: [...capturedPieces.white],
    black: [...capturedPieces.black],
  };
  if (captured) newCaptured[captured.color].push(captured);

  const nextTurn: Color = piece.color === 'white' ? 'black' : 'white';
  const nextMoves = getAllLegalMoves(newBoard, nextTurn, newCastlingRights, newEnPassantTarget);

  let status: GameStatus = 'playing';
  if (nextMoves.length === 0) {
    status = isInCheck(newBoard, nextTurn) ? 'checkmate' : 'stalemate';
  } else if (isInCheck(newBoard, nextTurn)) {
    status = 'check';
  }

  return {
    board: newBoard,
    currentTurn: nextTurn,
    selectedSquare: null,
    validMoves: [],
    status,
    enPassantTarget: newEnPassantTarget,
    castlingRights: newCastlingRights,
    moveHistory: [...moveHistory, move],
    capturedPieces: newCaptured,
    promotionPending: null,
    lastMove: move,
  };
}

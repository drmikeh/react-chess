import type { GameState, Position } from '../chess/types';

const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

interface BoardProps {
  gameState: GameState;
  onSquareClick: (pos: Position) => void;
  isAiThinking: boolean;
}

export function Board({ gameState, onSquareClick, isAiThinking }: BoardProps) {
  const { board, selectedSquare, validMoves, lastMove, status, currentTurn } = gameState;

  const validMoveSet = new Set(validMoves.map(m => `${m.to.row},${m.to.col}`));

  const isSelected = (r: number, c: number) =>
    selectedSquare?.row === r && selectedSquare?.col === c;

  const isLastMoveSquare = (r: number, c: number) =>
    !!lastMove && (
      (lastMove.from.row === r && lastMove.from.col === c) ||
      (lastMove.to.row === r && lastMove.to.col === c)
    );

  const isLight = (r: number, c: number) => (r + c) % 2 === 0;

  const squares = [];
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      const isValidDest = validMoveSet.has(`${row},${col}`);
      const isCaptureDest = isValidDest && !!piece && piece.color !== gameState.currentTurn;
      const isKingInCheck = status === 'check' && piece?.type === 'king' && piece.color === currentTurn;

      const classes = [
        'square',
        isLight(row, col) ? 'light' : 'dark',
        isSelected(row, col) ? 'selected' : '',
        isLastMoveSquare(row, col) && !isSelected(row, col) ? 'last-move' : '',
        isKingInCheck ? 'in-check' : '',
      ].filter(Boolean).join(' ');

      squares.push(
        <div
          key={`${row}-${col}`}
          className={classes}
          onClick={() => !isAiThinking && onSquareClick({ row, col })}
          role="gridcell"
          aria-label={`${String.fromCharCode(97 + col)}${8 - row}${piece ? ` ${piece.color} ${piece.type}` : ''}`}
        >
          {/* Board coordinates */}
          {col === 0 && <span className="coord rank-label">{8 - row}</span>}
          {row === 7 && <span className="coord file-label">{String.fromCharCode(97 + col)}</span>}

          {/* Valid move indicators */}
          {isValidDest && !isCaptureDest && <span className="move-dot" aria-hidden="true" />}
          {isCaptureDest && <span className="capture-ring" aria-hidden="true" />}

          {/* Piece */}
          {piece && (
            <span className={`piece piece-${piece.color}`} aria-hidden="true">
              {PIECE_SYMBOLS[piece.color][piece.type]}
            </span>
          )}
        </div>
      );
    }
  }

  return (
    <div className="board-wrapper">
      <div
        className={`board${isAiThinking ? ' board--thinking' : ''}`}
        role="grid"
        aria-label="Chess board"
      >
        {squares}
      </div>
    </div>
  );
}

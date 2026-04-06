import { useState, useEffect, useCallback } from 'react';
import { Board } from './components/Board';
import { PromotionDialog } from './components/PromotionDialog';
import { initializeGameState, getLegalMoves, makeMove } from './chess/engine';
import { getBestMove } from './chess/ai';
import { useSound } from './hooks/useSound';
import type { GameState, PieceType, Position } from './chess/types';
import './App.css';

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Beginner',
  2: 'Easy',
  3: 'Normal',
  4: 'Hard',
  5: 'Expert',
  6: 'Master',
  7: 'Insane',
  8: 'Maximum',
};

const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

const PIECE_ORDER: Record<string, number> = {
  queen: 0, rook: 1, bishop: 2, knight: 3, pawn: 4, king: 5,
};

function CapturedPieces({ pieces, color }: { pieces: { type: string; color: string }[]; color: string }) {
  const sorted = [...pieces].sort((a, b) => PIECE_ORDER[a.type] - PIECE_ORDER[b.type]);
  return (
    <div className={`captured-pieces captured-${color}`} aria-label={`Captured ${color} pieces`}>
      {sorted.map((p, i) => (
        <span key={i} className={`cap-piece piece-${p.color}`}>
          {PIECE_SYMBOLS[p.color][p.type]}
        </span>
      ))}
    </div>
  );
}

function statusMessage(state: GameState, isAiThinking: boolean): { text: string; type: string } {
  if (state.status === 'checkmate') {
    const winner = state.currentTurn === 'white' ? 'Computer wins!' : 'You win!';
    return { text: `Checkmate — ${winner}`, type: 'game-over' };
  }
  if (state.status === 'stalemate') {
    return { text: 'Stalemate — Draw!', type: 'game-over' };
  }
  if (isAiThinking) {
    return { text: 'Computer is thinking…', type: 'thinking' };
  }
  if (state.currentTurn === 'white') {
    const extra = state.status === 'check' ? ' — You are in check!' : '';
    return { text: `Your turn (White)${extra}`, type: state.status === 'check' ? 'check' : 'playing' };
  }
  return { text: 'Computer\'s turn (Black)', type: 'playing' };
}

export default function App() {
  const [gameState, setGameState] = useState<GameState>(initializeGameState);
  const [isAiThinking, setIsAiThinking] = useState(false);
  const [searchDepth, setSearchDepth] = useState(3);
  const { playSound, isMuted, toggleMute } = useSound();

  // Play a sound whenever the board changes after a move
  useEffect(() => {
    const move = gameState.lastMove;
    if (!move) return;

    const { status, lastMoveWasCapture } = gameState;

    if (status === 'checkmate') {
      playSound('checkmate');
    } else if (status === 'stalemate') {
      playSound('stalemate');
    } else if (move.promotion) {
      playSound('promote');
    } else if (move.castling) {
      playSound('castle');
    } else if (status === 'check') {
      playSound('check');
    } else if (lastMoveWasCapture || move.enPassant) {
      playSound('capture');
    } else {
      playSound('move');
    }
  }, [gameState.lastMove, playSound]); // eslint-disable-line react-hooks/exhaustive-deps

  const isGameOver = gameState.status === 'checkmate' || gameState.status === 'stalemate';
  const isPlayerTurn = gameState.currentTurn === 'white' && !isAiThinking && !isGameOver;

  // AI move trigger
  useEffect(() => {
    if (gameState.currentTurn !== 'black' || isGameOver || isAiThinking) return;

    setIsAiThinking(true);
    const timer = setTimeout(() => {
      const { board, castlingRights, enPassantTarget } = gameState;
      const bestMove = getBestMove(board, 'black', castlingRights, enPassantTarget, searchDepth);
      setGameState(prev => {
        if (prev.currentTurn !== 'black') return prev;
        return bestMove ? makeMove(prev, bestMove) : prev;
      });
      setIsAiThinking(false);
    }, 200);

    return () => clearTimeout(timer);
  }, [gameState.currentTurn, gameState.moveHistory.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSquareClick = useCallback((pos: Position) => {
    if (!isPlayerTurn || gameState.promotionPending) return;

    setGameState(prev => {
      const { board, selectedSquare, validMoves, castlingRights, enPassantTarget } = prev;
      const clickedPiece = board[pos.row][pos.col];

      // If a square is already selected, try to move
      if (selectedSquare) {
        const matchingMoves = validMoves.filter(
          m => m.to.row === pos.row && m.to.col === pos.col
        );

        if (matchingMoves.length > 0) {
          // Promotion: show dialog before committing the move
          if (matchingMoves[0].promotion) {
            return { ...prev, promotionPending: { from: matchingMoves[0].from, to: matchingMoves[0].to } };
          }
          return makeMove(prev, matchingMoves[0]);
        }

        // Reselect a different own piece
        if (clickedPiece?.color === 'white') {
          const newMoves = getLegalMoves(board, pos, castlingRights, enPassantTarget);
          return { ...prev, selectedSquare: pos, validMoves: newMoves };
        }

        // Deselect
        return { ...prev, selectedSquare: null, validMoves: [] };
      }

      // Select own piece
      if (clickedPiece?.color === 'white') {
        const newMoves = getLegalMoves(board, pos, castlingRights, enPassantTarget);
        return { ...prev, selectedSquare: pos, validMoves: newMoves };
      }

      return prev;
    });
  }, [isPlayerTurn, gameState.promotionPending]);

  const handlePromotion = useCallback((pieceType: PieceType) => {
    setGameState(prev => {
      if (!prev.promotionPending) return prev;
      const { from, to } = prev.promotionPending;
      return makeMove(prev, { from, to, promotion: pieceType });
    });
  }, []);

  const handleNewGame = useCallback(() => {
    setIsAiThinking(false);
    setGameState(initializeGameState());
  }, []);

  const { text: statusText, type: statusType } = statusMessage(gameState, isAiThinking);

  return (
    <div className="chess-app">
      <header className="chess-header">
        <div className="chess-header-title">
          <h1>♟ Chess</h1>
          <p className="chess-subtitle">Player vs Computer</p>
        </div>
        <button
          className="mute-btn"
          onClick={toggleMute}
          type="button"
          aria-label={isMuted ? 'Unmute sounds' : 'Mute sounds'}
          title={isMuted ? 'Unmute sounds' : 'Mute sounds'}
        >
          {isMuted ? '🔇' : '🔊'}
        </button>
      </header>

      <main className="chess-main">
        <div className="game-layout">
          <div className="board-area">
            {/* Computer's captured pieces (pieces the computer lost) */}
            <CapturedPieces pieces={gameState.capturedPieces.black} color="black" />

            <Board
              gameState={gameState}
              onSquareClick={handleSquareClick}
              isAiThinking={isAiThinking}
            />

            {/* Player's captured pieces (pieces the player lost) */}
            <CapturedPieces pieces={gameState.capturedPieces.white} color="white" />
          </div>

          <aside className="game-info" aria-label="Game information">
            <div className={`status-badge status-${statusType}`} role="status" aria-live="polite">
              {isAiThinking && <span className="thinking-dots" aria-hidden="true" />}
              {statusText}
            </div>

            <div className="turn-indicator">
              <div className={`turn-chip ${gameState.currentTurn === 'white' ? 'active' : ''}`}>
                <span className="turn-piece">♙</span> You (White)
              </div>
              <div className={`turn-chip ${gameState.currentTurn === 'black' ? 'active' : ''}`}>
                <span className="turn-piece">♟</span> Computer (Black)
              </div>
            </div>

            <div className="move-counter">
              Move {Math.ceil(gameState.moveHistory.length / 2) + (gameState.moveHistory.length % 2 === 0 ? 0 : 0)}
              {' '}({gameState.moveHistory.length} half-moves)
            </div>

            <div className="difficulty-control">
              <div className="difficulty-header">
                <label htmlFor="difficulty-slider" className="difficulty-label">
                  Difficulty
                </label>
                <span className="difficulty-name">{DIFFICULTY_LABELS[searchDepth]}</span>
              </div>
              <input
                id="difficulty-slider"
                type="range"
                min={1}
                max={8}
                value={searchDepth}
                onChange={(e) => setSearchDepth(Number(e.target.value))}
                className="difficulty-slider"
                style={{ '--depth': searchDepth } as React.CSSProperties}
                disabled={isAiThinking}
                aria-label={`Search depth ${searchDepth} — ${DIFFICULTY_LABELS[searchDepth]}`}
              />
              <div className="difficulty-range-labels">
                <span>1</span>
                <span>8</span>
              </div>
              {searchDepth >= 6 && (
                <p className="difficulty-warning">⚠ May take several seconds per move</p>
              )}
            </div>

            <button className="new-game-btn" onClick={handleNewGame} type="button">
              New Game
            </button>

            <div className="legend">
              <h3>How to play</h3>
              <ul>
                <li>Click a piece to select it</li>
                <li>Click a highlighted square to move</li>
                <li>You play as <strong>White</strong></li>
              </ul>
            </div>
          </aside>
        </div>
      </main>

      {gameState.promotionPending && (
        <PromotionDialog color="white" onSelect={handlePromotion} />
      )}
    </div>
  );
}

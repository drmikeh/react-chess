import type { Color, PieceType } from '../chess/types';

const PIECE_SYMBOLS: Record<string, Record<string, string>> = {
  white: { queen: '♕', rook: '♖', bishop: '♗', knight: '♘' },
  black: { queen: '♛', rook: '♜', bishop: '♝', knight: '♞' },
};

const PIECE_NAMES: Record<PieceType, string> = {
  queen: 'Queen', rook: 'Rook', bishop: 'Bishop', knight: 'Knight',
  king: 'King', pawn: 'Pawn',
};

const PROMO_PIECES: PieceType[] = ['queen', 'rook', 'bishop', 'knight'];

interface PromotionDialogProps {
  color: Color;
  onSelect: (piece: PieceType) => void;
}

export function PromotionDialog({ color, onSelect }: PromotionDialogProps) {
  return (
    <div className="promo-overlay" role="dialog" aria-modal="true" aria-label="Choose promotion piece">
      <div className="promo-dialog">
        <h2 className="promo-title">Promote pawn to:</h2>
        <div className="promo-options">
          {PROMO_PIECES.map(type => (
            <button
              key={type}
              className={`promo-btn piece-${color}`}
              onClick={() => onSelect(type)}
              aria-label={PIECE_NAMES[type]}
            >
              <span className="promo-piece">{PIECE_SYMBOLS[color][type]}</span>
              <span className="promo-name">{PIECE_NAMES[type]}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

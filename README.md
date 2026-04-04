# ♟ React Chess

A single-player chess game built with React 19 and TypeScript. Play as White against a computer opponent powered by a minimax AI with alpha-beta pruning. No external chess libraries — the engine is written from scratch.

![Chess game screenshot](https://via.placeholder.com/800x500/1a1a2e/ffffff?text=React+Chess)

## Features

- **Full chess rules** — legal move generation for all piece types, castling (kingside & queenside), en passant, pawn promotion, and draw by stalemate
- **Check / checkmate detection** — the king flashes red when in check; the game ends with a clear result message
- **Computer opponent** — minimax search with alpha-beta pruning (depth 3) and piece-square positional tables
- **Move highlighting** — selected piece, valid destinations (dots / capture rings), and last-move highlights
- **Pawn promotion dialog** — choose Queen, Rook, Bishop, or Knight when a pawn reaches the back rank
- **Captured pieces display** — both players' captured pieces are shown above and below the board
- **Procedural sound effects** — 7 distinct sounds generated via the Web Audio API (no audio files)
- **Mute toggle** — 🔊/🔇 button in the header
- **Responsive layout** — adapts from desktop to mobile; squares scale with viewport width
- **Dark mode** — respects `prefers-color-scheme` automatically

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+

### Install & run

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

### Other scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the Vite dev server with HMR |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## How to Play

1. Click any of your **White** pieces to select it — valid moves are highlighted with dots (empty squares) or rings (captures).
2. Click a highlighted square to move.
3. When a pawn reaches the far rank a **promotion dialog** appears — choose your piece.
4. The computer replies automatically as **Black**.
5. Click **New Game** at any time to reset.

## Project Structure

```
src/
├── chess/
│   ├── types.ts        # TypeScript types: Piece, Move, GameState, …
│   ├── engine.ts       # Chess rules: move generation, check detection, makeMove
│   └── ai.ts           # Minimax AI with alpha-beta pruning & piece-square tables
├── components/
│   ├── Board.tsx        # Interactive 8×8 board with highlights
│   └── PromotionDialog.tsx  # Pawn promotion piece picker
├── hooks/
│   └── useSound.ts     # Web Audio API procedural sound effects
├── App.tsx             # Game orchestration, AI turn loop, layout
├── App.css             # All component styles (responsive + dark mode)
└── index.css           # Global CSS variables and resets
```

## Architecture

### Chess Engine (`src/chess/engine.ts`)

Pure TypeScript functions — no side effects, fully immutable board copies.

| Function | Description |
|----------|-------------|
| `initializeGameState()` | Returns the starting `GameState` |
| `getLegalMoves(board, pos, …)` | All legal moves for a piece at `pos` |
| `getAllLegalMoves(board, color, …)` | All legal moves for a given side |
| `makeMove(state, move)` | Returns a new `GameState` after applying `move` |
| `isInCheck(board, color)` | Returns `true` if `color`'s king is in check |
| `isSquareAttacked(board, pos, byColor)` | Attack detection used for check & castling |

### AI (`src/chess/ai.ts`)

- **Algorithm**: Negamax-style minimax with alpha-beta pruning
- **Search depth**: 3 half-moves (ply)
- **Evaluation**: Material values + piece-square tables (PST) for all six piece types
- **Move ordering**: Captures sorted by MVV-LVA (Most Valuable Victim – Least Valuable Attacker) for better pruning
- **Promotions**: Only queen promotions considered to reduce the branching factor

### Sound (`src/hooks/useSound.ts`)

All sounds are synthesised at runtime using the Web Audio API (`OscillatorNode` + `GainNode` with ADSR-style envelopes). The `AudioContext` is created lazily on the first user interaction to satisfy browser autoplay policies.

| Sound | Trigger |
|-------|---------|
| `move` | Normal piece move |
| `capture` | A piece is taken (or en passant) |
| `castle` | Kingside or queenside castling |
| `check` | Moving side puts opponent in check |
| `promote` | Pawn promotion |
| `checkmate` | Game ends by checkmate |
| `stalemate` | Game ends by stalemate |

## Tech Stack

| Technology | Version | Role |
|------------|---------|------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 8 | Build tool & dev server |
| Web Audio API | — | Procedural sound effects |

## License

MIT

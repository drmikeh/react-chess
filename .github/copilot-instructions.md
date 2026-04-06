# Copilot Instructions

## Commands

```bash
npm run dev       # Start Vite dev server (http://localhost:5173)
npm run build     # Type-check (tsc -b) then bundle for production
npm run lint      # Run ESLint over all .ts/.tsx files
npm run preview   # Serve the production build locally
```

There is no test suite.

## Architecture

Single-page React 19 app — player (White) vs minimax AI (Black). No external chess libraries; the engine is written from scratch.

```
src/
├── chess/
│   ├── types.ts      # All shared TypeScript types (Piece, Move, GameState, …)
│   ├── engine.ts     # Pure chess-rule functions (move gen, check detection, makeMove)
│   └── ai.ts         # Minimax + alpha-beta, piece-square tables, move ordering
├── components/
│   ├── Board.tsx         # Renders the 8×8 board with highlights
│   └── PromotionDialog.tsx
├── hooks/
│   └── useSound.ts   # Procedural Web Audio API sounds
├── App.tsx           # Game orchestration, AI turn loop, layout
├── App.css           # All component styles (responsive + dark mode via prefers-color-scheme)
└── index.css         # CSS variables and global resets
```

**Data flow:** `GameState` (defined in `types.ts`) is the single source of truth held in `App` via `useState`. Every move produces a brand-new `GameState` via the pure `makeMove` function — state is never mutated in place. The AI runs in a `setTimeout` (200 ms delay) inside a `useEffect` that watches `currentTurn` and `moveHistory.length`.

## Key Conventions

### Board coordinate system
`row 0` = rank 8 (Black's back rank, top of screen); `row 7` = rank 1 (White's back rank, bottom).  
`col 0` = file a (left); `col 7` = file h (right).  
White pawns move in direction `−1` (decreasing row); Black pawns move `+1`.

### Immutable engine
All functions in `engine.ts` are pure — boards are shallow-copied with `board.map(row => [...row])` before modification. `makeMove` returns a complete new `GameState`; it never mutates the previous state.

### Move generation pipeline
1. `getPseudoLegalMoves` — generates candidate moves ignoring check
2. `getLegalMoves` — filters pseudo-legal moves by applying each to a copy and verifying the moving side's king is not in check
3. `getAllLegalMoves` — calls `getLegalMoves` for every piece of a given colour

### AI (ai.ts)
- Negamax-style minimax with alpha-beta pruning, default depth 3
- Evaluation: material (`PIECE_VALUES`) + positional (`PST` tables, mirrored vertically for Black)
- Move ordering: captures sorted by MVV-LVA (most valuable victim first) for better pruning
- Only queen promotions are considered in `getBestMove` to limit branching

### Sound (useSound.ts)
- `AudioContext` is created lazily on first user gesture (browser autoplay policy)
- A single `sharedCtx` is reused across calls
- All audio errors are silently swallowed — audio is non-critical

### Promotion flow
When a pawn reaches the promotion rank, `makeMove` is **not** called immediately. Instead, `GameState.promotionPending` is set to `{ from, to }`. `PromotionDialog` renders, and only after the player picks a piece type does `handlePromotion` call `makeMove` with `{ from, to, promotion: pieceType }`.

### Styling
All component-level styles live in `App.css`; `index.css` is CSS variables and resets only. Dark mode is handled purely via `@media (prefers-color-scheme: dark)` — no JS theme toggle.

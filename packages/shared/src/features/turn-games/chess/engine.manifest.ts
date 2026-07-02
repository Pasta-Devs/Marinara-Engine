// Registry entry for the chess engine. The codegen scans turn-games/<game>/engine.manifest.ts
// and collects the single exported const into TURN_GAME_ENGINES.
import { chessEngine } from "./engine.js";

export const chessGameEngine = chessEngine;

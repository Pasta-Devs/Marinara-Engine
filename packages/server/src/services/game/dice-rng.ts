// ──────────────────────────────────────────────
// Game: the secure die
//
// The roller now lives with the dice grammar in
// @marinara-engine/shared (utils/dice-notation.ts), so
// the browser and the server throw the same fair die.
// This module keeps the server's import path.
//
// Deliberately not the macro engine's seeded randomness:
// that seed is derived from data the model can see.
// ──────────────────────────────────────────────

export { rollDieSecurely, type DieRoller } from "@marinara-engine/shared";

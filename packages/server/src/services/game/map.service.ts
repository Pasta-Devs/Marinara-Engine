// ──────────────────────────────────────────────
// Game: Map Generation Service
// ──────────────────────────────────────────────

/** Build the prompt for generating a map of the current area. */
export function buildMapGenerationPrompt(locationType: string, context: string): string {
  return [
    `Generate a map for the current area in the RPG game.`,
    ``,
    `Location type: ${locationType}`,
    `Context: ${context}`,
    ``,
    `Rules:`,
    `- For outdoor areas (overworld, city, forest, etc.): generate a "grid" type map (6x6 to 8x8)`,
    `- For indoor areas (dungeon, cave, building, etc.): generate a "node" type map`,
    ``,
    `Grid map format:`,
    `{`,
    `  "type": "grid",`,
    `  "name": "Area Name",`,
    `  "description": "Brief area description",`,
    `  "width": 6, "height": 6,`,
    `  "cells": [{"x": 0, "y": 0, "emoji": "🌲", "label": "Dense Forest", "discovered": true, "terrain": "forest"}],`,
    `  "partyPosition": {"x": 3, "y": 3}`,
    `}`,
    ``,
    `Node map format:`,
    `{`,
    `  "type": "node",`,
    `  "name": "Dungeon Name",`,
    `  "description": "Brief dungeon description",`,
    `  "nodes": [{"id": "entrance", "emoji": "🚪", "label": "Entrance", "x": 50, "y": 90, "discovered": true}],`,
    `  "edges": [{"from": "entrance", "to": "hallway1"}],`,
    `  "partyPosition": "entrance"`,
    `}`,
    ``,
    `Use diverse emojis for different terrain/room types. Mark the party's starting position as discovered.`,
    `Nearby cells/nodes should also be discovered; distant ones should be undiscovered (discovered: false).`,
    ``,
    `Output ONLY the JSON map object, no other text.`,
  ].join("\n");
}

import { fileTable, text, integer } from "../file-schema.js";
import { chats } from "./chats.js";
import { chatImages } from "./gallery.js";
import { gameSceneVideos } from "./game-scene-videos.js";

export const gameTurnStoryboards = fileTable("game_turn_storyboards", {
  id: text("id").primaryKey(),
  chatId: text("chat_id")
    .notNull()
    .references(() => chats.id, { onDelete: "cascade" }),
  messageId: text("message_id").notNull(),
  swipeIndex: integer("swipe_index").notNull().default(0),
  snapshotId: text("snapshot_id"),
  sessionNumber: integer("session_number"),
  turnNumber: integer("turn_number"),
  title: text("title").notNull().default(""),
  sourceNarration: text("source_narration").notNull().default(""),
  sourceNarrationHash: text("source_narration_hash").notNull().default(""),
  status: text("status").notNull().default("planning"),
  provider: text("provider").notNull().default(""),
  model: text("model").notNull().default(""),
  directorPrompt: text("director_prompt").notNull().default(""),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const gameTurnStoryboardKeyframes = fileTable("game_turn_storyboard_keyframes", {
  id: text("id").primaryKey(),
  storyboardId: text("storyboard_id")
    .notNull()
    .references(() => gameTurnStoryboards.id, { onDelete: "cascade" }),
  index: integer("index").notNull(),
  title: text("title").notNull().default(""),
  sectionStartIndex: integer("section_start_index"),
  sectionEndIndex: integer("section_end_index"),
  anchorQuote: text("anchor_quote").notNull().default(""),
  anchorKind: text("anchor_kind").notNull().default(""),
  narrationBeat: text("narration_beat").notNull().default(""),
  mangaPanelPrompt: text("manga_panel_prompt").notNull().default(""),
  imagePrompt: text("image_prompt").notNull().default(""),
  videoPrompt: text("video_prompt").notNull().default(""),
  animationSuitability: text("animation_suitability").notNull().default(""),
  characters: text("characters").notNull().default("[]"),
  continuityNotes: text("continuity_notes").notNull().default(""),
  cameraMotion: text("camera_motion").notNull().default(""),
  transitionHint: text("transition_hint").notNull().default(""),
  durationSeconds: integer("duration_seconds").notNull().default(5),
  aspectRatio: text("aspect_ratio").notNull().default("16:9"),
  chatImageId: text("chat_image_id").references(() => chatImages.id, { onDelete: "set null" }),
  sceneVideoId: text("scene_video_id").references(() => gameSceneVideos.id, { onDelete: "set null" }),
  status: text("status").notNull().default("planned"),
  error: text("error"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

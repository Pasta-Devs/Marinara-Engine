// ──────────────────────────────────────────────
// Schema: Noodle Fake Social Media
// ──────────────────────────────────────────────
import { fileTable, real, text } from "../file-schema.js";

export const noodleAccounts = fileTable(
  "noodle_accounts",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    entityId: text("entity_id").notNull(),
    handle: text("handle").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    avatarUrl: text("avatar_url"),
    invited: text("invited").notNull().default("false"),
    settings: text("settings").notNull().default("{}"),
    visibility: text("visibility").notNull().default("public"),
    publicAccountId: text("public_account_id"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  {
    uniqueBy: [{ keys: ["publicAccountId"], when: (row) => row.publicAccountId != null }],
  },
);

export const noodlePosts = fileTable("noodle_posts", {
  id: text("id").primaryKey(),
  authorAccountId: text("author_account_id").notNull(),
  content: text("content").notNull().default(""),
  imageUrl: text("image_url"),
  imagePrompt: text("image_prompt"),
  imageClaimToken: text("image_claim_token"),
  imageClaimLeaseUntil: text("image_claim_lease_until"),
  parentPostId: text("parent_post_id"),
  quotePostId: text("quote_post_id"),
  source: text("source").notNull().default("manual"),
  access: text("access").notNull().default("public"),
  ppvPrice: real("ppv_price"),
  metadata: text("metadata").notNull().default("{}"),
  authorSnapshot: text("author_snapshot").notNull().default("{}"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const noodleAccountSubscriptions = fileTable(
  "noodle_account_subscriptions",
  {
    id: text("id").primaryKey(),
    viewerAccountId: text("viewer_account_id").notNull(),
    creatorAccountId: text("creator_account_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [{ keys: ["viewerAccountId", "creatorAccountId"] }] },
);

export const noodlePostUnlocks = fileTable(
  "noodle_post_unlocks",
  {
    id: text("id").primaryKey(),
    viewerAccountId: text("viewer_account_id").notNull(),
    postId: text("post_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  { uniqueBy: [{ keys: ["viewerAccountId", "postId"] }] },
);

export const noodleInteractions = fileTable(
  "noodle_interactions",
  {
    id: text("id").primaryKey(),
    postId: text("post_id").notNull(),
    parentInteractionId: text("parent_interaction_id"),
    actorAccountId: text("actor_account_id").notNull(),
    type: text("type").notNull(),
    content: text("content"),
    imageUrl: text("image_url"),
    actorSnapshot: text("actor_snapshot").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  {
    uniqueBy: [
      {
        keys: ["postId", "actorAccountId", "type", "parentInteractionId"],
        when: (row) => row.type === "like" || row.type === "repost",
      },
    ],
  },
);

export const noodleActivityDigests = fileTable("noodle_activity_digests", {
  id: text("id").primaryKey(),
  accountIds: text("account_ids").notNull().default("[]"),
  content: text("content").notNull().default(""),
  sourceRunId: text("source_run_id"),
  sourcePostId: text("source_post_id"),
  sourceInteractionId: text("source_interaction_id"),
  createdAt: text("created_at").notNull(),
});

export const noodleRefreshRuns = fileTable("noodle_refresh_runs", {
  id: text("id").primaryKey(),
  status: text("status").notNull(),
  activeAccountIds: text("active_account_ids").notNull().default("[]"),
  prompt: text("prompt").notNull().default(""),
  result: text("result"),
  error: text("error"),
  attempts: text("attempts").notNull().default("[]"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const DEFAULT_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH = 5;
export const MAX_CUSTOM_AGENT_ACTIVATION_SCAN_DEPTH = 200;
export const DEFAULT_CUSTOM_AGENT_ACTIVATION_THRESHOLD = 0.5;
export const MAX_CUSTOM_AGENT_ACTIVATION_QUESTION_LENGTH = 500;
/**
 * The most of the chat's newest pictures and clips one decision may look at, for a
 * decision model that reads them. None unless a statement or an agent asks.
 */
export const MAX_DECISION_PICTURES = 3;
export const MAX_DECISION_CLIPS = 1;
/**
 * A decision that looks at pictures can wait for one: it is asked only when a picture or
 * clip is in this many of the newest messages, and reads as no otherwise.
 */
export const MAX_DECISION_MEDIA_WITHIN = 50;

interface ChubSearchNode {
  fullPath?: string;
  name?: string;
  tagline?: string;
  topics?: string[];
  starCount?: number;
  nChats?: number;
  nTokens?: number;
  nsfw?: boolean;
}

interface ChubSearchPayload {
  nodes?: ChubSearchNode[];
  cursor?: unknown;
}

export interface ChubSearchResponse extends ChubSearchPayload {
  data?: ChubSearchPayload;
}

interface ChubDefinition {
  personality?: string;
  tavern_personality?: string;
  scenario?: string;
  first_message?: string;
  example_dialogs?: string;
  alternate_greetings?: string[];
  description?: string;
  embedded_lorebook?: unknown;
}

interface ChubDetailNode {
  definition?: ChubDefinition;
}

export interface ChubDetailResponse {
  data?: { node?: ChubDetailNode };
  node?: ChubDetailNode;
}

export interface JannyHit {
  id?: string;
  name?: string;
  creatorUsername?: string;
  description?: string;
  tagIds?: number[];
  avatar?: string;
  totalToken?: number;
  isNsfw?: boolean;
}

interface JannySearchPage {
  hits?: JannyHit[];
  totalPages?: number;
  totalHits?: number;
}

export interface JannySearchResponse {
  results?: JannySearchPage[];
}

interface JannyCharacterDetail {
  personality?: string;
  scenario?: string;
  firstMessage?: string;
  exampleDialogs?: string;
  description?: string;
}

export interface JannyCharacterResponse {
  character?: JannyCharacterDetail;
}

interface ChartavernHit {
  path?: string;
  name?: string;
  author?: string;
  tagline?: string;
  tags?: string[];
  downloads?: number;
  likes?: number;
  totalTokens?: number;
  isNSFW?: boolean;
}

export interface ChartavernSearchResponse {
  hits?: ChartavernHit[];
  totalHits?: number;
  totalPages?: number;
}

interface ChartavernCardDetail {
  definition_character_description?: string;
  definition_personality?: string;
  definition_scenario?: string;
  definition_first_message?: string;
  definition_example_messages?: string;
  description?: string;
  lorebookId?: unknown;
}

export interface ChartavernDetailResponse {
  card?: ChartavernCardDetail;
}

interface PygmalionOwner {
  username?: string;
  displayName?: string;
}

export interface PygmalionCharacter {
  id?: string;
  displayName?: string;
  description?: string;
  owner?: PygmalionOwner;
  avatarUrl?: string;
  tags?: string[];
  downloads?: number;
  stars?: number;
  chatCount?: number;
  isSensitive?: boolean;
}

export interface PygmalionSearchResponse {
  characters?: PygmalionCharacter[];
  totalItems?: string | number;
}

interface PygmalionPersonality {
  persona?: string;
  greeting?: string;
  mesExample?: string;
  characterNotes?: string;
  alternateGreetings?: string[];
}

export interface PygmalionDetailResponse {
  character?: {
    personality?: PygmalionPersonality;
  };
}

interface WyvernStatistics {
  likes?: number;
  total_likes?: number;
  messages?: number;
  total_messages?: number;
  views?: number;
  total_views?: number;
}

interface WyvernCreator {
  displayName?: string;
  username?: string;
}

export interface WyvernCharacter {
  id?: string;
  name?: string;
  tagline?: string;
  tags?: string[];
  avatar_url?: string;
  avatar?: string;
  rating?: string;
  statistics_record?: WyvernStatistics;
  entity_statistics?: WyvernStatistics;
  creator?: WyvernCreator;
  likes?: number;
  messages?: number;
  views?: number;
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  alternate_greetings?: string[];
  lorebooks?: unknown[];
}

export interface WyvernSearchResponse {
  results?: WyvernCharacter[];
  total?: number;
  hasMore?: boolean;
}

export interface DatacatTagRecord {
  id?: number;
  tag_id?: number;
  tagId?: number;
  name?: string;
  slug?: string;
  count?: number;
}

export type DatacatTagsResponse =
  | DatacatTagRecord[]
  | {
      tags?: DatacatTagRecord[];
      facets?: DatacatTagRecord[];
    };

export type DatacatCharacterTag = string | number | DatacatTagRecord;

export interface DatacatCharacter {
  characterId?: string;
  character_id?: string;
  id?: string;
  chatName?: string;
  chat_name?: string;
  name?: string;
  creatorName?: string;
  creator_name?: string;
  description?: string;
  tags?: DatacatCharacterTag[];
  tagIds?: DatacatCharacterTag[];
  avatar?: string;
  chatCount?: number;
  chat_count?: number;
  totalTokens?: number;
  total_tokens?: number;
  isNsfw?: boolean;
}

interface DatacatFreshWindow {
  count?: number;
  characters?: DatacatCharacter[];
}

export interface DatacatFreshResponse {
  windows?: {
    last24h?: DatacatFreshWindow | DatacatCharacter[];
  };
  last24h?: DatacatFreshWindow | DatacatCharacter[];
}

export interface DatacatRecentResponse {
  characters?: DatacatCharacter[];
  totalCount?: number;
}

interface DatacatDownloadData {
  description?: string;
  personality?: string;
  scenario?: string;
  first_mes?: string;
  mes_example?: string;
  creator_notes?: string;
  alternate_greetings?: string[];
}

export interface DatacatDownloadResponse {
  data?: DatacatDownloadData;
}

interface DatacatCharacterDetail {
  description?: string;
  personality?: string;
  scenario?: string;
  first_message?: string;
}

export interface DatacatCharacterResponse extends DatacatCharacterDetail {
  character?: DatacatCharacterDetail;
}

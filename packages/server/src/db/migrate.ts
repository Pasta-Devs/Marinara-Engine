// ──────────────────────────────────────────────
// Lightweight Schema Migrations
// ──────────────────────────────────────────────
// Creates tables if missing, then adds missing columns.
// Each migration is idempotent — safe to run on every startup.
import { sql } from "drizzle-orm";
import type { DB } from "./connection.js";

// ── Table creation (CREATE IF NOT EXISTS) ──
// These match the Drizzle schema definitions exactly.
const CREATE_TABLES: string[] = [
  `CREATE TABLE IF NOT EXISTS chats (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    character_ids TEXT NOT NULL DEFAULT '[]',
    group_id TEXT,
    persona_id TEXT,
    prompt_preset_id TEXT,
    connection_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    last_message_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    character_id TEXT,
    content TEXT NOT NULL DEFAULT '',
    active_swipe_index INTEGER NOT NULL DEFAULT 0,
    publication_status TEXT NOT NULL DEFAULT 'canonical',
    publication_turn_id TEXT,
    promoted_at TEXT,
    rejected_at TEXT,
    rejection_reason TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS message_swipes (
    id TEXT PRIMARY KEY NOT NULL,
    message_id TEXT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    "index" INTEGER NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    publication_status TEXT NOT NULL DEFAULT 'canonical',
    publication_turn_id TEXT,
    promoted_at TEXT,
    rejected_at TEXT,
    rejection_reason TEXT,
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_call_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    mode TEXT NOT NULL DEFAULT 'audio',
    initiator TEXT NOT NULL,
    initiator_character_id TEXT,
    started_at TEXT,
    ended_at TEXT,
    summary TEXT,
    metadata TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_call_messages (
    id TEXT PRIMARY KEY NOT NULL,
    call_id TEXT NOT NULL REFERENCES conversation_call_sessions(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    role TEXT NOT NULL,
    character_id TEXT,
    participant_kind TEXT NOT NULL,
    kind TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    extra TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_call_sounds (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT,
    mime_type TEXT NOT NULL DEFAULT 'audio/mpeg',
    duration_ms INTEGER,
    built_in TEXT NOT NULL DEFAULT 'false',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS characters (
    id TEXT PRIMARY KEY NOT NULL,
    data TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    avatar_path TEXT,
    sprite_folder_path TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS character_card_versions (
    id TEXT PRIMARY KEY NOT NULL,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    avatar_path TEXT,
    version TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS personas (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    creator TEXT NOT NULL DEFAULT '',
    persona_version TEXT NOT NULL DEFAULT '1.0',
    creator_notes TEXT NOT NULL DEFAULT '',
    phonetic_name TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    personality TEXT NOT NULL DEFAULT '',
    scenario TEXT NOT NULL DEFAULT '',
    backstory TEXT NOT NULL DEFAULT '',
    appearance TEXT NOT NULL DEFAULT '',
    avatar_path TEXT,
    avatar_crop TEXT NOT NULL DEFAULT '',
    is_active TEXT NOT NULL DEFAULT 'false',
    name_color TEXT NOT NULL DEFAULT '',
    dialogue_color TEXT NOT NULL DEFAULT '',
    box_color TEXT NOT NULL DEFAULT '',
    tracker_card_colors TEXT NOT NULL DEFAULT '{"mode":"chat"}',
    persona_stats TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '[]',
    saved_status_options TEXT NOT NULL DEFAULT '[]',
    convo_display_name TEXT NOT NULL DEFAULT '',
    about_me TEXT NOT NULL DEFAULT '',
    convo_behavior TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS persona_card_versions (
    id TEXT PRIMARY KEY NOT NULL,
    persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    data TEXT NOT NULL,
    comment TEXT NOT NULL DEFAULT '',
    avatar_path TEXT,
    version TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    reason TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS character_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    avatar_path TEXT,
    character_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS persona_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    persona_ids TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS noodle_accounts (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    handle TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    invited TEXT NOT NULL DEFAULT 'false',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS noodle_posts (
    id TEXT PRIMARY KEY NOT NULL,
    author_account_id TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    image_url TEXT,
    image_prompt TEXT,
    parent_post_id TEXT,
    quote_post_id TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    metadata TEXT NOT NULL DEFAULT '{}',
    author_snapshot TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS noodle_interactions (
    id TEXT PRIMARY KEY NOT NULL,
    post_id TEXT NOT NULL,
    parent_interaction_id TEXT,
    actor_account_id TEXT NOT NULL,
    type TEXT NOT NULL,
    content TEXT,
    image_url TEXT,
    actor_snapshot TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS noodle_activity_digests (
    id TEXT PRIMARY KEY NOT NULL,
    account_ids TEXT NOT NULL DEFAULT '[]',
    content TEXT NOT NULL DEFAULT '',
    source_run_id TEXT,
    source_post_id TEXT,
    source_interaction_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS noodle_refresh_runs (
    id TEXT PRIMARY KEY NOT NULL,
    status TEXT NOT NULL,
    active_account_ids TEXT NOT NULL DEFAULT '[]',
    prompt TEXT NOT NULL DEFAULT '',
    result TEXT,
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lorebooks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT 'uncategorized',
    image_path TEXT,
    scan_depth INTEGER NOT NULL DEFAULT 2,
    token_budget INTEGER NOT NULL DEFAULT 2048,
    entry_limit INTEGER NOT NULL DEFAULT 100,
    recursive_scanning TEXT NOT NULL DEFAULT 'false',
    max_recursion_depth INTEGER NOT NULL DEFAULT 3,
    exclude_from_vectorization TEXT NOT NULL DEFAULT 'true',
    vector_query_depth INTEGER NOT NULL DEFAULT 10,
    vector_score_threshold REAL NOT NULL DEFAULT 0.3,
    vector_max_results INTEGER NOT NULL DEFAULT 10,
    character_id TEXT,
    persona_id TEXT,
    chat_id TEXT,
    is_global TEXT NOT NULL DEFAULT 'false',
    enabled TEXT NOT NULL DEFAULT 'true',
    scope TEXT NOT NULL DEFAULT '{"mode":"all","chatIds":[]}',
    tags TEXT NOT NULL DEFAULT '[]',
    generated_by TEXT,
    source_agent_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lorebook_character_links (
    id TEXT PRIMARY KEY NOT NULL,
    lorebook_id TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(lorebook_id, character_id)
  )`,
  `CREATE TABLE IF NOT EXISTS lorebook_persona_links (
    id TEXT PRIMARY KEY NOT NULL,
    lorebook_id TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
    persona_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(lorebook_id, persona_id)
  )`,
  `CREATE TABLE IF NOT EXISTS lorebook_folders (
    id TEXT PRIMARY KEY NOT NULL,
    lorebook_id TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    enabled TEXT NOT NULL DEFAULT 'true',
    parent_folder_id TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS lorebook_entries (
    id TEXT PRIMARY KEY NOT NULL,
    lorebook_id TEXT NOT NULL REFERENCES lorebooks(id) ON DELETE CASCADE,
    folder_id TEXT,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    keys TEXT NOT NULL DEFAULT '[]',
    secondary_keys TEXT NOT NULL DEFAULT '[]',
    enabled TEXT NOT NULL DEFAULT 'true',
    constant TEXT NOT NULL DEFAULT 'false',
    selective TEXT NOT NULL DEFAULT 'false',
    selective_logic TEXT NOT NULL DEFAULT 'and',
    probability INTEGER,
    scan_depth INTEGER,
    match_whole_words TEXT NOT NULL DEFAULT 'false',
    case_sensitive TEXT NOT NULL DEFAULT 'false',
    use_regex TEXT NOT NULL DEFAULT 'false',
    character_filter_mode TEXT NOT NULL DEFAULT 'any',
    character_filter_ids TEXT NOT NULL DEFAULT '[]',
    character_tag_filter_mode TEXT NOT NULL DEFAULT 'any',
    character_tag_filters TEXT NOT NULL DEFAULT '[]',
    generation_trigger_filter_mode TEXT NOT NULL DEFAULT 'any',
    generation_trigger_filters TEXT NOT NULL DEFAULT '[]',
    additional_matching_sources TEXT NOT NULL DEFAULT '[]',
    position INTEGER NOT NULL DEFAULT 0,
    depth INTEGER NOT NULL DEFAULT 4,
    "order" INTEGER NOT NULL DEFAULT 100,
    role TEXT NOT NULL DEFAULT 'system',
    sticky INTEGER,
    cooldown INTEGER,
    delay INTEGER,
    ephemeral INTEGER,
    "group" TEXT NOT NULL DEFAULT '',
    group_weight INTEGER,
    locked TEXT NOT NULL DEFAULT 'false',
    tag TEXT NOT NULL DEFAULT '',
    relationships TEXT NOT NULL DEFAULT '{}',
    dynamic_state TEXT NOT NULL DEFAULT '{}',
    activation_conditions TEXT NOT NULL DEFAULT '[]',
    schedule TEXT,
    prevent_recursion TEXT NOT NULL DEFAULT 'true',
    exclude_recursion TEXT NOT NULL DEFAULT 'false',
    delay_until_recursion TEXT NOT NULL DEFAULT 'false',
    exclude_from_vectorization TEXT NOT NULL DEFAULT 'false',
    embedding TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_presets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    conversation_prompt TEXT NOT NULL DEFAULT '',
    game_prompt TEXT NOT NULL DEFAULT '',
    section_order TEXT NOT NULL DEFAULT '[]',
    group_order TEXT NOT NULL DEFAULT '[]',
    variable_groups TEXT NOT NULL DEFAULT '[]',
    variable_values TEXT NOT NULL DEFAULT '{}',
    parameters TEXT NOT NULL DEFAULT '{}',
    wrap_format TEXT NOT NULL DEFAULT 'xml',
    default_choices TEXT NOT NULL DEFAULT '{}',
    is_default TEXT NOT NULL DEFAULT 'false',
    author TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_groups (
    id TEXT PRIMARY KEY NOT NULL,
    preset_id TEXT NOT NULL REFERENCES prompt_presets(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_group_id TEXT,
    "order" INTEGER NOT NULL DEFAULT 100,
    enabled TEXT NOT NULL DEFAULT 'true',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_sections (
    id TEXT PRIMARY KEY NOT NULL,
    preset_id TEXT NOT NULL REFERENCES prompt_presets(id) ON DELETE CASCADE,
    identifier TEXT NOT NULL,
    name TEXT NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    role TEXT NOT NULL DEFAULT 'system',
    enabled TEXT NOT NULL DEFAULT 'true',
    is_marker TEXT NOT NULL DEFAULT 'false',
    group_id TEXT,
    marker_config TEXT,
    injection_position TEXT NOT NULL DEFAULT 'ordered',
    injection_depth INTEGER NOT NULL DEFAULT 0,
    injection_order INTEGER NOT NULL DEFAULT 100,
    wrap_in_xml TEXT NOT NULL DEFAULT 'false',
    xml_tag_name TEXT NOT NULL DEFAULT '',
    forbid_overrides TEXT NOT NULL DEFAULT 'false'
  )`,
  `CREATE TABLE IF NOT EXISTS choice_blocks (
    id TEXT PRIMARY KEY NOT NULL,
    preset_id TEXT NOT NULL REFERENCES prompt_presets(id) ON DELETE CASCADE,
    variable_name TEXT NOT NULL,
    question TEXT NOT NULL,
    options TEXT NOT NULL DEFAULT '[]',
    multi_select TEXT NOT NULL DEFAULT 'false',
    separator TEXT NOT NULL DEFAULT ', ',
    random_pick TEXT NOT NULL DEFAULT 'false',
    display_mode TEXT NOT NULL DEFAULT 'auto',
    option_sort TEXT NOT NULL DEFAULT 'manual',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_connections (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    provider TEXT NOT NULL,
    base_url TEXT NOT NULL DEFAULT '',
    api_key_encrypted TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    image_path TEXT,
    max_context INTEGER NOT NULL DEFAULT 128000,
    max_parallel_jobs INTEGER NOT NULL DEFAULT 1,
    treat_as_local_endpoint TEXT NOT NULL DEFAULT 'false',
    is_default TEXT NOT NULL DEFAULT 'false',
    use_for_random TEXT NOT NULL DEFAULT 'false',
    enable_caching TEXT NOT NULL DEFAULT 'false',
    anthropic_extended_cache_ttl TEXT NOT NULL DEFAULT 'false',
    caching_at_depth INTEGER NOT NULL DEFAULT 5,
    prompt_preset_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    character_id TEXT,
    expression TEXT,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_configs (
    id TEXT PRIMARY KEY NOT NULL,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    phase TEXT NOT NULL,
    enabled TEXT NOT NULL DEFAULT 'true',
    connection_id TEXT,
    image_path TEXT,
    prompt_template TEXT NOT NULL DEFAULT '',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_runs (
    id TEXT PRIMARY KEY NOT NULL,
    agent_config_id TEXT NOT NULL REFERENCES agent_configs(id),
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    result_type TEXT NOT NULL,
    result_data TEXT NOT NULL DEFAULT '{}',
    tokens_used INTEGER NOT NULL DEFAULT 0,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    success TEXT NOT NULL DEFAULT 'true',
    error TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS agent_memory (
    id TEXT PRIMARY KEY NOT NULL,
    agent_config_id TEXT NOT NULL REFERENCES agent_configs(id),
    chat_id TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS custom_tools (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    parameters_schema TEXT NOT NULL DEFAULT '{}',
    execution_type TEXT NOT NULL DEFAULT 'static',
    webhook_url TEXT,
    static_result TEXT,
    script_body TEXT,
    include_hidden_context TEXT NOT NULL DEFAULT 'false',
    enabled TEXT NOT NULL DEFAULT 'true',
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_state_snapshots (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    swipe_index INTEGER NOT NULL DEFAULT 0,
    date TEXT,
    time TEXT,
    location TEXT,
    weather TEXT,
    temperature TEXT,
    world_custom_fields TEXT NOT NULL DEFAULT '[]',
    present_characters TEXT NOT NULL DEFAULT '[]',
    recent_events TEXT NOT NULL DEFAULT '[]',
    player_stats TEXT,
    persona_stats TEXT,
    field_locks TEXT,
    hidden_tracker_fields TEXT,
    committed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_engine_state (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL DEFAULT '',
    swipe_index INTEGER NOT NULL DEFAULT 0,
    game_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    state TEXT NOT NULL,
    committed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS humanos_architectures (
    id TEXT PRIMARY KEY NOT NULL,
    subject_type TEXT NOT NULL,
    subject_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 2,
    architecture TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS state_authority_records (
    id TEXT PRIMARY KEY NOT NULL,
    authority_kind TEXT NOT NULL,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL,
    target_key TEXT NOT NULL,
    reason TEXT NOT NULL,
    issued_by TEXT NOT NULL,
    authorization_key TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS state_patch_proposals (
    id TEXT PRIMARY KEY NOT NULL,
    schema_version INTEGER NOT NULL,
    target_kind TEXT NOT NULL, target_scope TEXT NOT NULL, target_id TEXT NOT NULL, target_key TEXT NOT NULL,
    operation TEXT NOT NULL, patch_json TEXT NOT NULL, patch_hash TEXT NOT NULL, base_revision INTEGER NOT NULL,
    evidence_kind TEXT NOT NULL, chat_id TEXT, turn_id TEXT, message_id TEXT, swipe_index INTEGER,
    source_content_hash TEXT, canonical_revision INTEGER, authority_record_id TEXT, authority_reason TEXT,
    authority_source_hash TEXT, actor_type TEXT NOT NULL, actor_id TEXT NOT NULL, authority_path TEXT NOT NULL,
    agent_run_id TEXT, pipeline_stage TEXT, writer_priority INTEGER NOT NULL, commit_group_id TEXT NOT NULL,
    dependency_ids_json TEXT NOT NULL DEFAULT '[]', failure_boundary TEXT NOT NULL, failure_mode TEXT NOT NULL,
    logical_patch_slot TEXT NOT NULL, idempotency_key TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'proposed',
    diagnostic_json TEXT, commit_id TEXT, created_at TEXT NOT NULL, resolved_at TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS state_parity_verifications (
    id TEXT PRIMARY KEY NOT NULL, proposal_id TEXT, adapter_kind TEXT NOT NULL, target_key TEXT NOT NULL,
    legacy_hash TEXT NOT NULL, predicted_hash TEXT NOT NULL, matched INTEGER NOT NULL,
    diagnostic_json TEXT, created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS state_target_heads (
    target_key TEXT PRIMARY KEY NOT NULL,
    target_kind TEXT NOT NULL,
    target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL,
    revision INTEGER NOT NULL DEFAULT 0,
    last_commit_id TEXT,
    state_hash TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS state_commit_ledger (
    id TEXT PRIMARY KEY NOT NULL,
    proposal_id TEXT NOT NULL,
    target_key TEXT NOT NULL,
    target_kind TEXT NOT NULL,
    target_scope TEXT NOT NULL,
    target_id TEXT NOT NULL,
    base_revision INTEGER NOT NULL,
    result_revision INTEGER NOT NULL,
    operation TEXT NOT NULL,
    patch_json TEXT NOT NULL,
    patch_hash TEXT NOT NULL,
    before_hash TEXT NOT NULL,
    result_hash TEXT NOT NULL,
    evidence_kind TEXT NOT NULL,
    evidence_chat_id TEXT,
    evidence_turn_id TEXT,
    evidence_message_id TEXT,
    evidence_swipe_index INTEGER,
    evidence_content_hash TEXT,
    evidence_canonical_revision INTEGER,
    evidence_reason TEXT,
    evidence_source_hash TEXT,
    actor_type TEXT NOT NULL,
    actor_id TEXT NOT NULL,
    authority_path TEXT NOT NULL,
    authority_record_id TEXT,
    batch_id TEXT NOT NULL,
    commit_order INTEGER NOT NULL DEFAULT 0,
    commit_group_id TEXT,
    dependency_commit_ids TEXT NOT NULL DEFAULT '[]',
    compensates_commit_id TEXT,
    idempotency_key TEXT NOT NULL,
    committed_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS relationship_saves (
    id TEXT PRIMARY KEY NOT NULL,
    target_key TEXT NOT NULL,
    chat_id TEXT NOT NULL,
    character_id TEXT NOT NULL,
    persona_id TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT '{}',
    active_truth_count INTEGER NOT NULL DEFAULT 0,
    milestone_count INTEGER NOT NULL DEFAULT 0,
    last_checkpoint_id TEXT,
    projection_hash TEXT NOT NULL DEFAULT '',
    source_commit_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS relationship_checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    relationship_save_id TEXT NOT NULL,
    target_key TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    revision INTEGER NOT NULL,
    canonical_message_count INTEGER NOT NULL,
    start_message_id TEXT NOT NULL,
    end_message_id TEXT NOT NULL,
    message_hashes TEXT NOT NULL DEFAULT '[]',
    previous_checkpoint_id TEXT,
    policy_version TEXT NOT NULL,
    character_truth_tokens INTEGER NOT NULL DEFAULT 0,
    active_state TEXT NOT NULL DEFAULT '{}',
    classifications TEXT NOT NULL DEFAULT '[]',
    source_commit_ids TEXT NOT NULL DEFAULT '[]',
    status TEXT NOT NULL DEFAULT 'valid',
    creation_reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_checkpoints (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL,
    snapshot_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    label TEXT NOT NULL,
    trigger_type TEXT NOT NULL,
    location TEXT,
    game_state TEXT,
    weather TEXT,
    time_of_day TEXT,
    turn_number INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_scene_videos (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    source_illustration_tag TEXT,
    source_illustration_path TEXT,
    prompt TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 10,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_turn_storyboards (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    message_id TEXT NOT NULL,
    swipe_index INTEGER NOT NULL DEFAULT 0,
    snapshot_id TEXT,
    session_number INTEGER,
    turn_number INTEGER,
    title TEXT NOT NULL DEFAULT '',
    source_narration TEXT NOT NULL DEFAULT '',
    source_narration_hash TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'planning',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    director_prompt TEXT NOT NULL DEFAULT '',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS game_turn_storyboard_keyframes (
    id TEXT PRIMARY KEY NOT NULL,
    storyboard_id TEXT NOT NULL REFERENCES game_turn_storyboards(id) ON DELETE CASCADE,
    "index" INTEGER NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    section_start_index INTEGER,
    section_end_index INTEGER,
    anchor_quote TEXT NOT NULL DEFAULT '',
    anchor_kind TEXT NOT NULL DEFAULT '',
    narration_beat TEXT NOT NULL DEFAULT '',
    manga_panel_prompt TEXT NOT NULL DEFAULT '',
    image_prompt TEXT NOT NULL DEFAULT '',
    video_prompt TEXT NOT NULL DEFAULT '',
    characters TEXT NOT NULL DEFAULT '[]',
    continuity_notes TEXT NOT NULL DEFAULT '',
    camera_motion TEXT NOT NULL DEFAULT '',
    transition_hint TEXT NOT NULL DEFAULT '',
    duration_seconds INTEGER NOT NULL DEFAULT 6,
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    chat_image_id TEXT REFERENCES chat_images(id) ON DELETE SET NULL,
    scene_video_id TEXT REFERENCES game_scene_videos(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'planned',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS regex_scripts (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    enabled TEXT NOT NULL DEFAULT 'true',
    find_regex TEXT NOT NULL,
    replace_string TEXT NOT NULL DEFAULT '',
    trim_strings TEXT NOT NULL DEFAULT '[]',
    placement TEXT NOT NULL DEFAULT '["ai_output"]',
    flags TEXT NOT NULL DEFAULT 'gi',
    prompt_only TEXT NOT NULL DEFAULT 'false',
    apply_mode TEXT,
    target_character_ids TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    min_depth INTEGER,
    max_depth INTEGER,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat_images (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    width INTEGER,
    height INTEGER,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS character_images (
    id TEXT PRIMARY KEY NOT NULL,
    character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    width INTEGER,
    height INTEGER,
    custom_kind TEXT,
    custom_name TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS persona_images (
    id TEXT PRIMARY KEY NOT NULL,
    persona_id TEXT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    width INTEGER,
    height INTEGER,
    custom_kind TEXT,
    custom_name TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS gallery_folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS global_images (
    id TEXT PRIMARY KEY NOT NULL,
    folder_id TEXT REFERENCES gallery_folders(id) ON DELETE SET NULL,
    file_path TEXT NOT NULL,
    prompt TEXT NOT NULL DEFAULT '',
    provider TEXT NOT NULL DEFAULT '',
    model TEXT NOT NULL DEFAULT '',
    width INTEGER,
    height INTEGER,
    custom_kind TEXT,
    custom_name TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS ooc_influences (
    id TEXT PRIMARY KEY NOT NULL,
    source_chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    target_chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    anchor_message_id TEXT,
    consumed TEXT NOT NULL DEFAULT 'false',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS conversation_notes (
    id TEXT PRIMARY KEY NOT NULL,
    source_chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    target_chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    anchor_message_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS memory_chunks (
    id TEXT PRIMARY KEY NOT NULL,
    chat_id TEXT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    embedding TEXT,
    message_count INTEGER NOT NULL,
    source_chat_id TEXT,
    first_message_at TEXT NOT NULL,
    last_message_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat_folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    collapsed TEXT NOT NULL DEFAULT 'false',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_connection_folders (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '',
    sort_order INTEGER NOT NULL DEFAULT 0,
    collapsed TEXT NOT NULL DEFAULT 'false',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS custom_themes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    css TEXT NOT NULL DEFAULT '',
    installed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    is_active TEXT NOT NULL DEFAULT 'false'
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS achievement_unlocks (
    id TEXT PRIMARY KEY NOT NULL,
    unlocked_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS installed_extensions (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    runtime TEXT NOT NULL DEFAULT 'client',
    css TEXT,
    js TEXT,
    server_js TEXT,
    enabled TEXT NOT NULL DEFAULT 'true',
    installed_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS chat_presets (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    mode TEXT NOT NULL,
    is_default TEXT NOT NULL DEFAULT 'false',
    is_active TEXT NOT NULL DEFAULT 'false',
    settings TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS prompt_overrides (
    key TEXT PRIMARY KEY NOT NULL,
    template TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    updated_at TEXT NOT NULL
  )`,
];

// ── Column migrations (ALTER TABLE for schema evolution) ──
interface ColumnMigration {
  table: string;
  column: string;
  definition: string;
}

const COLUMN_MIGRATIONS: ColumnMigration[] = [
  { table: "messages", column: "publication_status", definition: "TEXT NOT NULL DEFAULT 'canonical'" },
  { table: "messages", column: "publication_turn_id", definition: "TEXT" },
  { table: "messages", column: "promoted_at", definition: "TEXT" },
  { table: "messages", column: "rejected_at", definition: "TEXT" },
  { table: "messages", column: "rejection_reason", definition: "TEXT" },
  { table: "message_swipes", column: "publication_status", definition: "TEXT NOT NULL DEFAULT 'canonical'" },
  { table: "message_swipes", column: "publication_turn_id", definition: "TEXT" },
  { table: "message_swipes", column: "promoted_at", definition: "TEXT" },
  { table: "message_swipes", column: "rejected_at", definition: "TEXT" },
  { table: "message_swipes", column: "rejection_reason", definition: "TEXT" },
  { table: "game_engine_state", column: "revision", definition: "INTEGER" },
  { table: "game_engine_state", column: "base_revision", definition: "INTEGER" },
  { table: "game_engine_state", column: "turn_id", definition: "TEXT" },
  { table: "game_engine_state", column: "source_content_hash", definition: "TEXT" },
  { table: "game_engine_state", column: "patch_type", definition: "TEXT" },
  { table: "game_engine_state", column: "idempotency_key", definition: "TEXT" },
  { table: "state_commit_ledger", column: "authority_record_id", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_kind", definition: "TEXT NOT NULL DEFAULT 'migration'" },
  { table: "state_commit_ledger", column: "evidence_chat_id", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_turn_id", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_message_id", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_swipe_index", definition: "INTEGER" },
  { table: "state_commit_ledger", column: "evidence_content_hash", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_canonical_revision", definition: "INTEGER" },
  { table: "state_commit_ledger", column: "evidence_reason", definition: "TEXT" },
  { table: "state_commit_ledger", column: "evidence_source_hash", definition: "TEXT" },
  {
    table: "prompt_presets",
    column: "conversation_prompt",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "prompt_presets",
    column: "game_prompt",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "api_connections",
    column: "image_path",
    definition: "TEXT",
  },
  {
    table: "agent_configs",
    column: "image_path",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "enable_caching",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "api_connections",
    column: "anthropic_extended_cache_ttl",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "api_connections",
    column: "caching_at_depth",
    definition: "INTEGER NOT NULL DEFAULT 5",
  },
  {
    table: "game_state_snapshots",
    column: "committed",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "personas",
    column: "persona_stats",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "game_state_snapshots",
    column: "persona_stats",
    definition: "TEXT",
  },
  {
    table: "game_state_snapshots",
    column: "manual_overrides",
    definition: "TEXT",
  },
  {
    table: "game_state_snapshots",
    column: "field_locks",
    definition: "TEXT",
  },
  {
    table: "game_state_snapshots",
    column: "world_custom_fields",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "game_state_snapshots",
    column: "hidden_tracker_fields",
    definition: "TEXT",
  },
  {
    table: "lorebooks",
    column: "max_recursion_depth",
    definition: "INTEGER NOT NULL DEFAULT 3",
  },
  {
    table: "lorebooks",
    column: "entry_limit",
    definition: "INTEGER NOT NULL DEFAULT 100",
  },
  {
    table: "lorebooks",
    column: "exclude_from_vectorization",
    definition: "TEXT NOT NULL DEFAULT 'true'",
  },
  {
    table: "lorebooks",
    column: "vector_query_depth",
    definition: "INTEGER NOT NULL DEFAULT 10",
  },
  {
    table: "lorebooks",
    column: "vector_score_threshold",
    definition: "REAL NOT NULL DEFAULT 0.3",
  },
  {
    table: "lorebooks",
    column: "vector_max_results",
    definition: "INTEGER NOT NULL DEFAULT 10",
  },
  {
    table: "lorebooks",
    column: "persona_id",
    definition: "TEXT",
  },
  {
    table: "lorebook_entries",
    column: "prevent_recursion",
    definition: "TEXT NOT NULL DEFAULT 'true'",
  },
  {
    table: "lorebook_entries",
    column: "exclude_recursion",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "lorebook_entries",
    column: "delay_until_recursion",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "lorebook_entries",
    column: "embedding",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "embedding_model",
    definition: "TEXT",
  },
  {
    table: "chats",
    column: "connected_chat_id",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "embedding_connection_id",
    definition: "TEXT",
  },
  {
    table: "personas",
    column: "comment",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "creator",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "persona_version",
    definition: "TEXT NOT NULL DEFAULT '1.0'",
  },
  {
    table: "personas",
    column: "creator_notes",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "phonetic_name",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "lorebook_entries",
    column: "locked",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "lorebook_entries",
    column: "ephemeral",
    definition: "INTEGER",
  },
  {
    table: "api_connections",
    column: "default_for_agents",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "chats",
    column: "folder_id",
    definition: "TEXT",
  },
  {
    table: "chats",
    column: "sort_order",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "chats",
    column: "last_message_at",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "openrouter_provider",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "image_generation_source",
    definition: "TEXT",
  },
  {
    table: "regex_scripts",
    column: "target_character_ids",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "regex_scripts",
    column: "apply_mode",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "comfyui_workflow",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "image_service",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "embedding_base_url",
    definition: "TEXT",
  },
  {
    table: "characters",
    column: "comment",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "tags",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "personas",
    column: "saved_status_options",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "personas",
    column: "convo_display_name",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "about_me",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "convo_behavior",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "lorebooks",
    column: "tags",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "lorebooks",
    column: "is_global",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "lorebooks",
    column: "image_path",
    definition: "TEXT",
  },
  {
    table: "lorebooks",
    column: "scope",
    definition: 'TEXT NOT NULL DEFAULT \'{"mode":"all","chatIds":[]}\'',
  },
  {
    table: "api_connections",
    column: "default_parameters",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "prompt_preset_id",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "max_tokens_override",
    definition: "INTEGER",
  },
  {
    table: "api_connections",
    column: "max_parallel_jobs",
    definition: "INTEGER NOT NULL DEFAULT 1",
  },
  {
    table: "api_connections",
    column: "treat_as_local_endpoint",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "lorebook_entries",
    column: "description",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "lorebook_entries",
    column: "folder_id",
    definition: "TEXT",
  },
  {
    table: "lorebook_entries",
    column: "character_filter_mode",
    definition: "TEXT NOT NULL DEFAULT 'any'",
  },
  {
    table: "lorebook_entries",
    column: "character_filter_ids",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "lorebook_entries",
    column: "character_tag_filter_mode",
    definition: "TEXT NOT NULL DEFAULT 'any'",
  },
  {
    table: "lorebook_entries",
    column: "character_tag_filters",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "lorebook_entries",
    column: "generation_trigger_filter_mode",
    definition: "TEXT NOT NULL DEFAULT 'any'",
  },
  {
    table: "lorebook_entries",
    column: "generation_trigger_filters",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "lorebook_entries",
    column: "additional_matching_sources",
    definition: "TEXT NOT NULL DEFAULT '[]'",
  },
  {
    table: "lorebook_entries",
    column: "exclude_from_vectorization",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "api_connections",
    column: "claude_fast_mode",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "personas",
    column: "avatar_crop",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "personas",
    column: "tracker_card_colors",
    definition: `TEXT NOT NULL DEFAULT '{"mode":"chat"}'`,
  },
  {
    table: "api_connections",
    column: "folder_id",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "sort_order",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "api_connections",
    column: "image_endpoint_id",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "video_generation_source",
    definition: "TEXT",
  },
  {
    table: "api_connections",
    column: "video_service",
    definition: "TEXT",
  },
  {
    table: "memory_chunks",
    column: "source_chat_id",
    definition: "TEXT",
  },
  {
    table: "character_images",
    column: "custom_kind",
    definition: "TEXT",
  },
  {
    table: "character_images",
    column: "custom_name",
    definition: "TEXT",
  },
  {
    table: "persona_images",
    column: "custom_kind",
    definition: "TEXT",
  },
  {
    table: "persona_images",
    column: "custom_name",
    definition: "TEXT",
  },
  {
    table: "global_images",
    column: "custom_kind",
    definition: "TEXT",
  },
  {
    table: "global_images",
    column: "custom_name",
    definition: "TEXT",
  },
  {
    table: "custom_tools",
    column: "include_hidden_context",
    definition: "TEXT NOT NULL DEFAULT 'false'",
  },
  {
    table: "custom_tools",
    column: "sort_order",
    definition: "INTEGER NOT NULL DEFAULT 0",
  },
  {
    table: "choice_blocks",
    column: "display_mode",
    definition: "TEXT NOT NULL DEFAULT 'auto'",
  },
  {
    table: "choice_blocks",
    column: "option_sort",
    definition: "TEXT NOT NULL DEFAULT 'manual'",
  },
  {
    table: "installed_extensions",
    column: "runtime",
    definition: "TEXT NOT NULL DEFAULT 'client'",
  },
  {
    table: "installed_extensions",
    column: "server_js",
    definition: "TEXT",
  },
  {
    table: "game_turn_storyboard_keyframes",
    column: "section_start_index",
    definition: "INTEGER",
  },
  {
    table: "game_turn_storyboard_keyframes",
    column: "section_end_index",
    definition: "INTEGER",
  },
  {
    table: "game_turn_storyboard_keyframes",
    column: "anchor_quote",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "game_turn_storyboard_keyframes",
    column: "anchor_kind",
    definition: "TEXT NOT NULL DEFAULT ''",
  },
  {
    table: "noodle_interactions",
    column: "parent_interaction_id",
    definition: "TEXT",
  },
  {
    table: "noodle_interactions",
    column: "image_url",
    definition: "TEXT",
  },
  {
    table: "noodle_activity_digests",
    column: "source_interaction_id",
    definition: "TEXT",
  },
];

/**
 * Applies idempotent SQLite schema repairs on startup so upgraded installs can
 * use the current Drizzle schema before any routes or seeders touch the DB.
 *
 * Only runs for the legacy SQLite backend — app.ts gates this call behind
 * `!isFileStorageBackend()`, so it never runs on the default file-native store.
 */
export async function runMigrations(db: DB) {
  // 1. Create all tables if they don't exist
  for (const stmt of CREATE_TABLES) {
    await db.run(sql.raw(stmt));
  }

  // 2. Add missing columns to existing tables
  for (const migration of COLUMN_MIGRATIONS) {
    const tableInfo = await db.all<{ name: string }>(sql.raw(`PRAGMA table_info(${migration.table})`));
    const hasColumn = tableInfo.some((col) => col.name === migration.column);
    if (!hasColumn) {
      await db.run(sql.raw(`ALTER TABLE ${migration.table} ADD COLUMN ${migration.column} ${migration.definition}`));
    }
  }

  const customToolOrderRows = await db.all<{ id: string; sort_order: number | null }>(
    sql.raw(`SELECT id, sort_order FROM custom_tools ORDER BY sort_order ASC, updated_at DESC, id ASC`),
  );
  if (customToolOrderRows.length > 1 && customToolOrderRows.every((row) => Number(row.sort_order ?? 0) === 0)) {
    for (const [index, row] of customToolOrderRows.entries()) {
      await db.run(sql`UPDATE custom_tools SET sort_order = ${(index + 1) * 10} WHERE id = ${row.id}`);
    }
  }

  await db.run(
    sql.raw(`
      UPDATE chats
      SET last_message_at = (
        SELECT MAX(messages.created_at)
        FROM messages
        WHERE messages.chat_id = chats.id
      )
      WHERE (last_message_at IS NULL OR last_message_at = '')
      AND EXISTS (
        SELECT 1
        FROM messages
        WHERE messages.chat_id = chats.id
      )
    `),
  );

  // 3. Create indexes if they don't exist
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_chats_last_message_at ON chats(last_message_at DESC)`));
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_messages_chat_created_at ON messages(chat_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_state_chat_id ON game_state_snapshots(chat_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_state_message ON game_state_snapshots(message_id, swipe_index)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_engine_state_chat ON game_engine_state(chat_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_engine_state_message ON game_engine_state(message_id, swipe_index)`),
  );
  await db.run(
    sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_game_engine_state_idempotency ON game_engine_state(idempotency_key) WHERE idempotency_key IS NOT NULL`),
  );
  await db.run(
    sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_humanos_architectures_subject ON humanos_architectures(subject_type, subject_id)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_game_storyboards_chat_turn ON game_turn_storyboards(chat_id, session_number, turn_number DESC)`,
    ),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_scene_videos_chat ON game_scene_videos(chat_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_game_storyboards_message ON game_turn_storyboards(message_id, swipe_index)`,
    ),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_game_storyboard_keyframes_parent ON game_turn_storyboard_keyframes(storyboard_id, "index")`,
    ),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_lorebook_character_links_book ON lorebook_character_links(lorebook_id)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_lorebook_character_links_character ON lorebook_character_links(character_id)`,
    ),
  );
  await db.run(
    sql.raw(`
      DELETE FROM lorebook_character_links
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM lorebook_character_links
        GROUP BY lorebook_id, character_id
      )
    `),
  );
  await db.run(
    sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_lorebook_character_links_pair ON lorebook_character_links(lorebook_id, character_id)`,
    ),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_lorebook_persona_links_book ON lorebook_persona_links(lorebook_id)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_lorebook_persona_links_persona ON lorebook_persona_links(persona_id)`),
  );
  await db.run(
    sql.raw(`
      DELETE FROM lorebook_persona_links
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM lorebook_persona_links
        GROUP BY lorebook_id, persona_id
      )
    `),
  );
  await db.run(
    sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_lorebook_persona_links_pair ON lorebook_persona_links(lorebook_id, persona_id)`,
    ),
  );

  await db.run(
    sql.raw(`
      INSERT INTO lorebook_character_links (id, lorebook_id, character_id, created_at)
      SELECT 'legacy-char-' || id, id, character_id, created_at
      FROM lorebooks
      WHERE character_id IS NOT NULL
        AND character_id <> ''
        AND NOT EXISTS (
          SELECT 1 FROM lorebook_character_links
          WHERE lorebook_character_links.lorebook_id = lorebooks.id
            AND lorebook_character_links.character_id = lorebooks.character_id
        )
    `),
  );
  await db.run(
    sql.raw(`
      INSERT INTO lorebook_persona_links (id, lorebook_id, persona_id, created_at)
      SELECT 'legacy-persona-' || id, id, persona_id, created_at
      FROM lorebooks
      WHERE persona_id IS NOT NULL
        AND persona_id <> ''
        AND NOT EXISTS (
          SELECT 1 FROM lorebook_persona_links
          WHERE lorebook_persona_links.lorebook_id = lorebooks.id
            AND lorebook_persona_links.persona_id = lorebooks.persona_id
        )
    `),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_game_checkpoints_chat ON game_checkpoints(chat_id, created_at DESC)`),
  );
  await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_state_authority_records_authorization ON state_authority_records(authorization_key)`));
  await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_state_patch_proposals_idempotency ON state_patch_proposals(idempotency_key)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_state_patch_proposals_target_status ON state_patch_proposals(target_key, status, created_at)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_state_patch_proposals_chat_turn_status ON state_patch_proposals(chat_id, turn_id, status)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_state_patch_proposals_message_swipe ON state_patch_proposals(message_id, swipe_index)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_state_patch_proposals_agent_run ON state_patch_proposals(agent_run_id)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_state_parity_target_created ON state_parity_verifications(target_key, created_at)`));
  await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_state_commit_ledger_proposal ON state_commit_ledger(proposal_id)`));
  await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_state_commit_ledger_idempotency ON state_commit_ledger(idempotency_key)`));
  await db.run(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS idx_relationship_saves_target ON relationship_saves(target_key)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_relationship_saves_chat ON relationship_saves(chat_id, updated_at DESC)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_relationship_checkpoints_target ON relationship_checkpoints(target_key, revision DESC)`));
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_ooc_influences_target ON ooc_influences(target_chat_id, consumed)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_conversation_notes_target ON conversation_notes(target_chat_id, created_at)`,
    ),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_memory_chunks_chat ON memory_chunks(chat_id, last_message_at DESC)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_character_card_versions ON character_card_versions(character_id, created_at DESC)`,
    ),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_persona_card_versions ON persona_card_versions(persona_id, created_at DESC)`,
    ),
  );
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_noodle_accounts_entity ON noodle_accounts(kind, entity_id)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_noodle_posts_created ON noodle_posts(created_at DESC)`));
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_noodle_posts_author ON noodle_posts(author_account_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(`
      UPDATE noodle_posts
      SET image_prompt = NULL
      WHERE image_url IS NULL
        AND image_prompt IS NOT NULL
        AND metadata LIKE '%"imageGenerationFailed":true%'
    `),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_noodle_interactions_post ON noodle_interactions(post_id, created_at ASC)`),
  );
  await db.run(sql.raw(`DROP INDEX IF EXISTS uniq_noodle_toggle_interactions`));
  await db.run(
    sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_noodle_root_toggle_interactions ON noodle_interactions(post_id, actor_account_id, type) WHERE type IN ('like', 'repost') AND parent_interaction_id IS NULL`,
    ),
  );
  await db.run(
    sql.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS uniq_noodle_reply_like ON noodle_interactions(post_id, actor_account_id, type, parent_interaction_id) WHERE type = 'like' AND parent_interaction_id IS NOT NULL`,
    ),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_noodle_digests_created ON noodle_activity_digests(created_at DESC)`),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS idx_noodle_digests_interaction ON noodle_activity_digests(source_interaction_id)`,
    ),
  );
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_custom_themes_active ON custom_themes(is_active)`));
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_chat_presets_mode_active ON chat_presets(mode, is_active)`));
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_persona_images_persona ON persona_images(persona_id, created_at DESC)`),
  );
  await db.run(
    sql.raw(`CREATE INDEX IF NOT EXISTS idx_global_images_folder ON global_images(folder_id, created_at DESC)`),
  );
  await db.run(sql.raw(`CREATE INDEX IF NOT EXISTS idx_global_images_created ON global_images(created_at DESC)`));
}

use super::*;

fn clamp_number(value: Option<f64>, fallback: f64, min: f64, max: f64) -> f64 {
    value.unwrap_or(fallback).max(min).min(max)
}

fn normalize_top_p(value: Option<f64>) -> f64 {
    let clamped = clamp_number(value, 1.0, 0.0, 1.0);
    if clamped <= 0.0 {
        1.0
    } else {
        clamped
    }
}

fn st_prompt_name(raw: &Value, file_name: Option<&str>) -> String {
    if let Some(name) = raw
        .get("name")
        .and_then(Value::as_str)
        .filter(|name| !name.trim().is_empty())
    {
        return name.trim().to_string();
    }
    raw.get("prompts")
        .and_then(Value::as_array)
        .and_then(|prompts| {
            prompts.iter().find_map(|prompt| {
                let name = prompt.get("name").and_then(Value::as_str).unwrap_or("");
                if !name.contains("Read-Me") && !name.contains("README") {
                    return None;
                }
                let content = prompt.get("content").and_then(Value::as_str).unwrap_or("");
                content
                    .lines()
                    .find_map(|line| line.trim().strip_prefix("{{//").map(str::trim))
                    .map(|line| {
                        line.split(['(', '\n', '{'])
                            .next()
                            .unwrap_or(line)
                            .trim_matches([',', '!', ' '])
                            .to_string()
                    })
                    .filter(|name| name.len() > 2)
            })
        })
        .or_else(|| file_name.map(ToOwned::to_owned))
        .unwrap_or_else(|| "SillyTavern Preset".to_string())
}

fn st_reasoning_effort(value: Option<&Value>) -> Value {
    match value.and_then(Value::as_str) {
        Some("low" | "medium" | "high" | "xhigh" | "maximum") => {
            value.cloned().unwrap_or(Value::Null)
        }
        _ => Value::Null,
    }
}

fn st_variable_groups(prompts: &[Value]) -> Value {
    let mut groups: HashMap<String, Vec<Value>> = HashMap::new();
    for prompt in prompts {
        let content = prompt.get("content").and_then(Value::as_str).unwrap_or("");
        let label = prompt
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim_start_matches([
                '➊', '➋', '➌', '➍', '➎', '➏', '➐', '➑', '➀', '➁', '➂', '➃', '➄', '➅',
            ])
            .trim()
            .to_string();
        for chunk in content.split("{{setvar::").skip(1) {
            let Some(end) = chunk.find("}}") else {
                continue;
            };
            let parts: Vec<&str> = chunk[..end].splitn(2, "::").collect();
            if parts.len() != 2 {
                continue;
            }
            let name = parts[0].trim();
            let value = parts[1].trim();
            if name.is_empty() || value.is_empty() {
                continue;
            }
            let options = groups.entry(name.to_string()).or_default();
            if !options
                .iter()
                .any(|option| option.get("value").and_then(Value::as_str) == Some(value))
            {
                options.push(json!({
                    "label": if label.is_empty() { value } else { &label },
                    "value": value
                }));
            }
        }
    }
    Value::Array(
        groups
            .into_iter()
            .map(|(name, options)| {
                let mut chars = name.chars();
                let label = chars
                    .next()
                    .map(|first| first.to_uppercase().collect::<String>() + chars.as_str())
                    .unwrap_or_else(|| name.clone());
                json!({ "name": name, "label": label, "options": options })
            })
            .collect(),
    )
}

fn st_marker_config(identifier: &str) -> Option<Value> {
    match identifier {
        "chatHistory" => Some(json!({ "type": "chat_history" })),
        "charDescription" | "charPersonality" | "scenario" | "enhanceDefinitions" => {
            Some(json!({ "type": "character" }))
        }
        "personaDescription" => Some(json!({ "type": "persona" })),
        "worldInfoBefore" | "worldInfoAfter" => Some(json!({ "type": "lorebook" })),
        "dialogueExamples" => Some(json!({ "type": "dialogue_examples" })),
        _ => None,
    }
}

fn st_marker_display_name(marker_type: &str, fallback: &str) -> String {
    match marker_type {
        "character" => "Character Info",
        "lorebook" => "World Info",
        "persona" => "Persona",
        "chat_history" => "Chat History",
        "dialogue_examples" => "Chat Examples",
        "chat_summary" => "Chat Summary",
        "agent_data" => "Agent Data",
        _ => fallback,
    }
    .to_string()
}

fn starts_with_any(value: &str, chars: &[char]) -> bool {
    value
        .chars()
        .next()
        .is_some_and(|first| chars.contains(&first))
}

fn st_order_map(raw: &Value) -> HashMap<String, (usize, bool)> {
    let orders = raw
        .get("prompt_order")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let selected = orders
        .iter()
        .find(|entry| entry.get("character_id").and_then(Value::as_i64) == Some(100001))
        .or_else(|| orders.first());
    selected
        .and_then(|entry| entry.get("order").and_then(Value::as_array))
        .map(|entries| {
            entries
                .iter()
                .enumerate()
                .filter_map(|(index, entry)| {
                    let identifier = entry.get("identifier").and_then(Value::as_str)?.to_string();
                    let enabled = entry
                        .get("enabled")
                        .and_then(Value::as_bool)
                        .unwrap_or(true);
                    Some((identifier, (index, enabled)))
                })
                .collect()
        })
        .unwrap_or_default()
}

fn create_st_prompt_groups(
    state: &AppState,
    preset_id: &str,
    prompts: &[Value],
    created_group_ids: &mut Vec<String>,
) -> AppResult<(HashMap<String, String>, Vec<String>)> {
    let mut identifier_group_map = HashMap::new();
    let mut group_ids = Vec::new();
    let mut stack: Vec<(String, usize)> = Vec::new();

    for (index, prompt) in prompts.iter().enumerate() {
        let name = prompt.get("name").and_then(Value::as_str).unwrap_or("");
        if starts_with_any(name, &['┌', '┎', '⌈', '⌜']) {
            stack.push((
                name.chars().skip(1).collect::<String>().trim().to_string(),
                index,
            ));
        } else if starts_with_any(name, &['└', '┖', '⌊', '⌞']) {
            let Some((group_name, start_index)) = stack.pop() else {
                continue;
            };
            let created = state.storage.create(
                "prompt-groups",
                json!({
                    "presetId": preset_id,
                    "name": if group_name.is_empty() { "Imported Group" } else { &group_name },
                    "parentGroupId": Value::Null,
                    "order": group_ids.len(),
                    "sortOrder": group_ids.len(),
                    "enabled": true
                }),
            )?;
            if let Some(group_id) = created.get("id").and_then(Value::as_str) {
                let group_id = group_id.to_string();
                created_group_ids.push(group_id.clone());
                group_ids.push(group_id.clone());
                for inner in prompts.iter().take(index).skip(start_index + 1) {
                    if let Some(identifier) = inner.get("identifier").and_then(Value::as_str) {
                        identifier_group_map.insert(identifier.to_string(), group_id.clone());
                    }
                }
            }
        }
    }

    Ok((identifier_group_map, group_ids))
}

pub(super) fn import_st_preset_payload(
    state: &AppState,
    raw: Value,
    file_name: Option<&str>,
) -> AppResult<Value> {
    let prompts = raw
        .get("prompts")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();
    let order_map = st_order_map(&raw);
    let mut sorted_prompts = prompts.clone();
    sorted_prompts.sort_by_key(|prompt| {
        prompt
            .get("identifier")
            .and_then(Value::as_str)
            .and_then(|identifier| order_map.get(identifier).map(|(index, _)| *index))
            .unwrap_or(usize::MAX)
    });

    let top_k = raw
        .get("top_k")
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
        .round()
        .max(0.0);
    let max_tokens = raw
        .get("openai_max_tokens")
        .and_then(Value::as_f64)
        .unwrap_or(4096.0)
        .round()
        .max(1.0);
    let max_context = raw
        .get("openai_max_context")
        .and_then(Value::as_f64)
        .unwrap_or(128000.0)
        .round()
        .max(1.0);

    let mut created_preset_id = None;
    let mut created_group_ids = Vec::new();
    let mut created_section_ids = Vec::new();

    let result = (|| -> AppResult<Value> {
        let preset = state.storage.create(
            "prompts",
            with_entity_defaults(
                "prompts",
                json!({
                    "name": format!("Imported: {}", st_prompt_name(&raw, file_name)),
                    "description": "Imported from SillyTavern",
                    "variableGroups": st_variable_groups(&prompts),
                    "variableValues": {},
                    "defaultChoices": {},
                    "wrapFormat": "xml",
                    "sectionOrder": [],
                    "groupOrder": [],
                    "parameters": {
                        "temperature": clamp_number(raw.get("temperature").and_then(Value::as_f64), 1.0, 0.0, 2.0),
                        "topP": normalize_top_p(raw.get("top_p").and_then(Value::as_f64)),
                        "topK": top_k,
                        "minP": clamp_number(raw.get("min_p").and_then(Value::as_f64), 0.0, 0.0, 1.0),
                        "maxTokens": max_tokens,
                        "maxContext": max_context,
                        "frequencyPenalty": clamp_number(raw.get("frequency_penalty").and_then(Value::as_f64), 0.0, -2.0, 2.0),
                        "presencePenalty": clamp_number(raw.get("presence_penalty").and_then(Value::as_f64), 0.0, -2.0, 2.0),
                        "reasoningEffort": st_reasoning_effort(raw.get("reasoning_effort")),
                        "verbosity": Value::Null,
                        "assistantPrefill": "",
                        "customParameters": {},
                        "squashSystemMessages": raw.get("squash_system_messages").and_then(Value::as_bool).unwrap_or(true),
                        "showThoughts": raw.get("show_thoughts").and_then(Value::as_bool).unwrap_or(true),
                        "useMaxContext": false,
                        "stopSequences": [],
                        "strictRoleFormatting": true,
                        "singleUserMessage": false
                    }
                }),
            )?,
        )?;
        let preset_id = created_record_id(&preset, "preset")?;
        created_preset_id = Some(preset_id.clone());

        let (group_id_map, group_ids) =
            create_st_prompt_groups(state, &preset_id, &sorted_prompts, &mut created_group_ids)?;
        let mut section_ids = Vec::new();
        let mut emitted_markers: std::collections::HashSet<String> =
            std::collections::HashSet::new();

        for prompt in &sorted_prompts {
            let identifier = prompt
                .get("identifier")
                .and_then(Value::as_str)
                .unwrap_or("")
                .to_string();
            let name = prompt
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("Prompt");
            let content = prompt.get("content").and_then(Value::as_str).unwrap_or("");
            if starts_with_any(name, &['┌', '└', '┎', '┖', '⌈', '⌊', '⌜', '⌞'])
                && content.trim().is_empty()
            {
                continue;
            }

            let marker_config = if prompt
                .get("marker")
                .and_then(Value::as_bool)
                .unwrap_or(false)
            {
                st_marker_config(&identifier)
            } else {
                None
            };
            if let Some(marker_type) = marker_config
                .as_ref()
                .and_then(|marker| marker.get("type"))
                .and_then(Value::as_str)
            {
                if emitted_markers.contains(marker_type) {
                    continue;
                }
                emitted_markers.insert(marker_type.to_string());
            }

            let role = match prompt.get("role").and_then(Value::as_str) {
                Some("user") => "user",
                Some("assistant") => "assistant",
                _ => "system",
            };
            let enabled = order_map
                .get(&identifier)
                .map(|(_, enabled)| *enabled)
                .or_else(|| prompt.get("enabled").and_then(Value::as_bool))
                .unwrap_or(true);
            let marker_type = marker_config
                .as_ref()
                .and_then(|marker| marker.get("type"))
                .and_then(Value::as_str);
            let section_name = marker_type
                .map(|marker_type| st_marker_display_name(marker_type, name))
                .unwrap_or_else(|| name.to_string());
            let order = section_ids.len();
            let created = state.storage.create(
                "prompt-sections",
                json!({
                    "presetId": preset_id,
                    "identifier": if identifier.is_empty() { format!("imported-section-{order}") } else { identifier.clone() },
                    "name": section_name,
                    "content": content,
                    "role": role,
                    "enabled": enabled,
                    "isMarker": marker_config.is_some(),
                    "injectionPosition": if prompt.get("injection_position").and_then(Value::as_i64) == Some(1) { "depth" } else { "ordered" },
                    "injectionDepth": prompt.get("injection_depth").and_then(Value::as_i64).unwrap_or(0),
                    "injectionOrder": prompt.get("injection_order").and_then(Value::as_i64).unwrap_or(100),
                    "groupId": group_id_map.get(&identifier).map(|id| Value::String(id.clone())).unwrap_or(Value::Null),
                    "markerConfig": marker_config.unwrap_or(Value::Null),
                    "forbidOverrides": prompt.get("forbid_overrides").and_then(Value::as_bool).unwrap_or(false),
                    "order": order,
                    "sortOrder": order
                }),
            )?;
            if let Some(section_id) = created.get("id").and_then(Value::as_str) {
                let section_id = section_id.to_string();
                created_section_ids.push(section_id.clone());
                section_ids.push(section_id);
            }
        }

        state.storage.patch(
            "prompts",
            &preset_id,
            json!({
                "sectionOrder": section_ids,
                "groupOrder": group_ids
            }),
        )?;
        flush_import_writes(state)?;

        Ok(json!({
            "success": true,
            "type": "st_preset",
            "presetId": preset_id,
            "id": preset_id,
            "sectionsImported": section_ids.len(),
            "groupsImported": group_ids.len(),
            "variableGroups": st_variable_groups(&prompts).as_array().map(Vec::len).unwrap_or(0),
            "preset": preset
        }))
    })();

    result.map_err(|error| {
        let mut rollback_errors = Vec::new();
        rollback_created_records(
            state,
            "prompt-sections",
            &created_section_ids,
            &mut rollback_errors,
        );
        rollback_created_records(
            state,
            "prompt-groups",
            &created_group_ids,
            &mut rollback_errors,
        );
        if let Some(preset_id) = created_preset_id.as_deref() {
            rollback_created_records(
                state,
                "prompts",
                &[preset_id.to_string()],
                &mut rollback_errors,
            );
        }
        append_rollback_errors(error, "ST preset import", rollback_errors)
    })
}

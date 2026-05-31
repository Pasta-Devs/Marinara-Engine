use super::shared::*;
use super::*;

pub(crate) fn activate_persona(state: &AppState, id: &str) -> AppResult<Value> {
    get_required(state, "personas", id)?;
    let personas = state.storage.list("personas")?;
    for persona in personas {
        let Some(persona_id) = persona.get("id").and_then(Value::as_str) else {
            continue;
        };
        let active = persona_id == id;
        let is_active = persona
            .get("isActive")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let active_alias = persona
            .get("active")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        if is_active == active && active_alias == active {
            continue;
        }
        state.storage.patch(
            "personas",
            persona_id,
            json!({ "isActive": active, "active": active }),
        )?;
    }
    get_required(state, "personas", id)
}

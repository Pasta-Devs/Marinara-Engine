use super::shared::*;
use super::*;

pub(crate) fn activate_persona(state: &AppState, id: &str) -> AppResult<Value> {
    let personas = state.storage.list("personas")?;
    for persona in personas {
        let Some(persona_id) = persona.get("id").and_then(Value::as_str) else {
            continue;
        };
        let active = persona_id == id;
        state.storage.patch(
            "personas",
            persona_id,
            json!({ "isActive": active, "active": active }),
        )?;
    }
    get_required(state, "personas", id)
}

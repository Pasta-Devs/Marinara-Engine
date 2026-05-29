use super::super::*;
use buttplug::{
    connector::ButtplugRemoteClientConnector,
    device::{ClientDeviceCommandValue, ClientDeviceOutputCommand},
    ButtplugClient, ButtplugClientDevice, ButtplugWebsocketClientTransport,
};
use buttplug_core::message::OutputType;
use std::sync::OnceLock;
use tokio::sync::Mutex;

const DEFAULT_INTIFACE_URL: &str = "ws://127.0.0.1:12345";
const MIN_COMMAND_INTERVAL_MS: u128 = 200;
const MAX_HAPTIC_DURATION_SECONDS: f64 = 30.0;

static HAPTIC: OnceLock<Mutex<HapticRuntime>> = OnceLock::new();

#[derive(Default)]
struct HapticRuntime {
    client: Option<ButtplugClient>,
    server_url: Option<String>,
    preferred_server_url: Option<String>,
    scanning: bool,
    last_command_at: u128,
}

pub(crate) async fn haptic_call(rest: &[&str], body: Value) -> AppResult<Value> {
    match rest {
        ["status"] => status().await,
        ["connect"] => connect(body).await,
        ["disconnect"] => disconnect().await,
        ["scan", "start"] => start_scan().await,
        ["scan", "stop"] => stop_scan().await,
        ["devices"] => devices().await,
        ["command"] => command(body).await,
        ["stop-all"] => stop_all().await,
        _ => Err(AppError::new(
            "route_not_found",
            format!("Unknown haptic route: /{}", rest.join("/")),
        )),
    }
}

fn runtime() -> &'static Mutex<HapticRuntime> {
    HAPTIC.get_or_init(|| Mutex::new(HapticRuntime::default()))
}

async fn status() -> AppResult<Value> {
    let runtime = runtime().lock().await;
    Ok(status_value(&runtime))
}

async fn devices() -> AppResult<Value> {
    let runtime = runtime().lock().await;
    Ok(json!({ "devices": device_list(runtime.client.as_ref()) }))
}

async fn connect(body: Value) -> AppResult<Value> {
    let requested_url = body
        .get("url")
        .and_then(Value::as_str)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned);
    let mut runtime = runtime().lock().await;
    if runtime
        .client
        .as_ref()
        .is_some_and(ButtplugClient::connected)
    {
        return Ok(status_value(&runtime));
    }
    let target = requested_url
        .clone()
        .or_else(|| runtime.preferred_server_url.clone())
        .unwrap_or_else(|| DEFAULT_INTIFACE_URL.to_string());
    let client = ButtplugClient::new("Marinara Engine");
    let transport = if target.starts_with("wss://") {
        ButtplugWebsocketClientTransport::new_secure_connector(&target, true)
    } else {
        ButtplugWebsocketClientTransport::new_insecure_connector(&target)
    };
    let connector: ButtplugRemoteClientConnector<ButtplugWebsocketClientTransport> =
        ButtplugRemoteClientConnector::new(transport);
    client
        .connect(connector)
        .await
        .map_err(|error| AppError::new("haptic_connect_failed", error.to_string()))?;
    runtime.client = Some(client);
    runtime.server_url = Some(target.clone());
    if requested_url.is_some() {
        runtime.preferred_server_url = Some(target);
    }
    Ok(status_value(&runtime))
}

async fn disconnect() -> AppResult<Value> {
    let mut runtime = runtime().lock().await;
    if let Some(client) = runtime.client.take() {
        if client.connected() {
            let _ = client.disconnect().await;
        }
    }
    runtime.server_url = None;
    runtime.scanning = false;
    Ok(status_value(&runtime))
}

async fn start_scan() -> AppResult<Value> {
    let mut runtime = runtime().lock().await;
    let client = runtime
        .client
        .as_ref()
        .filter(|client| client.connected())
        .ok_or_else(|| AppError::invalid_input("Not connected to Intiface Central"))?;
    client
        .start_scanning()
        .await
        .map_err(|error| AppError::new("haptic_scan_failed", error.to_string()))?;
    runtime.scanning = true;
    Ok(json!({ "scanning": true }))
}

async fn stop_scan() -> AppResult<Value> {
    let mut runtime = runtime().lock().await;
    if let Some(client) = runtime.client.as_ref().filter(|client| client.connected()) {
        let _ = client.stop_scanning().await;
    }
    runtime.scanning = false;
    Ok(json!({ "scanning": false }))
}

async fn stop_all() -> AppResult<Value> {
    let runtime = runtime().lock().await;
    if let Some(client) = runtime.client.as_ref().filter(|client| client.connected()) {
        client
            .stop_all_devices()
            .await
            .map_err(|error| AppError::new("haptic_stop_failed", error.to_string()))?;
    }
    Ok(json!({ "ok": true }))
}

async fn command(body: Value) -> AppResult<Value> {
    let now = now_millis();
    let mut runtime = runtime().lock().await;
    if !runtime
        .client
        .as_ref()
        .is_some_and(ButtplugClient::connected)
    {
        return Err(AppError::invalid_input("Not connected to Intiface Central"));
    }
    let action = normalize_action(body.get("action")).ok_or_else(|| {
        AppError::invalid_input(format!(
            "Unknown haptic action: {}",
            body.get("action").and_then(Value::as_str).unwrap_or("")
        ))
    })?;
    enforce_command_rate_limit(&mut runtime, now, action)?;
    let client = runtime
        .client
        .as_ref()
        .filter(|client| client.connected())
        .ok_or_else(|| AppError::invalid_input("Not connected to Intiface Central"))?;
    let targets = command_targets(client, &body)?;
    let intensity = clamp_unit(body.get("intensity"), 0.5);
    let duration = clamp_duration(body.get("duration"));

    for device in &targets {
        run_device_command(device, action, intensity, duration).await?;
    }
    if duration > 0.0 && action != "position" && action != "stop" {
        let stop_targets = targets.clone();
        tauri::async_runtime::spawn(async move {
            tokio::time::sleep(std::time::Duration::from_secs_f64(duration)).await;
            for device in stop_targets {
                let _ = device.stop().await;
            }
        });
    }
    Ok(json!({ "ok": true }))
}

fn enforce_command_rate_limit(
    runtime: &mut HapticRuntime,
    now: u128,
    action: &'static str,
) -> AppResult<()> {
    if action == "stop" {
        return Ok(());
    }
    if now.saturating_sub(runtime.last_command_at) < MIN_COMMAND_INTERVAL_MS {
        return Err(AppError::new(
            "rate_limited",
            "Haptic commands are rate limited",
        ));
    }
    runtime.last_command_at = now;
    Ok(())
}

fn status_value(runtime: &HapticRuntime) -> Value {
    json!({
        "connected": runtime.client.as_ref().is_some_and(ButtplugClient::connected),
        "serverUrl": runtime.server_url,
        "defaultServerUrl": runtime.preferred_server_url.as_deref().unwrap_or(DEFAULT_INTIFACE_URL),
        "scanning": runtime.scanning,
        "devices": device_list(runtime.client.as_ref())
    })
}

fn device_list(client: Option<&ButtplugClient>) -> Vec<Value> {
    let Some(client) = client.filter(|client| client.connected()) else {
        return Vec::new();
    };
    client
        .devices()
        .values()
        .map(|device| {
            json!({
                "index": device.index(),
                "name": device.display_name().as_deref().unwrap_or(device.name()),
                "capabilities": device_capabilities(device)
            })
        })
        .collect()
}

fn device_capabilities(device: &ButtplugClientDevice) -> Vec<&'static str> {
    let mut capabilities = Vec::new();
    for (output, capability) in [
        (OutputType::Vibrate, "vibrate"),
        (OutputType::Rotate, "rotate"),
        (OutputType::Oscillate, "oscillate"),
        (OutputType::Constrict, "constrict"),
        (OutputType::Position, "position"),
        (OutputType::HwPositionWithDuration, "position"),
    ] {
        if device.output_available(output) && !capabilities.contains(&capability) {
            capabilities.push(capability);
        }
    }
    capabilities
}

fn command_targets(client: &ButtplugClient, body: &Value) -> AppResult<Vec<ButtplugClientDevice>> {
    let devices = client.devices();
    if body
        .get("deviceIndex")
        .and_then(Value::as_str)
        .is_some_and(|value| value == "all")
        || body.get("deviceIndex").is_none()
    {
        return Ok(devices.values().cloned().collect());
    }
    let index = body
        .get("deviceIndex")
        .and_then(Value::as_u64)
        .ok_or_else(|| AppError::invalid_input("deviceIndex must be a number or 'all'"))?
        as u32;
    devices
        .get(&index)
        .cloned()
        .map(|device| vec![device])
        .ok_or_else(|| AppError::not_found(format!("No connected haptic device matched {index}")))
}

fn normalize_action(value: Option<&Value>) -> Option<&'static str> {
    let key = value?
        .as_str()?
        .trim()
        .to_ascii_lowercase()
        .replace([' ', '_', '-'], "");
    match key.as_str() {
        "vibrate" => Some("vibrate"),
        "rotate" => Some("rotate"),
        "oscillate" => Some("oscillate"),
        "constrict" => Some("constrict"),
        "position" | "positionwithduration" | "hwpositionwithduration" | "linear" => {
            Some("position")
        }
        "stop" => Some("stop"),
        _ => None,
    }
}

fn clamp_unit(value: Option<&Value>, fallback: f64) -> f64 {
    value
        .and_then(Value::as_f64)
        .unwrap_or(fallback)
        .clamp(0.0, 1.0)
}

fn clamp_duration(value: Option<&Value>) -> f64 {
    value
        .and_then(Value::as_f64)
        .unwrap_or(0.0)
        .clamp(0.0, MAX_HAPTIC_DURATION_SECONDS)
}

async fn run_device_command(
    device: &ButtplugClientDevice,
    action: &'static str,
    intensity: f64,
    duration: f64,
) -> AppResult<()> {
    if action == "stop" {
        return device
            .stop()
            .await
            .map_err(|error| AppError::new("haptic_command_failed", error.to_string()));
    }

    let value = ClientDeviceCommandValue::Percent(intensity);
    let command = if action == "position" {
        if device.output_available(OutputType::HwPositionWithDuration) {
            ClientDeviceOutputCommand::HwPositionWithDuration(
                value,
                ((duration.max(1.0)) * 1000.0) as u32,
            )
        } else if device.output_available(OutputType::Position) {
            ClientDeviceOutputCommand::Position(value)
        } else if device.output_available(OutputType::Vibrate) {
            ClientDeviceOutputCommand::Vibrate(value)
        } else {
            return Err(AppError::invalid_input(format!(
                "No compatible haptic output for {}",
                device.display_name().as_deref().unwrap_or(device.name())
            )));
        }
    } else {
        output_command_for_action(device, action, value).ok_or_else(|| {
            AppError::invalid_input(format!(
                "No compatible haptic output for {}",
                device.display_name().as_deref().unwrap_or(device.name())
            ))
        })?
    };

    device
        .run_output(&command)
        .await
        .map_err(|error| AppError::new("haptic_command_failed", error.to_string()))
}

fn output_command_for_action(
    device: &ButtplugClientDevice,
    action: &'static str,
    value: ClientDeviceCommandValue,
) -> Option<ClientDeviceOutputCommand> {
    match action {
        "vibrate" if device.output_available(OutputType::Vibrate) => {
            Some(ClientDeviceOutputCommand::Vibrate(value))
        }
        "rotate" if device.output_available(OutputType::Rotate) => {
            Some(ClientDeviceOutputCommand::Rotate(value))
        }
        "oscillate" if device.output_available(OutputType::Oscillate) => {
            Some(ClientDeviceOutputCommand::Oscillate(value))
        }
        "constrict" if device.output_available(OutputType::Constrict) => {
            Some(ClientDeviceOutputCommand::Constrict(value))
        }
        _ if device.output_available(OutputType::Vibrate) => {
            Some(ClientDeviceOutputCommand::Vibrate(value))
        }
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stop_commands_bypass_rate_limit() {
        let mut runtime = HapticRuntime {
            last_command_at: 1_000,
            ..HapticRuntime::default()
        };

        assert!(enforce_command_rate_limit(&mut runtime, 1_050, "stop").is_ok());
        assert_eq!(runtime.last_command_at, 1_000);
    }

    #[test]
    fn non_stop_commands_keep_rate_limit() {
        let mut runtime = HapticRuntime {
            last_command_at: 1_000,
            ..HapticRuntime::default()
        };

        assert!(enforce_command_rate_limit(&mut runtime, 1_050, "vibrate").is_err());
        assert_eq!(runtime.last_command_at, 1_000);

        assert!(enforce_command_rate_limit(&mut runtime, 1_250, "vibrate").is_ok());
        assert_eq!(runtime.last_command_at, 1_250);
    }
}

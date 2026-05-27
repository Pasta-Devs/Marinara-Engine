use marinara_core::{AppError, AppResult};
use serde::Deserialize;
use serde_json::{json, Value};
use std::cmp::Ordering;
use std::time::Duration;

const APP_VERSION: &str = env!("CARGO_PKG_VERSION");
const GITHUB_REPO: &str = "Pasta-Devs/Marinara-Engine";
const GITHUB_REPO_URL: &str = "https://github.com/Pasta-Devs/Marinara-Engine";
const GITHUB_RELEASES_URL: &str = "https://github.com/Pasta-Devs/Marinara-Engine/releases/latest";
const GITHUB_TAGS_API: &str =
    "https://api.github.com/repos/Pasta-Devs/Marinara-Engine/git/matching-refs/tags/v";

#[derive(Debug, Deserialize)]
struct TagRef {
    #[serde(default)]
    r#ref: String,
}

#[derive(Debug, Deserialize)]
struct GitHubRelease {
    html_url: Option<String>,
    body: Option<String>,
    published_at: Option<String>,
}

#[derive(Debug, Clone)]
struct ReleaseInfo {
    latest_version: String,
    release_tag: String,
    release_url: String,
    release_notes: String,
    published_at: String,
}

fn normalize_tag(tag: &str) -> String {
    tag.trim().trim_start_matches('v').to_string()
}

fn is_stable_version_tag(tag: &str) -> bool {
    let Some(rest) = tag.trim().strip_prefix('v') else {
        return false;
    };
    let parts: Vec<&str> = rest.split('.').collect();
    parts.len() == 3
        && parts
            .iter()
            .all(|part| !part.is_empty() && part.chars().all(|ch| ch.is_ascii_digit()))
}

fn parse_version(version: &str) -> Vec<u64> {
    normalize_tag(version)
        .split('.')
        .map(|part| part.parse::<u64>().unwrap_or(0))
        .collect()
}

fn compare_versions(left: &str, right: &str) -> Ordering {
    let left = parse_version(left);
    let right = parse_version(right);
    for index in 0..left.len().max(right.len()) {
        match left
            .get(index)
            .unwrap_or(&0)
            .cmp(right.get(index).unwrap_or(&0))
        {
            Ordering::Equal => {}
            ordering => return ordering,
        }
    }
    Ordering::Equal
}

fn is_newer_version(current: &str, latest: &str) -> bool {
    compare_versions(latest, current).is_gt()
}

fn platform_label() -> &'static str {
    if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else if cfg!(target_os = "android") {
        "android"
    } else if cfg!(target_os = "ios") {
        "ios"
    } else {
        "unknown"
    }
}

fn manual_update_hint() -> &'static str {
    "Download the latest Marinara Engine release asset for this platform, run the installer or replace the app bundle, then restart Marinara Engine."
}

fn release_payload(release: &ReleaseInfo) -> Value {
    let version_update = is_newer_version(APP_VERSION, &release.latest_version);
    json!({
        "currentVersion": APP_VERSION,
        "latestVersion": release.latest_version,
        "releaseTag": release.release_tag,
        "releaseUrl": release.release_url,
        "releaseNotes": release.release_notes,
        "publishedAt": release.published_at,
        "updateAvailable": version_update,
        "versionUpdate": version_update,
        "installType": "tauri-desktop",
        "serverPlatform": platform_label(),
        "clientPlatform": "desktop",
        "updateMechanism": "manual-release",
        "tauriUpdaterConfigured": false,
        "applyAvailable": false,
        "applyUnavailableReason": "tauri-updater-not-configured",
        "manualUpdateCommand": Value::Null,
        "manualUpdateHint": manual_update_hint(),
    })
}

fn fallback_release(tag: &str) -> ReleaseInfo {
    ReleaseInfo {
        latest_version: normalize_tag(tag),
        release_tag: tag.to_string(),
        release_url: format!("{GITHUB_REPO_URL}/releases/tag/{tag}"),
        release_notes: String::new(),
        published_at: String::new(),
    }
}

fn is_trusted_release_url(value: &str) -> bool {
    let Ok(url) = reqwest::Url::parse(value) else {
        return false;
    };

    url.scheme() == "https"
        && url.host_str() == Some("github.com")
        && url
            .path()
            .starts_with("/Pasta-Devs/Marinara-Engine/releases/")
}

async fn fetch_latest_release() -> AppResult<ReleaseInfo> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|error| AppError::new("update_check_failed", error.to_string()))?;

    let tags = client
        .get(GITHUB_TAGS_API)
        .header(reqwest::header::ACCEPT, "application/vnd.github.v3+json")
        .header(
            reqwest::header::USER_AGENT,
            format!("MarinaraEngine/{APP_VERSION}"),
        )
        .send()
        .await
        .map_err(|error| AppError::new("update_check_failed", error.to_string()))?;

    if !tags.status().is_success() {
        return Err(AppError::new(
            "update_check_failed",
            format!("GitHub tags API returned {}", tags.status()),
        ));
    }

    let refs = tags
        .json::<Vec<TagRef>>()
        .await
        .map_err(|error| AppError::new("update_check_failed", error.to_string()))?;
    let latest_tag = refs
        .iter()
        .filter_map(|entry| entry.r#ref.rsplit('/').next())
        .filter(|tag| is_stable_version_tag(tag))
        .max_by(|left, right| compare_versions(left, right))
        .ok_or_else(|| {
            AppError::new(
                "update_check_failed",
                "No stable vX.Y.Z tags were found on GitHub",
            )
        })?;

    let release_url =
        format!("https://api.github.com/repos/{GITHUB_REPO}/releases/tags/{latest_tag}");
    let release = client
        .get(release_url)
        .header(reqwest::header::ACCEPT, "application/vnd.github.v3+json")
        .header(
            reqwest::header::USER_AGENT,
            format!("MarinaraEngine/{APP_VERSION}"),
        )
        .send()
        .await
        .map_err(|error| AppError::new("update_check_failed", error.to_string()))?;

    if !release.status().is_success() {
        return Ok(fallback_release(latest_tag));
    }

    let release = release
        .json::<GitHubRelease>()
        .await
        .map_err(|error| AppError::new("update_check_failed", error.to_string()))?;

    Ok(ReleaseInfo {
        latest_version: normalize_tag(latest_tag),
        release_tag: latest_tag.to_string(),
        release_url: release
            .html_url
            .unwrap_or_else(|| format!("{GITHUB_REPO_URL}/releases/tag/{latest_tag}")),
        release_notes: release.body.unwrap_or_default(),
        published_at: release.published_at.unwrap_or_default(),
    })
}

pub async fn check_updates() -> AppResult<Value> {
    let release = fetch_latest_release().await?;
    Ok(release_payload(&release))
}

pub fn apply_update(input: Value) -> AppResult<Value> {
    let body = input.as_object();
    if body
        .and_then(|object| object.get("confirm"))
        .and_then(Value::as_bool)
        != Some(true)
    {
        return Err(AppError::invalid_input(
            "Must send { confirm: true } to continue to manual update instructions",
        ));
    }

    let latest_version = body
        .and_then(|object| object.get("latestVersion"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(APP_VERSION);
    let release_tag = body
        .and_then(|object| object.get("releaseTag"))
        .and_then(Value::as_str)
        .filter(|value| !value.trim().is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| format!("v{latest_version}"));
    let release_url = body
        .and_then(|object| object.get("releaseUrl"))
        .and_then(Value::as_str)
        .filter(|value| is_trusted_release_url(value))
        .unwrap_or(GITHUB_RELEASES_URL);

    Ok(json!({
        "status": "manual_update_required",
        "message": "Automatic Tauri update installation is not configured for this build. Open the release page, install the latest asset, then restart Marinara Engine.",
        "currentVersion": APP_VERSION,
        "latestVersion": latest_version,
        "releaseTag": release_tag,
        "releaseUrl": release_url,
        "installType": "tauri-desktop",
        "serverPlatform": platform_label(),
        "updateMechanism": "manual-release",
        "tauriUpdaterConfigured": false,
        "applyAvailable": false,
        "applyUnavailableReason": "tauri-updater-not-configured",
        "manualUpdateCommand": Value::Null,
        "manualUpdateHint": manual_update_hint(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stable_tag_filter_excludes_prerelease_and_non_versions() {
        assert!(is_stable_version_tag("v1.2.3"));
        assert!(!is_stable_version_tag("v1.2.3-beta.1"));
        assert!(!is_stable_version_tag("1.2.3"));
        assert!(!is_stable_version_tag("v1.2"));
        assert!(!is_stable_version_tag("v1.2.x"));
    }

    #[test]
    fn version_comparison_handles_multi_digit_parts() {
        assert!(is_newer_version("1.9.0", "1.10.0"));
        assert!(!is_newer_version("1.10.0", "1.9.9"));
        assert!(!is_newer_version("1.10.0", "1.10.0"));
    }

    #[test]
    fn apply_update_rejects_unconfirmed_requests() {
        let error = apply_update(json!({})).expect_err("unconfirmed apply should be rejected");
        assert_eq!(error.code, "invalid_input");
    }

    #[test]
    fn apply_update_returns_manual_release_handoff() {
        let response = apply_update(json!({
            "confirm": true,
            "latestVersion": "1.6.2",
            "releaseTag": "v1.6.2",
            "releaseUrl": "https://github.com/Pasta-Devs/Marinara-Engine/releases/tag/v1.6.2"
        }))
        .expect("confirmed apply should return manual instructions");

        assert_eq!(response["status"], "manual_update_required");
        assert_eq!(response["applyAvailable"], false);
        assert_eq!(response["releaseTag"], "v1.6.2");
    }

    #[test]
    fn apply_update_uses_safe_release_url_fallback_for_untrusted_urls() {
        let response = apply_update(json!({
            "confirm": true,
            "releaseUrl": "https://example.com/not-marinara"
        }))
        .expect("confirmed apply should return manual instructions");

        assert_eq!(
            response["releaseUrl"],
            "https://github.com/Pasta-Devs/Marinara-Engine/releases/latest"
        );
    }

    #[test]
    fn apply_update_rejects_prefix_spoofed_release_urls() {
        let response = apply_update(json!({
            "confirm": true,
            "releaseUrl": "https://github.com/Pasta-Devs/Marinara-Engine.evil.example/releases/tag/v9.9.9"
        }))
        .expect("confirmed apply should return manual instructions");

        assert_eq!(response["releaseUrl"], GITHUB_RELEASES_URL);
    }
}

use marinara_core::{AppError, AppResult};
use regex::{Captures, Regex};
use serde_json::Value;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use std::path::{Component, Path, PathBuf};
use std::sync::OnceLock;
use url::Url;

const REDACTED: &str = "[REDACTED]";
const REDACTED_URL: &str = "[REDACTED_URL]";

pub fn validate_collection_name(name: &str) -> AppResult<()> {
    let valid = !name.is_empty()
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.');
    if valid {
        Ok(())
    } else {
        Err(AppError::invalid_input(format!(
            "Invalid collection name: {name}"
        )))
    }
}

pub fn assert_relative_safe_path(path: &str) -> AppResult<PathBuf> {
    let candidate = Path::new(path);
    if candidate.is_absolute() {
        return Err(AppError::invalid_input(
            "Absolute paths are not allowed here",
        ));
    }

    for component in candidate.components() {
        if matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        ) {
            return Err(AppError::invalid_input("Path escapes are not allowed here"));
        }
    }

    Ok(candidate.to_path_buf())
}

pub fn assert_inside_dir(base: &Path, path: &Path) -> AppResult<PathBuf> {
    let joined = if path.is_absolute() {
        path.to_path_buf()
    } else {
        base.join(path)
    };
    let canonical_base = base.canonicalize().map_err(AppError::from)?;
    let canonical_path = canonicalize_existing_prefix(&joined)?;
    if canonical_path.starts_with(&canonical_base) {
        Ok(canonical_path)
    } else {
        Err(AppError::invalid_input(
            "Path is outside the allowed directory",
        ))
    }
}

fn canonicalize_existing_prefix(path: &Path) -> AppResult<PathBuf> {
    let mut missing = Vec::new();
    let mut current = path;
    while !current.exists() {
        let Some(parent) = current.parent() else {
            return Err(AppError::invalid_input("Path has no existing parent"));
        };
        if let Some(name) = current.file_name() {
            missing.push(name.to_os_string());
        }
        current = parent;
    }

    let mut canonical = current.canonicalize().map_err(AppError::from)?;
    for component in missing.iter().rev() {
        canonical.push(component);
    }
    Ok(canonical)
}

pub fn is_allowed_outbound_url(raw: &str, allow_local: bool) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    if allow_local {
        return true;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    !is_local_or_reserved_host(host)
}

pub fn is_allowed_provider_url(raw: &str, allow_private_or_reserved: bool) -> bool {
    let Ok(url) = Url::parse(raw) else {
        return false;
    };
    if !matches!(url.scheme(), "http" | "https") {
        return false;
    }
    if allow_private_or_reserved {
        return true;
    }
    let Some(host) = url.host_str() else {
        return false;
    };
    !is_private_or_reserved_provider_host(host)
}

fn is_private_or_reserved_provider_host(host: &str) -> bool {
    let normalized = normalize_host(host);
    if normalized.is_empty()
        || normalized.ends_with(".local")
        || normalized.ends_with(".internal")
        || normalized.ends_with(".onion")
    {
        return true;
    }
    if is_loopback_host(&normalized) {
        return false;
    }
    normalized
        .parse::<IpAddr>()
        .is_ok_and(is_local_or_reserved_ip)
}

fn is_local_or_reserved_host(host: &str) -> bool {
    let normalized = normalize_host(host);
    if normalized.is_empty()
        || is_loopback_host(&normalized)
        || normalized.ends_with(".localhost")
        || normalized.ends_with(".local")
        || normalized.ends_with(".internal")
        || normalized.ends_with(".onion")
    {
        return true;
    }
    normalized
        .parse::<IpAddr>()
        .is_ok_and(is_local_or_reserved_ip)
}

fn normalize_host(host: &str) -> String {
    host.trim()
        .trim_matches(['[', ']'])
        .trim_end_matches('.')
        .to_ascii_lowercase()
}

pub fn is_loopback_provider_host(host: &str) -> bool {
    let normalized = normalize_host(host);
    is_loopback_host(&normalized)
}

fn is_loopback_host(normalized: &str) -> bool {
    matches!(
        normalized,
        "localhost" | "localhost.localdomain" | "ip6-localhost" | "ip6-loopback"
    ) || normalized.ends_with(".localhost")
        || normalized
            .parse::<IpAddr>()
            .is_ok_and(is_loopback_ip)
}

fn is_loopback_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => address.is_loopback(),
        IpAddr::V6(address) => {
            address.is_loopback()
                || embedded_ipv4(address).is_some_and(|address| address.is_loopback())
        }
    }
}

pub fn is_local_or_reserved_ip(address: IpAddr) -> bool {
    match address {
        IpAddr::V4(address) => is_local_or_reserved_ipv4(address),
        IpAddr::V6(address) => is_local_or_reserved_ipv6(address),
    }
}

pub fn is_forbidden_provider_resolved_ip(
    address: IpAddr,
    allow_private_or_reserved: bool,
) -> bool {
    !allow_private_or_reserved && is_local_or_reserved_ip(address)
}

fn is_local_or_reserved_ipv4(address: Ipv4Addr) -> bool {
    let [a, b, c, _d] = address.octets();
    matches!(a, 0 | 10 | 127)
        || (a == 100 && (64..=127).contains(&b))
        || (a == 169 && b == 254)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 192 && ((b == 0 && (c == 0 || c == 2)) || b == 168))
        || (a == 198 && (b == 18 || b == 19))
        || (a == 198 && b == 51 && c == 100)
        || (a == 203 && b == 0 && c == 113)
        || (224..=255).contains(&a)
}

fn is_local_or_reserved_ipv6(address: Ipv6Addr) -> bool {
    if let Some(mapped) = embedded_ipv4(address) {
        return is_local_or_reserved_ipv4(mapped);
    }
    let segments = address.segments();
    address.is_unspecified()
        || address.is_loopback()
        || (segments[0] & 0xfe00) == 0xfc00
        || (segments[0] & 0xffc0) == 0xfe80
        || (segments[0] & 0xff00) == 0xff00
        || (segments[0] == 0x2001 && segments[1] == 0)
        || (segments[0] == 0x2001 && segments[1] == 0x0db8)
        || (segments[0] == 0x0064
            && segments[1] == 0xff9b
            && segments[2] == 0
            && segments[3] == 0
            && segments[4] == 0
            && segments[5] == 0)
}

fn embedded_ipv4(address: Ipv6Addr) -> Option<Ipv4Addr> {
    let segments = address.segments();
    if segments[..5] != [0, 0, 0, 0, 0] || !matches!(segments[5], 0 | 0xffff) {
        return None;
    }
    let [a, b] = segments[6].to_be_bytes();
    let [c, d] = segments[7].to_be_bytes();
    Some(Ipv4Addr::new(a, b, c, d))
}

fn sensitive_pair_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?ix)
            \b
            (?P<label>
                api[_\s-]?key |
                access[_\s-]?token |
                refresh[_\s-]?token |
                id[_\s-]?token |
                auth(?:orization)? |
                authorization |
                password |
                secret |
                credential |
                cookie |
                session[_\s-]?(?:id|token)
            )
            \b
            (?P<sep>\s*[:=]\s*["']?)
            (?P<value>(?:Bearer\s+)?[^"',\s}\]\)]+)
            "#,
        )
        .expect("sensitive pair regex should compile")
    })
}

fn sensitive_query_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?i)(?P<prefix>[?&](?:api[_-]?key|key|access[_-]?token|refresh[_-]?token|id[_-]?token|token|password|secret|credential|authorization)=)(?P<value>[^&#\s"'<>]+)"#,
        )
        .expect("sensitive query regex should compile")
    })
}

fn sensitive_phrase_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?ix)
            \b
            (?P<label>
                api[_\s-]?key |
                access[_\s-]?token |
                refresh[_\s-]?token |
                id[_\s-]?token |
                credential |
                secret |
                session[_\s-]?(?:id|token)
            )
            \b
            \s+
            (?P<value>[A-Za-z0-9._-]{4,})
            "#,
        )
        .expect("sensitive phrase regex should compile")
    })
}

fn bearer_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(r#"(?i)\bBearer\s+[A-Za-z0-9._~+/=-]{4,}"#).expect("bearer regex should compile")
    })
}

fn provider_key_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?ix)
            \b(?:
                sk-[A-Za-z0-9._-]{3,} |
                xai-[A-Za-z0-9._-]{3,} |
                orp_[A-Za-z0-9._-]{3,} |
                pplx-[A-Za-z0-9._-]{3,} |
                gsk_[A-Za-z0-9._-]{3,} |
                hf_[A-Za-z0-9._-]{3,} |
                gh[opsu]_[A-Za-z0-9._-]{3,} |
                AIza[A-Za-z0-9_-]{8,} |
                [A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}
            )\b
            "#,
        )
        .expect("provider key regex should compile")
    })
}

fn sensitive_url_regex() -> &'static Regex {
    static REGEX: OnceLock<Regex> = OnceLock::new();
    REGEX.get_or_init(|| {
        Regex::new(
            r#"(?i)https?://[^\s"'<>)]*(?:payment|billing|checkout|invoice|retriev)[^\s"'<>)]*"#,
        )
        .expect("sensitive URL regex should compile")
    })
}

fn is_sensitive_json_key(key: &str) -> bool {
    let normalized: String = key
        .chars()
        .filter(|character| character.is_ascii_alphanumeric())
        .flat_map(|character| character.to_lowercase())
        .collect();
    matches!(
        normalized.as_str(),
        "apikey"
            | "authorization"
            | "cookie"
            | "credential"
            | "credentials"
            | "password"
            | "secret"
            | "sessionid"
            | "sessiontoken"
            | "token"
    ) || normalized.ends_with("apikey")
        || normalized.ends_with("token")
        || normalized.ends_with("secret")
        || normalized.ends_with("password")
        || normalized.contains("credential")
}

fn looks_sensitive_fragment(value: &str) -> bool {
    let trimmed = value.trim_matches(|character: char| !character.is_ascii_alphanumeric());
    trimmed.len() >= 4
        && (trimmed.chars().any(|character| character.is_ascii_digit())
            || trimmed
                .chars()
                .any(|character| matches!(character, '-' | '_' | '.'))
            || trimmed.len() >= 16)
}

pub fn redact_sensitive_text(text: &str) -> String {
    let mut output = text.to_string();
    output = sensitive_url_regex()
        .replace_all(&output, REDACTED_URL)
        .into_owned();
    output = sensitive_query_regex()
        .replace_all(&output, |captures: &Captures| {
            format!("{}{}", &captures["prefix"], REDACTED)
        })
        .into_owned();
    output = sensitive_pair_regex()
        .replace_all(&output, |captures: &Captures| {
            format!("{}{}{}", &captures["label"], &captures["sep"], REDACTED)
        })
        .into_owned();
    output = sensitive_phrase_regex()
        .replace_all(&output, |captures: &Captures| {
            let value = &captures["value"];
            if looks_sensitive_fragment(value) {
                format!("{} {}", &captures["label"], REDACTED)
            } else {
                captures
                    .get(0)
                    .map(|matched| matched.as_str().to_string())
                    .unwrap_or_default()
            }
        })
        .into_owned();
    output = bearer_regex()
        .replace_all(&output, |_captures: &Captures| format!("Bearer {REDACTED}"))
        .into_owned();
    provider_key_regex()
        .replace_all(&output, REDACTED)
        .into_owned()
}

pub fn redact_sensitive_json(value: Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(
            map.into_iter()
                .map(|(key, value)| {
                    let next_value = if is_sensitive_json_key(&key) {
                        Value::String(REDACTED.to_string())
                    } else {
                        redact_sensitive_json(value)
                    };
                    (key, next_value)
                })
                .collect(),
        ),
        Value::Array(values) => {
            Value::Array(values.into_iter().map(redact_sensitive_json).collect())
        }
        Value::String(value) => Value::String(redact_sensitive_text(&value)),
        other => other,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn redact_sensitive_text_removes_provider_keys_and_query_values() {
        let redacted = redact_sensitive_text(
            "OpenAI rejected api_key=sk-test-secret at https://api.example.test/v1?key=AIzaSecretValue123",
        );

        assert!(redacted.contains("[REDACTED]"));
        assert!(!redacted.contains("sk-test-secret"));
        assert!(!redacted.contains("AIzaSecretValue123"));
    }

    #[test]
    fn redact_sensitive_text_keeps_non_secret_session_and_token_counts() {
        let redacted = redact_sensitive_text(
            "Invalid session. API key is invalid. usage input_tokens=12 output_tokens=3.",
        );

        assert_eq!(
            redacted,
            "Invalid session. API key is invalid. usage input_tokens=12 output_tokens=3."
        );
    }

    #[test]
    fn redact_sensitive_text_removes_unprefixed_api_key_fragments() {
        let redacted = redact_sensitive_text("Invalid API key abc123 for this request.");

        assert_eq!(redacted, "Invalid API key [REDACTED] for this request.");
    }

    #[test]
    fn redact_sensitive_text_redacts_payment_and_retrieval_urls() {
        let redacted = redact_sensitive_text(
            "See https://billing.example.test/invoice/retrieve?token=secret for details.",
        );

        assert!(redacted.contains("[REDACTED_URL]"));
        assert!(!redacted.contains("billing.example.test"));
        assert!(!redacted.contains("secret"));
    }

    #[test]
    fn redact_sensitive_text_redacts_standalone_bearer_tokens() {
        let redacted = redact_sensitive_text("rejected credential Bearer abc123DEF456._-");

        assert!(redacted.contains("Bearer [REDACTED]"));
        assert!(!redacted.contains("abc123DEF456"));
    }

    #[test]
    fn redact_sensitive_json_redacts_secret_keys_without_hiding_usage_tokens() {
        let redacted = redact_sensitive_json(json!({
            "api_key": "sk-test-secret",
            "error": { "message": "Authorization: Bearer sk-test-secret" },
            "usage": { "input_tokens": 12, "output_tokens": 3 }
        }));

        assert_eq!(redacted["api_key"], "[REDACTED]");
        assert_eq!(redacted["usage"]["input_tokens"], 12);
        assert!(!redacted.to_string().contains("sk-test-secret"));
    }

    #[test]
    fn outbound_url_policy_blocks_local_and_reserved_targets_when_local_disabled() {
        for url in [
            "http://localhost:3000/hook",
            "http://127.0.0.1:3000/hook",
            "http://10.1.2.3/hook",
            "http://172.16.0.5/hook",
            "http://192.168.1.5/hook",
            "http://169.254.169.254/latest/meta-data",
            "http://[::1]:3000/hook",
            "http://[fc00::1]/hook",
            "http://[::127.0.0.1]/hook",
            "http://[::ffff:127.0.0.1]/hook",
            "http://[::ffff:10.0.0.1]/hook",
            "http://[2001::1]/hook",
            "https://hidden-service.onion/hook",
            "https://hidden-service.onion./hook",
        ] {
            assert!(
                !is_allowed_outbound_url(url, false),
                "local-disabled policy should reject {url}"
            );
            assert!(
                is_allowed_outbound_url(url, true),
                "local-enabled policy should accept {url}"
            );
        }
    }

    #[test]
    fn outbound_url_policy_keeps_public_https_targets_allowed() {
        assert!(is_allowed_outbound_url("https://example.com/hook", false));
        assert!(is_allowed_outbound_url("http://example.com/hook", false));
        assert!(!is_allowed_outbound_url("file:///etc/passwd", true));
    }

    #[test]
    fn provider_url_policy_allows_loopback_but_blocks_private_without_opt_in() {
        for url in [
            "http://localhost:11434/api/tags",
            "http://localhost./api/tags",
            "http://127.0.0.1:11434/api/tags",
            "http://[::1]:11434/api/tags",
            "http://[::ffff:127.0.0.1]:11434/api/tags",
        ] {
            assert!(
                is_allowed_provider_url(url, false),
                "provider policy should allow loopback target {url}"
            );
        }

        for url in [
            "http://10.1.2.3/models",
            "http://172.16.0.5/models",
            "http://192.168.1.5/models",
            "http://169.254.169.254/latest/meta-data",
            "http://[fc00::1]/models",
            "http://[::ffff:10.0.0.1]/models",
            "https://hidden-service.onion/models",
        ] {
            assert!(
                !is_allowed_provider_url(url, false),
                "provider policy should reject private/reserved target {url}"
            );
            assert!(
                is_allowed_provider_url(url, true),
                "provider local opt-in should accept {url}"
            );
        }
    }

    #[test]
    fn provider_resolved_ip_policy_blocks_private_metadata_and_mapped_addresses() {
        for address in [
            "10.0.0.1",
            "169.254.169.254",
            "127.0.0.1",
            "::1",
            "fc00::1",
            "::ffff:10.0.0.1",
            "::ffff:127.0.0.1",
        ] {
            let address = address
                .parse::<IpAddr>()
                .expect("test address should parse");
            assert!(
                is_forbidden_provider_resolved_ip(address, false),
                "provider policy should reject resolved target {address}"
            );
            assert!(
                !is_forbidden_provider_resolved_ip(address, true),
                "provider local opt-in should accept resolved target {address}"
            );
        }
    }

    #[test]
    fn provider_literal_loopback_policy_covers_mapped_ipv6() {
        assert!(is_loopback_provider_host("127.0.0.1"));
        assert!(is_loopback_provider_host("[::1]"));
        assert!(is_loopback_provider_host("[::ffff:127.0.0.1]"));
        assert!(!is_loopback_provider_host("[::ffff:10.0.0.1]"));
    }
}

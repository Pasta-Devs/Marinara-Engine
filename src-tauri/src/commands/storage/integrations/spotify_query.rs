use std::collections::HashMap;

pub(super) fn parse_query(query: &str) -> HashMap<String, String> {
    query
        .split('&')
        .filter_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            Some((key.to_string(), percent_decode_component(value)))
        })
        .collect()
}

fn percent_decode_component(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;
    while index < bytes.len() {
        match bytes[index] {
            b'+' => {
                output.push(b' ');
                index += 1;
            }
            b'%' if index + 2 < bytes.len() => {
                if let (Some(high), Some(low)) =
                    (hex_nibble(bytes[index + 1]), hex_nibble(bytes[index + 2]))
                {
                    output.push((high << 4) | low);
                    index += 3;
                } else {
                    output.push(bytes[index]);
                    index += 1;
                }
            }
            byte => {
                output.push(byte);
                index += 1;
            }
        }
    }
    String::from_utf8_lossy(&output).to_string()
}

fn hex_nibble(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_query_decodes_spotify_callback_values() {
        let params = parse_query("code=hello+world&state=%E2%80%A6");

        assert_eq!(params.get("code").map(String::as_str), Some("hello world"));
        assert_eq!(params.get("state").map(String::as_str), Some("\u{2026}"));
    }

    #[test]
    fn percent_decode_component_preserves_malformed_percent_before_multibyte_char() {
        assert_eq!(percent_decode_component("%\u{2026}x"), "%\u{2026}x");
    }

    #[test]
    fn percent_decode_component_preserves_other_malformed_sequences() {
        assert_eq!(percent_decode_component("%zz%2\u{2026}%"), "%zz%2\u{2026}%");
    }
}

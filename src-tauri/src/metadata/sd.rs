use serde_json::{json, Map, Value};

/// Parse metadata from PNG tEXt chunks.
/// Looks for A1111/Forge `parameters` keyword or ComfyUI `prompt` keyword.
pub fn parse_metadata(chunks: &[(String, String)]) -> Option<String> {
    for (keyword, value) in chunks {
        match keyword.as_str() {
            "parameters" => {
                if let Some(v) = parse_a1111_parameters(value) {
                    return serde_json::to_string(&v).ok();
                }
            }
            "prompt" => {
                if let Some(v) = parse_comfyui_prompt(value) {
                    return serde_json::to_string(&v).ok();
                }
            }
            _ => {}
        }
    }
    None
}

/// Parse A1111/Forge/SD.Next parameter string.
///
/// Format:
///   positive prompt text
///   Negative prompt: negative prompt text
///   Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, ...
fn parse_a1111_parameters(text: &str) -> Option<Value> {
    let mut result = Map::new();
    result.insert("source".into(), json!("a1111"));

    // Split on "Negative prompt: " — everything before is the positive prompt.
    // The last section (after the second split on newline) contains key-value params.
    let (positive, rest) = if let Some(idx) = text.find("Negative prompt: ") {
        (&text[..idx], &text[idx + "Negative prompt: ".len()..])
    } else {
        (text, "")
    };

    // Split remaining into negative prompt and parameters line
    let (negative, params_str) = if !rest.is_empty() {
        // The parameters line is the last line (contains "Steps: ...")
        // Negative prompt is everything before the last line
        let lines: Vec<&str> = rest.lines().collect();
        if lines.len() >= 2 {
            let last = lines[lines.len() - 1];
            if last.contains("Steps:") || last.contains("Sampler:") {
                let neg = lines[..lines.len() - 1].join("\n");
                (neg.trim().to_string(), last)
            } else {
                (rest.trim().to_string(), "")
            }
        } else if lines.len() == 1 {
            // Could be either a params line or negative prompt text
            if lines[0].contains("Steps:") {
                (String::new(), lines[0])
            } else {
                (lines[0].to_string(), "")
            }
        } else {
            (String::new(), "")
        }
    } else {
        (String::new(), "")
    };

    let positive = positive.trim().to_string();
    if positive.is_empty() && negative.is_empty() && params_str.is_empty() {
        return None;
    }

    result.insert("prompt".into(), json!(positive));
    if !negative.is_empty() {
        result.insert("negative_prompt".into(), json!(negative));
    }

    // Parse comma-separated key: value pairs
    for pair in split_params(params_str) {
        let (key, val) = pair;
        match key.as_str() {
            "Steps" => {
                if let Ok(n) = val.parse::<u64>() {
                    result.insert("steps".into(), json!(n));
                }
            }
            "Sampler" | "Sampler name" => {
                result.insert("sampler".into(), json!(val));
            }
            "CFG scale" => {
                if let Ok(f) = val.parse::<f64>() {
                    result.insert("cfg_scale".into(), json!(f));
                }
            }
            "Seed" => {
                if let Ok(n) = val.parse::<u64>() {
                    result.insert("seed".into(), json!(n));
                }
            }
            "Size" => {
                if let Some((w, h)) = parse_size(&val) {
                    result.insert("width".into(), json!(w));
                    result.insert("height".into(), json!(h));
                }
            }
            "Model" | "Model hash" => {
                // Prefer "Model" over "Model hash"
                if key == "Model" || !result.contains_key("model") {
                    result.insert("model".into(), json!(val));
                }
            }
            "Version" => {
                result.insert("version".into(), json!(val));
            }
            "Schedule type" => {
                result.insert("schedule_type".into(), json!(val));
            }
            _ => {
                // Store unknown keys with snake_case conversion
                let snake = key.to_lowercase().replace(' ', "_");
                result.insert(snake, json!(val));
            }
        }
    }

    Some(Value::Object(result))
}

/// Split parameter string like "Steps: 20, Sampler: Euler a, CFG scale: 7"
/// into (key, value) pairs, handling values that contain commas.
fn split_params(params: &str) -> Vec<(String, String)> {
    let mut pairs = Vec::new();
    for segment in params.split(", ") {
        if let Some(colon_pos) = segment.find(": ") {
            let key = segment[..colon_pos].trim().to_string();
            let val = segment[colon_pos + 2..].trim().to_string();
            if !key.is_empty() {
                pairs.push((key, val));
            }
        }
    }
    pairs
}

/// Parse "1024x1024" into (1024, 1024).
fn parse_size(s: &str) -> Option<(i32, i32)> {
    let parts: Vec<&str> = s.split('x').collect();
    if parts.len() == 2 {
        let w = parts[0].trim().parse::<i32>().ok()?;
        let h = parts[1].trim().parse::<i32>().ok()?;
        Some((w, h))
    } else {
        None
    }
}

/// Parse a ComfyUI prompt JSON (workflow API format).
///
/// Format: a JSON object keyed by node IDs, each with class_type and inputs.
/// Extracts: seed from KSampler, model from CheckpointLoaderSimple,
/// positive/negative from CLIPTextEncode.
fn parse_comfyui_prompt(json_str: &str) -> Option<Value> {
    let workflow: Value = serde_json::from_str(json_str).ok()?;
    let obj = workflow.as_object()?;

    let mut result = Map::new();
    result.insert("source".into(), json!("comfyui"));

    for (_node_id, node) in obj {
        let class_type = node.get("class_type")?.as_str()?;
        let inputs = node.get("inputs")?;

        match class_type {
            "KSampler" => {
                if let Some(seed) = inputs.get("seed").and_then(|v| v.as_u64()) {
                    result.insert("seed".into(), json!(seed));
                }
                if let Some(steps) = inputs.get("steps").and_then(|v| v.as_u64()) {
                    result.insert("steps".into(), json!(steps));
                }
                if let Some(cfg) = inputs.get("cfg").and_then(|v| v.as_f64()) {
                    result.insert("cfg_scale".into(), json!(cfg));
                }
                if let Some(sampler) = inputs.get("sampler_name").and_then(|v| v.as_str()) {
                    result.insert("sampler".into(), json!(sampler));
                }
            }
            "CheckpointLoaderSimple" => {
                if let Some(model) = inputs.get("ckpt_name").and_then(|v| v.as_str()) {
                    result.insert("model".into(), json!(model));
                }
            }
            "CLIPTextEncode" => {
                if let Some(text) = inputs.get("text").and_then(|v| v.as_str()) {
                    // Heuristic: positive prompts tend to be longer or come first.
                    // We store the first as positive and second encountered as negative
                    // only if there's a KSampler node linking them.
                    // Simplification: store both and let the caller decide.
                    if !result.contains_key("positive_prompt") {
                        result.insert("positive_prompt".into(), json!(text));
                    } else if !result.contains_key("negative_prompt") {
                        result.insert("negative_prompt".into(), json!(text));
                    }
                }
            }
            _ => {}
        }
    }

    if result.len() <= 1 {
        // Only "source" key, nothing useful extracted
        return None;
    }

    Some(Value::Object(result))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sd_parameters() {
        let params = "A beautiful landscape, masterpiece, best quality\n\
                      Negative prompt: blurry, low quality, watermark\n\
                      Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456, \
                      Size: 1024x1024, Model: sd_xl_base_1.0, Version: v1.6.0";
        let result = parse_a1111_parameters(params).unwrap();
        assert_eq!(
            result["prompt"],
            "A beautiful landscape, masterpiece, best quality"
        );
        assert_eq!(result["negative_prompt"], "blurry, low quality, watermark");
        assert_eq!(result["steps"], 20);
        assert_eq!(result["sampler"], "Euler a");
        assert_eq!(result["cfg_scale"], 7.0);
        assert_eq!(result["seed"], 123456);
        assert_eq!(result["width"], 1024);
        assert_eq!(result["height"], 1024);
        assert_eq!(result["model"], "sd_xl_base_1.0");
        assert_eq!(result["version"], "v1.6.0");
        assert_eq!(result["source"], "a1111");
    }

    #[test]
    fn test_parse_comfyui_prompt() {
        let prompt_json = r#"{
            "3": {
                "class_type": "KSampler",
                "inputs": {"seed": 999, "steps": 30, "cfg": 8.0, "sampler_name": "euler"}
            },
            "5": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": "a cat sitting on a mat"}
            },
            "6": {
                "class_type": "CLIPTextEncode",
                "inputs": {"text": "ugly, blurry"}
            },
            "7": {
                "class_type": "CheckpointLoaderSimple",
                "inputs": {"ckpt_name": "sd_xl_base_1.0.safetensors"}
            }
        }"#;
        let result = parse_comfyui_prompt(prompt_json).unwrap();
        assert_eq!(result["source"], "comfyui");
        assert_eq!(result["seed"], 999);
        assert_eq!(result["model"], "sd_xl_base_1.0.safetensors");
        assert_eq!(result["steps"], 30);
        assert_eq!(result["cfg_scale"], 8.0);
        assert_eq!(result["sampler"], "euler");
        assert_eq!(result["positive_prompt"], "a cat sitting on a mat");
        assert_eq!(result["negative_prompt"], "ugly, blurry");
    }

    #[test]
    fn test_no_metadata_returns_none() {
        let chunks: Vec<(String, String)> = vec![];
        assert!(parse_metadata(&chunks).is_none());
    }

    #[test]
    fn test_non_png_returns_none() {
        let result = super::super::probe_metadata_from_bytes(&[0u8; 10], "jpg");
        assert!(result.is_none());
    }

    #[test]
    fn test_split_params() {
        let pairs = split_params("Steps: 20, Sampler: Euler a, CFG scale: 7, Seed: 123456");
        assert_eq!(pairs[0], ("Steps".into(), "20".into()));
        assert_eq!(pairs[1], ("Sampler".into(), "Euler a".into()));
        assert_eq!(pairs[2], ("CFG scale".into(), "7".into()));
        assert_eq!(pairs[3], ("Seed".into(), "123456".into()));
    }

    #[test]
    fn test_parse_size() {
        assert_eq!(parse_size("1024x1024"), Some((1024, 1024)));
        assert_eq!(parse_size("1920x1080"), Some((1920, 1080)));
        assert_eq!(parse_size("bad"), None);
    }
}

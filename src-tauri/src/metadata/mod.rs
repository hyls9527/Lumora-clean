pub mod png;
pub mod sd;

use std::path::Path;

/// Probe PNG metadata from an already-loaded byte buffer.
/// Avoids a second file read when combined with probe_dimensions.
pub fn probe_metadata_from_bytes(buf: &[u8], ext: &str) -> Option<String> {
    if ext != "png" {
        return None;
    }
    let chunks = png::read_text_chunks_from_bytes(buf)?;
    sd::parse_metadata(&chunks)
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
        let chunks = vec![("parameters".to_string(), params.to_string())];
        let result = sd::parse_metadata(&chunks).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(
            v["prompt"],
            "A beautiful landscape, masterpiece, best quality"
        );
        assert_eq!(v["negative_prompt"], "blurry, low quality, watermark");
        assert_eq!(v["steps"], 20);
        assert_eq!(v["sampler"], "Euler a");
        assert_eq!(v["cfg_scale"], 7.0);
        assert_eq!(v["seed"], 123456);
        assert_eq!(v["width"], 1024);
        assert_eq!(v["height"], 1024);
        assert_eq!(v["model"], "sd_xl_base_1.0");
        assert_eq!(v["version"], "v1.6.0");
        assert_eq!(v["source"], "a1111");
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
        let chunks = vec![("prompt".to_string(), prompt_json.to_string())];
        let result = sd::parse_metadata(&chunks).unwrap();
        let v: serde_json::Value = serde_json::from_str(&result).unwrap();
        assert_eq!(v["source"], "comfyui");
        assert_eq!(v["seed"], 999);
        assert_eq!(v["model"], "sd_xl_base_1.0.safetensors");
        assert_eq!(v["steps"], 30);
        assert_eq!(v["cfg_scale"], 8.0);
        assert_eq!(v["sampler"], "euler");
        assert_eq!(v["positive_prompt"], "a cat sitting on a mat");
        assert_eq!(v["negative_prompt"], "ugly, blurry");
    }

    #[test]
    fn test_no_metadata_returns_none() {
        // PNG with no tEXt chunks
        let chunks: Vec<(String, String)> = vec![];
        let result = sd::parse_metadata(&chunks);
        assert!(result.is_none());
    }

    #[test]
    fn test_non_png_returns_none() {
        let result = probe_metadata_from_bytes(&[0u8; 10], "jpg");
        assert!(result.is_none());
        let result = probe_metadata_from_bytes(&[0u8; 10], "webp");
        assert!(result.is_none());
    }
}

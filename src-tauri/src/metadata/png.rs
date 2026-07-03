use std::fs::File;
use std::io::Read;
use std::path::Path;

/// Maximum bytes to read from a PNG file for metadata extraction.
/// PNG tEXt chunks appear after IHDR and before IDAT, so 64KB is generous.
const MAX_READ: usize = 65_536;

/// Read all tEXt and iTXt chunks from a PNG byte buffer (already loaded).
/// Returns a Vec of (keyword, text_value) pairs.
pub fn read_text_chunks_from_bytes(buf: &[u8]) -> Option<Vec<(String, String)>> {
    if buf.len() < 8 || &buf[..8] != b"\x89PNG\r\n\x1a\n" {
        return None;
    }

    let mut chunks = Vec::new();
    let mut pos = 8; // skip signature

    while pos + 8 <= buf.len() {
        let length =
            u32::from_be_bytes([buf[pos], buf[pos + 1], buf[pos + 2], buf[pos + 3]]) as usize;
        let chunk_type = &buf[pos + 4..pos + 8];
        let data_start = pos + 8;
        let data_end = data_start + length;

        // Need at least the full chunk data + 4-byte CRC
        if data_end + 4 > buf.len() {
            break;
        }

        if chunk_type == b"tEXt" {
            if let Some((keyword, text)) = parse_text_chunk(&buf[data_start..data_end]) {
                chunks.push((keyword, text));
            }
        } else if chunk_type == b"iTXt" {
            if let Some((keyword, text)) = parse_itxt_chunk(&buf[data_start..data_end]) {
                chunks.push((keyword, text));
            }
        }

        // Stop after IDAT — metadata won't appear after image data
        if chunk_type == b"IDAT" {
            break;
        }

        pos = data_end + 4; // skip past data + CRC
    }

    if chunks.is_empty() {
        None
    } else {
        Some(chunks)
    }
}

/// Read all tEXt and iTXt chunks from a PNG file.
/// Returns a Vec of (keyword, text_value) pairs.
pub fn read_text_chunks(path: &Path) -> Option<Vec<(String, String)>> {
    let mut buf = vec![0u8; MAX_READ];
    let file = File::open(path).ok()?;
    let mut reader = std::io::BufReader::new(file);
    let n = reader.read(&mut buf).ok()?;
    buf.truncate(n);
    read_text_chunks_from_bytes(&buf)
}

/// Parse a tEXt chunk: keyword (null-terminated) + raw text (Latin-1).
fn parse_text_chunk(data: &[u8]) -> Option<(String, String)> {
    let null_pos = data.iter().position(|&b| b == 0)?;
    let keyword = String::from_utf8_lossy(&data[..null_pos]).to_string();
    let text = String::from_utf8_lossy(&data[null_pos + 1..]).to_string();
    Some((keyword, text))
}

/// Parse an iTXt chunk: keyword (null) + compression_flag + compression_method
/// + language_tag (null) + translated_keyword (null) + UTF-8 text.
fn parse_itxt_chunk(data: &[u8]) -> Option<(String, String)> {
    let null1 = data.iter().position(|&b| b == 0)?;
    let keyword = String::from_utf8_lossy(&data[..null1]).to_string();

    if null1 + 2 > data.len() {
        return None;
    }
    let compression_flag = data[null1 + 1];
    // compression_method = data[null1 + 2]; // only 0 (zlib) defined
    let rest = &data[null1 + 3..];

    // Skip language_tag (null-terminated)
    let lang_end = rest.iter().position(|&b| b == 0)?;
    let rest2 = &rest[lang_end + 1..];

    // Skip translated_keyword (null-terminated)
    let tkw_end = rest2.iter().position(|&b| b == 0)?;
    let text_bytes = &rest2[tkw_end + 1..];

    let text = if compression_flag == 1 {
        // zlib-compressed iTXt — skip; SD tools use plain tEXt
        return None;
    } else {
        String::from_utf8_lossy(text_bytes).to_string()
    };

    Some((keyword, text))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Build a minimal PNG with a tEXt chunk.
    fn build_png_with_text(keyword: &[u8], text: &[u8]) -> Vec<u8> {
        let mut png = Vec::new();
        png.extend_from_slice(b"\x89PNG\r\n\x1a\n");

        // IHDR
        let ihdr_data = {
            let mut d = Vec::new();
            d.extend_from_slice(&640u32.to_be_bytes());
            d.extend_from_slice(&480u32.to_be_bytes());
            d.extend_from_slice(&[8u8, 2, 0, 0, 0]);
            d
        };
        png.extend_from_slice(&(ihdr_data.len() as u32).to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&ihdr_data);
        let crc = crc32_chunk(b"IHDR", &ihdr_data);
        png.extend_from_slice(&crc.to_be_bytes());

        // tEXt
        let mut text_data = Vec::new();
        text_data.extend_from_slice(keyword);
        text_data.push(0);
        text_data.extend_from_slice(text);
        png.extend_from_slice(&(text_data.len() as u32).to_be_bytes());
        png.extend_from_slice(b"tEXt");
        png.extend_from_slice(&text_data);
        let crc = crc32_chunk(b"tEXt", &text_data);
        png.extend_from_slice(&crc.to_be_bytes());

        // IEND
        png.extend_from_slice(&0u32.to_be_bytes());
        png.extend_from_slice(b"IEND");
        let crc = crc32_chunk(b"IEND", &[]);
        png.extend_from_slice(&crc.to_be_bytes());

        png
    }

    fn crc32_chunk(chunk_type: &[u8], data: &[u8]) -> u32 {
        let mut input = Vec::with_capacity(chunk_type.len() + data.len());
        input.extend_from_slice(chunk_type);
        input.extend_from_slice(data);
        crc32(&input)
    }

    fn crc32(data: &[u8]) -> u32 {
        let mut crc: u32 = 0xFFFFFFFF;
        for &byte in data {
            crc ^= byte as u32;
            for _ in 0..8 {
                if crc & 1 != 0 {
                    crc = (crc >> 1) ^ 0xEDB88320;
                } else {
                    crc >>= 1;
                }
            }
        }
        crc ^ 0xFFFFFFFF
    }

    #[test]
    fn read_text_chunks_from_real_png() {
        use std::io::Write;
        let data = build_png_with_text(b"parameters", b"Steps: 20, Seed: 42");
        let dir = std::env::temp_dir().join("lumora_test_meta");
        std::fs::create_dir_all(&dir).ok();
        let path = dir.join("test_meta.png");
        let mut f = File::create(&path).unwrap();
        f.write_all(&data).unwrap();
        f.flush().unwrap();
        drop(f);

        let chunks = read_text_chunks(&path).unwrap();
        assert_eq!(chunks.len(), 1);
        assert_eq!(chunks[0].0, "parameters");
        assert_eq!(chunks[0].1, "Steps: 20, Seed: 42");

        std::fs::remove_file(&path).ok();
    }

    #[test]
    fn no_text_chunks_returns_none() {
        use std::io::Write;
        // PNG with only IHDR + IEND
        let mut png = Vec::new();
        png.extend_from_slice(b"\x89PNG\r\n\x1a\n");
        let ihdr_data = {
            let mut d = Vec::new();
            d.extend_from_slice(&640u32.to_be_bytes());
            d.extend_from_slice(&480u32.to_be_bytes());
            d.extend_from_slice(&[8u8, 2, 0, 0, 0]);
            d
        };
        png.extend_from_slice(&(ihdr_data.len() as u32).to_be_bytes());
        png.extend_from_slice(b"IHDR");
        png.extend_from_slice(&ihdr_data);
        let crc = crc32_chunk(b"IHDR", &ihdr_data);
        png.extend_from_slice(&crc.to_be_bytes());
        png.extend_from_slice(&0u32.to_be_bytes());
        png.extend_from_slice(b"IEND");
        let crc = crc32_chunk(b"IEND", &[]);
        png.extend_from_slice(&crc.to_be_bytes());

        let dir = std::env::temp_dir().join("lumora_test_meta");
        std::fs::create_dir_all(&dir).ok();
        let path = dir.join("no_text.png");
        let mut f = File::create(&path).unwrap();
        f.write_all(&png).unwrap();
        f.flush().unwrap();
        drop(f);

        assert!(read_text_chunks(&path).is_none());
        std::fs::remove_file(&path).ok();
    }
}

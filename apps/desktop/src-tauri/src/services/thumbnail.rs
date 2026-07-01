use crate::errors::BridgeError;
use std::io::Cursor;

const B64: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

fn encode_base64(data: &[u8]) -> String {
    let mut out = String::with_capacity(4 * (data.len() + 2) / 3);
    for chunk in data.chunks(3) {
        let (a, b, c) = (
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        );
        out.push(B64[(a >> 2) as usize] as char);
        out.push(B64[((a & 3) << 4 | b >> 4) as usize] as char);
        out.push(if chunk.len() > 1 { B64[((b & 0xF) << 2 | c >> 6) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { B64[(c & 0x3F) as usize] as char } else { '=' });
    }
    out
}

pub fn generate_thumbnail(path: &str, max_size: u32) -> Result<String, BridgeError> {
    let img = image::open(path)
        .map_err(|e| BridgeError::io_error(format!("Failed to open image: {e}")))?;

    let thumb = img.thumbnail(max_size, max_size);

    let mut buf = Vec::with_capacity(16_384);
    thumb
        .write_to(&mut Cursor::new(&mut buf), image::ImageFormat::Jpeg)
        .map_err(|e| BridgeError::io_error(format!("Failed to encode thumbnail: {e}")))?;

    Ok(format!("data:image/jpeg;base64,{}", encode_base64(&buf)))
}

//! Linux WebKit/GStreamer cannot read Tauri's asset scheme. Stream only explicitly
//! registered, canonical files over loopback, with unguessable per-file tokens.
use std::{collections::HashMap, fs::{self, File}, io::{self, Read, Seek, SeekFrom, Write},
    net::{TcpListener, TcpStream}, path::{Path, PathBuf}, sync::{Arc, Mutex, atomic::{AtomicBool, AtomicUsize, Ordering}},
    thread, time::Duration};

pub struct MediaServer {
    address: String,
    files: Arc<Mutex<HashMap<String, PathBuf>>>,
    stopped: Arc<AtomicBool>,
}
impl MediaServer {
    pub fn new() -> Result<Self, String> {
        let listener = TcpListener::bind("127.0.0.1:0").map_err(|e| e.to_string())?;
        listener.set_nonblocking(true).map_err(|e| e.to_string())?;
        let address = listener.local_addr().map_err(|e| e.to_string())?.to_string();
        let files = Arc::new(Mutex::new(HashMap::new()));
        let stopped = Arc::new(AtomicBool::new(false));
        let connections = Arc::new(AtomicUsize::new(0));
        let (owned_files, stop, host) = (files.clone(), stopped.clone(), address.clone());
        thread::spawn(move || {
            while !stop.load(Ordering::Relaxed) {
                match listener.accept() {
                    Ok((stream, peer)) => {
                        if !peer.ip().is_loopback() { continue; }
                        let count = connections.fetch_add(1, Ordering::Relaxed);
                        if count >= 64 { connections.fetch_sub(1, Ordering::Relaxed); continue; }
                        let (files, connections, host) = (owned_files.clone(), connections.clone(), host.clone());
                        thread::spawn(move || {
                            let _ = serve(stream, &host, &files);
                            connections.fetch_sub(1, Ordering::Relaxed);
                        });
                    }
                    Err(error) if error.kind() == io::ErrorKind::WouldBlock => thread::sleep(Duration::from_millis(20)),
                    Err(_) => break,
                }
            }
        });
        Ok(Self { address, files, stopped })
    }
    /// The IPC caller must authorize the source before registering it.
    pub fn register(&self, path: &Path) -> Result<String, String> {
        let path = path.canonicalize().map_err(|e| e.to_string())?;
        if !path.is_file() { return Err("A mídia precisa ser um arquivo.".into()); }
        let mut files = self.files.lock().map_err(|_| "Streaming temporariamente indisponível.")?;
        let token = if let Some((token, _)) = files.iter().find(|(_, entry)| **entry == path) {
            token.clone()
        } else {
            if files.len() >= 10000 { return Err("Limite de mídias abertas atingido. Reinicie o aplicativo.".into()); }
            let mut bytes = [0u8; 24];
            File::open("/dev/urandom").and_then(|mut file| file.read_exact(&mut bytes)).map_err(|e| e.to_string())?;
            let token = bytes.iter().map(|byte| format!("{byte:02x}")).collect::<String>();
            files.insert(token.clone(), path);
            token
        };
        Ok(format!("http://{}/{token}", self.address))
    }
}
impl Drop for MediaServer { fn drop(&mut self) { self.stopped.store(true, Ordering::Relaxed); } }

fn byte_range(header: Option<&str>, size: u64) -> Result<(u64, u64), ()> {
    let Some(header) = header else { return Ok((0, size)); };
    let (left, right) = header.strip_prefix("bytes=").ok_or(())?.split_once('-').ok_or(())?;
    if size == 0 || right.contains(',') { return Err(()); }
    if left.is_empty() {
        let length = right.parse::<u64>().map_err(|_| ())?;
        if length == 0 { return Err(()); }
        let start = size.saturating_sub(length);
        return Ok((start, size - start));
    }
    let start = left.parse::<u64>().map_err(|_| ())?;
    let end = if right.is_empty() { size - 1 } else { right.parse::<u64>().map_err(|_| ())?.min(size - 1) };
    if start >= size || start > end { return Err(()); }
    Ok((start, end - start + 1))
}
fn reply(stream: &mut TcpStream, code: &str, extra: &str) -> io::Result<()> {
    write!(stream, "HTTP/1.1 {code}\r\nContent-Length: 0\r\nConnection: close\r\n{extra}\r\n")
}
fn serve(mut stream: TcpStream, host: &str, files: &Mutex<HashMap<String, PathBuf>>) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(3)))?;
    stream.set_write_timeout(Some(Duration::from_secs(10)))?;
    let mut header = Vec::new();
    while header.len() < 8192 {
        let mut byte = [0];
        if stream.read(&mut byte)? == 0 { return Ok(()); }
        header.push(byte[0]);
        if header.ends_with(b"\r\n\r\n") { break; }
    }
    if !header.ends_with(b"\r\n\r\n") { return reply(&mut stream, "431 Request Header Fields Too Large", ""); }
    let header = String::from_utf8_lossy(&header);
    let mut lines = header.split("\r\n");
    let first: Vec<_> = lines.next().unwrap_or("").split_whitespace().collect();
    if first.len() != 3 || !matches!(first[0], "GET" | "HEAD") { return reply(&mut stream, "405 Method Not Allowed", "Allow: GET, HEAD\r\n"); }
    let entries: Vec<_> = lines.filter_map(|line| line.split_once(':')).collect();
    let field = |name: &str| entries.iter().find(|(key, _)| key.eq_ignore_ascii_case(name)).map(|(_, value)| value.trim());
    if std::env::var_os("OE_MEDIA_TRACE").is_some() {
        log::info!("Local media request: method={} origin={:?} range={:?} host_matches={}", first[0], field("origin"), field("range"), field("host") == Some(host));
    }
    if field("host") != Some(host) { return reply(&mut stream, "403 Forbidden", ""); }
    let origin = field("origin").unwrap_or("tauri://localhost");
    if !matches!(origin, "tauri://localhost" | "http://tauri.localhost" | "http://localhost:3000" | "http://127.0.0.1:3000") {
        return reply(&mut stream, "403 Forbidden", "");
    }
    let token = first[1].strip_prefix('/').unwrap_or("");
    let path = files.lock().ok().and_then(|files| files.get(token).cloned());
    let Some(path) = path else { return reply(&mut stream, "404 Not Found", ""); };
    if fs::canonicalize(&path).ok().as_ref() != Some(&path) { return reply(&mut stream, "404 Not Found", ""); }
    let mut file = match File::open(&path) { Ok(file) => file, Err(_) => return reply(&mut stream, "404 Not Found", "") };
    let size = file.metadata()?.len();
    let range = field("range");
    let (start, length) = match byte_range(range, size) {
        Ok(range) => range,
        Err(()) => return reply(&mut stream, "416 Range Not Satisfiable", &format!("Content-Range: bytes */{size}\r\n")),
    };
    let mime = match path.extension().and_then(|value| value.to_str()).unwrap_or("").to_ascii_lowercase().as_str() {
        "webm" => "video/webm", "mov" => "video/quicktime", "m4v" => "video/x-m4v", "avi" => "video/x-msvideo",
        "ogv" => "video/ogg", "mkv" => "video/x-matroska", _ => "video/mp4",
    };
    let status = if range.is_some() { "206 Partial Content" } else { "200 OK" };
    write!(stream, "HTTP/1.1 {status}\r\nContent-Type: {mime}\r\nContent-Length: {length}\r\nAccept-Ranges: bytes\r\nAccess-Control-Allow-Origin: {origin}\r\nVary: Origin\r\nCache-Control: no-store\r\nConnection: close\r\n")?;
    if range.is_some() { write!(stream, "Content-Range: bytes {start}-{}/{size}\r\n", start + length - 1)?; }
    stream.write_all(b"\r\n")?;
    if first[0] != "HEAD" { file.seek(SeekFrom::Start(start))?; io::copy(&mut file.take(length), &mut stream)?; }
    Ok(())
}
#[cfg(test)]
#[path="media_server_tests.rs"]
mod tests;

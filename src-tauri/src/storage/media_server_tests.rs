use super::*;
fn request(url: &str, path: Option<&str>, headers: &str) -> String {
    let (host, token) = url.strip_prefix("http://").unwrap().split_once('/').unwrap();
    let mut stream = TcpStream::connect(host).unwrap();
    write!(stream, "GET /{} HTTP/1.1\r\nHost: {host}\r\n{headers}\r\n", path.unwrap_or(token)).unwrap();
    let mut result = String::new(); stream.read_to_string(&mut result).unwrap(); result
}
#[test]
fn ranges_cover_suffix_open_end_and_invalid_requests() {
    assert_eq!(byte_range(Some("bytes=2-4"), 10), Ok((2, 3)));
    assert_eq!(byte_range(Some("bytes=6-"), 10), Ok((6, 4)));
    assert_eq!(byte_range(Some("bytes=-3"), 10), Ok((7, 3)));
    assert_eq!(byte_range(Some("bytes=0-100"), 10), Ok((0, 10)));
    for header in ["bytes=10-", "bytes=6-2", "bytes=-0", "bytes=0-2,4-6", "bytes=bad", "other=0-2"] {
        assert!(byte_range(Some(header), 10).is_err(), "{header}");
    }
    assert_eq!(byte_range(None, 0), Ok((0, 0)));
    assert!(byte_range(Some("bytes=0-"), 0).is_err());
}
#[test]
fn local_stream_requires_token_and_allowed_origin_and_supports_seeking() {
    let root = std::env::temp_dir().join(format!("oliveira-stream-{}", std::process::id()));
    fs::create_dir_all(&root).unwrap();
    let file = root.join("clip.mp4"); fs::write(&file, b"0123456789").unwrap();
    let server = MediaServer::new().unwrap();
    let url = server.register(&file).unwrap();
    assert_eq!(server.register(&file).unwrap(), url);
    let response = request(&url, None, "Range: bytes=2-4\r\nOrigin: tauri://localhost\r\n");
    assert!(response.starts_with("HTTP/1.1 206"));
    assert!(response.contains("Content-Range: bytes 2-4/10"));
    assert!(response.ends_with("\r\n\r\n234"));
    assert!(request(&url, None, "").ends_with("\r\n\r\n0123456789"));
    assert!(request(&url, None, "Range: bytes=10-\r\n").starts_with("HTTP/1.1 416"));
    assert!(request(&url, Some("../clip.mp4"), "").starts_with("HTTP/1.1 404"));
    assert!(request(&url, Some("unknown"), "").starts_with("HTTP/1.1 404"));
    assert!(request(&url, None, "Origin: https://untrusted.test\r\n").starts_with("HTTP/1.1 403"));
    fs::remove_file(&file).unwrap();
    assert!(request(&url, None, "").starts_with("HTTP/1.1 404"));
    fs::remove_dir_all(root).unwrap();
}
#[test]
fn replacing_registered_file_with_symlink_cannot_escape_authorized_path() {
    use std::os::unix::fs::symlink;
    let root = std::env::temp_dir().join(format!("oliveira-stream-link-{}", std::process::id()));
    fs::create_dir_all(&root).unwrap();
    let file = root.join("clip.mp4"); let outside = root.join("private.mp4");
    fs::write(&file, b"clip").unwrap(); fs::write(&outside, b"private").unwrap();
    let server = MediaServer::new().unwrap(); let url = server.register(&file).unwrap();
    fs::remove_file(&file).unwrap(); symlink(&outside, &file).unwrap();
    assert!(request(&url, None, "").starts_with("HTTP/1.1 404"));
    fs::remove_dir_all(root).unwrap();
}

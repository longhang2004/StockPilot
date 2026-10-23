"""Serve only the demo album on loopback, including byte ranges for video seeking."""
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re


class MediaHandler(SimpleHTTPRequestHandler):
    def send_head(self):
        self.remaining = None
        file_path = Path(self.translate_path(self.path))
        requested_range = self.headers.get("Range")
        if not requested_range or file_path.suffix != ".webm" or not file_path.is_file():
            return super().send_head()
        size = file_path.stat().st_size
        match = re.fullmatch(r"bytes=(\d+)-(\d*)", requested_range)
        if not match:
            self.send_error(416, "Unsupported byte range")
            return None
        start = int(match[1])
        end = min(int(match[2]) if match[2] else size - 1, size - 1)
        if start > end:
            self.send_error(416, "Range outside media")
            return None
        source = file_path.open("rb")
        source.seek(start)
        self.remaining = end - start + 1
        self.send_response(206)
        self.send_header("Content-Type", "video/webm")
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(self.remaining))
        self.end_headers()
        return source

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def copyfile(self, source, output):
        if self.remaining is None:
            return super().copyfile(source, output)
        while self.remaining:
            chunk = source.read(min(65536, self.remaining))
            if not chunk:
                break
            output.write(chunk)
            self.remaining -= len(chunk)


if __name__ == "__main__":
    album = Path(__file__).resolve().parent / "demo-media-20261023"
    handler = partial(MediaHandler, directory=str(album))
    print("StockPilot demo album: http://127.0.0.1:8766/", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8766), handler).serve_forever()

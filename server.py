#!/usr/bin/env python3
"""鹿友局域网报名服务：公开报名页 + 密码保护的组织者后台。"""

from __future__ import annotations

import base64
import json
import mimetypes
import os
import secrets
import threading
import uuid
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import unquote, urlparse


ROOT = Path(__file__).resolve().parent
DIST = ROOT / "site"
DATA_FILE = ROOT / "data" / "signups.json"
HOST = "0.0.0.0"
PORT = int(os.environ.get("DEER_PORT", "8787"))
ADMIN_USER = os.environ.get("DEER_ADMIN_USER", "admin")
ADMIN_PASSWORD = os.environ.get("DEER_ADMIN_PASSWORD", "change-me-before-use")
DATA_LOCK = threading.Lock()


def read_signups() -> list[dict]:
    with DATA_LOCK:
        try:
            return json.loads(DATA_FILE.read_text("utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            return []


def write_signups(rows: list[dict]) -> None:
    with DATA_LOCK:
        DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
        temp = DATA_FILE.with_suffix(".tmp")
        temp.write_text(json.dumps(rows, ensure_ascii=False, indent=2), "utf-8")
        temp.replace(DATA_FILE)


class DeerHandler(SimpleHTTPRequestHandler):
    server_version = "DeerClubLAN/1.0"

    def _json(self, status: int, payload: dict | list) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def _is_admin(self) -> bool:
        header = self.headers.get("Authorization", "")
        if not header.startswith("Basic "):
            return False
        try:
            decoded = base64.b64decode(header[6:]).decode("utf-8")
            user, password = decoded.split(":", 1)
        except (ValueError, UnicodeDecodeError):
            return False
        return secrets.compare_digest(user, ADMIN_USER) and secrets.compare_digest(password, ADMIN_PASSWORD)

    def _require_admin(self) -> bool:
        if self._is_admin():
            return True
        self.send_response(401)
        self.send_header("WWW-Authenticate", 'Basic realm="Deer Club Admin"')
        self.send_header("Content-Length", "0")
        self.end_headers()
        return False

    def _serve_file(self, requested: str) -> None:
        rel = requested.lstrip("/") or "index.html"
        candidate = (DIST / unquote(rel)).resolve()
        if DIST.resolve() not in candidate.parents and candidate != DIST.resolve():
            self.send_error(403)
            return
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.is_file():
            self.send_error(404)
            return
        body = candidate.read_bytes()
        kind = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        self.send_response(200)
        self.send_header("Content-Type", f"{kind}; charset=utf-8" if kind.startswith("text/") or kind.endswith("javascript") else kind)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path == "/api/health":
            self._json(200, {"ok": True})
            return
        if path == "/club-interactions":
            self._serve_file("app.js")
            return
        if path == "/api/signups":
            if self._require_admin():
                self._json(200, read_signups())
            return
        if path in {"/admin", "/admin/"}:
            if self._require_admin():
                self._serve_file("index.html")
            return
        self._serve_file(path)

    def do_POST(self) -> None:
        path = urlparse(self.path).path
        if path != "/api/signup":
            self.send_error(404)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            if length <= 0 or length > 32768:
                raise ValueError("invalid body size")
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
            required = ("name", "phone", "role", "work", "home")
            if any(not str(payload.get(key, "")).strip() for key in required):
                raise ValueError("missing fields")
            if payload.get("role") not in {"owner", "rider"}:
                raise ValueError("invalid role")
            interests = payload.get("interests", [])
            if not isinstance(interests, list) or len(interests) > 5:
                raise ValueError("invalid interests")
        except (ValueError, json.JSONDecodeError, UnicodeDecodeError):
            self._json(400, {"ok": False, "message": "报名资料不完整，请检查后重试"})
            return

        now = datetime.now(timezone.utc).isoformat()
        record = {
            "id": uuid.uuid4().hex,
            "createdAt": now,
            "updatedAt": now,
            "status": "待匹配",
            **{key: payload.get(key, "") for key in ("name", "phone", "role", "gender", "age", "zodiac", "work", "home", "pickup", "vehicle", "seats", "note")},
            "interests": interests,
        }
        rows = read_signups()
        existing = next((row for row in rows if str(row.get("phone")) == str(record["phone"])), None)
        if existing:
            record["id"] = existing["id"]
            record["createdAt"] = existing.get("createdAt", now)
            rows[rows.index(existing)] = record
        else:
            rows.append(record)
        write_signups(rows)
        self._json(201, {"ok": True, "id": record["id"], "status": record["status"]})

    def log_message(self, fmt: str, *args) -> None:
        print(f"[{self.log_date_time_string()}] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    print(f"鹿友报名服务：http://127.0.0.1:{PORT}")
    print(f"组织者后台：http://127.0.0.1:{PORT}/admin")
    ThreadingHTTPServer((HOST, PORT), DeerHandler).serve_forever()

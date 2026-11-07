#!/usr/bin/env python3
# t636-keepalive-probe.py — does :3000 keep serving on an idle-then-reused
# HTTP/1.1 connection? (the Chromium keep-alive stall hypothesis)
import socket, time

s = socket.create_connection(("127.0.0.1", 3000), timeout=5)
# t709 — the reader-door routes reject headerless clients; speak the door's
# language the way the guard's own doc line prescribes (Origin == Host).
req = (
    b"GET /api/activity/recent?limit=2 HTTP/1.1\r\n"
    b"Host: localhost:3000\r\n"
    b"Origin: http://localhost:3000\r\n"
    b"Connection: keep-alive\r\n\r\n"
)

s.sendall(req)
time.sleep(0.6)
first = s.recv(65536)
print("req1:", first.split(b"\r\n")[0], "| body bytes:", len(first))

print("idling 8s (past Node's default 5s keepAliveTimeout)...")
time.sleep(8)

try:
    s.sendall(req)
    s.settimeout(6)
    second = s.recv(65536)
    print("req2:", second.split(b"\r\n")[0] if second else "EMPTY (server closed silently)")
except (socket.timeout, ConnectionResetError, BrokenPipeError) as e:
    print("req2 FAILED:", type(e).__name__, e)
finally:
    s.close()

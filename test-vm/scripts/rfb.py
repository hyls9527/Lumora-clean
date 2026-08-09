import socket, struct, sys, time

HOST, PORT = "127.0.0.1", 5901

def recvn(sock, n):
    buf = b""
    while len(buf) < n:
        chunk = sock.recv(n - len(buf))
        if not chunk:
            raise EOFError("connection closed")
        buf += chunk
    return buf

def handshake(sock):
    ver = recvn(sock, 12)
    assert ver.startswith(b"RFB "), ver
    sock.sendall(b"RFB 003.003")
    stypes = recvn(sock, 1)[0]
    types = recvn(sock, stypes)
    if 1 in types:
        sock.sendall(b"\x01")  # no auth
        reason = recvn(sock, 4)
        assert reason == b"\x00\x00\x00\x00", reason
    else:
        raise RuntimeError("no auth types: %r" % types)
    # server init
    data = recvn(sock, 24)
    w, h = struct.unpack(">HH", data[:4])
    # client init: shared flag
    sock.sendall(b"\x01")
    # SetPixelFormat (true colour 32bpp) + SetEncodings (raw)
    fmt = struct.pack(">BBBBHHHBBBxx", 32, 24, 0, 1, 65535, 65535, 65535, 16, 8, 0)
    sock.sendall(b"\x00" + fmt)
    sock.sendall(b"\x02" + struct.pack(">H", 1) + struct.pack(">i", 0))
    return w, h

def key(sock, keysym, down=True):
    sock.sendall(struct.pack(">BBHI", 4, 1 if down else 0, 0, keysym))

def capture(sock, w, h):
    # request full framebuffer update
    sock.sendall(b"\x03" + struct.pack(">BHHHH", 1, 0, 0, w, h))
    # read header: msg type, padding, nrects
    msg = recvn(sock, 4)
    assert msg[0] == 0, msg
    nrects = struct.unpack(">H", msg[2:4])[0]
    rows = []
    for _ in range(nrects):
        hdr = recvn(sock, 12)
        x, y, rw, rh, enc = struct.unpack(">HHHHi", hdr)
        if enc == 0:  # raw
            for _ in range(rh):
                rows.append(recvn(sock, rw * 4))
    return rows, w, h

def save_ppm(rows, w, h, path):
    with open(path, "wb") as f:
        f.write(b"P6\n%d %d\n255\n" % (w, h))
        for row in rows:
            out = bytearray()
            for i in range(0, len(row), 4):
                b, g, r = row[i], row[i+1], row[i+2]
                out += bytes((r, g, b))
            f.write(out)

if __name__ == "__main__":
    cmd = sys.argv[1]
    sock = socket.create_connection((HOST, PORT), timeout=10)
    w, h = handshake(sock)
    if cmd == "keys":
        n = int(sys.argv[2]) if len(sys.argv) > 2 else 3
        for i in range(n):
            ks = 0xff0d
            key(sock, ks, True)
            time.sleep(0.3)
            key(sock, ks, False)
            time.sleep(1.2)
        print("keys sent: %d" % n)
    elif cmd == "shot":
        time.sleep(0.5)
        rows, w, h = capture(sock, w, h)
        save_ppm(rows, w, h, sys.argv[2])
        print("saved %dx%d -> %s" % (w, h, sys.argv[2]))
    sock.close()

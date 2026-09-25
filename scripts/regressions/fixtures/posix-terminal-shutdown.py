"""Close a real controlling terminal; pipes cannot reproduce dead-TTY EIO."""
import http.client
import json
import os
from pathlib import Path
import pty
import select
import signal
import socket
import sys
import tempfile
import time


root, node, loader, mode, node_env = sys.argv[1:]
with tempfile.TemporaryDirectory(prefix="marinara-terminal-shutdown-") as temp:
    data = Path(temp)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    env = dict(os.environ, HOST="127.0.0.1", PORT=str(port), DATA_DIR=temp,
               FILE_STORAGE_DIR=str(data / "storage"), NODE_ENV=node_env,
               MARINARA_ENV_FILE=str(data / ".env"), MARINARA_LITE="true",
               LOG_LEVEL="info", LOG_DISABLE_REQUEST_LOGGING="false",
               AUTO_CREATE_DEFAULT_CONNECTION="false", AUTO_OPEN_BROWSER="false")
    child, master = pty.fork()
    if child == 0:
        os.chdir(root)
        os.execve(node, [node, "scripts/run-server.mjs", "--import", loader,
                         "packages/server/src/index.ts"], env)
    output = b""
    server_pid = None
    status = None
    busy_socket = None
    finishing_socket = None

    def pump():
        global output
        if master is not None and select.select([master], [], [], 0.025)[0]:
            try:
                output += os.read(master, 65536)
            except OSError:
                pass  # Linux returns EIO once the slave closes normally.
        else:
            time.sleep(0.025)

    try:
        deadline = time.monotonic() + 20
        while time.monotonic() < deadline:
            pump()
            for line in output.decode(errors="replace").splitlines():
                heartbeat = data / "diagnostics/session-heartbeat.json"
                if "Marinara Engine server listening" in line and heartbeat.exists():
                    server_pid = json.loads(heartbeat.read_text())["pid"]
                    break
            if server_pid:
                break
        assert server_pid, output.decode(errors="replace")
        if node_env == "development":
            assert b"\x1b[" in output, "Development must exercise the real colored pino-pretty worker"
        assert (data / "storage/.writer-lease").exists()
        if mode == "busy-hangup":
            busy_socket = socket.create_connection(("127.0.0.1", port))
            busy_socket.sendall(b"POST /api/chats HTTP/1.1\r\nHost: localhost\r\n"
                                b"Content-Type: application/json\r\nContent-Length: 10000\r\n\r\n{")
            # Finish another real request after hangup while this first one holds
            # close open. Otherwise a quiet shutdown may beat the pretty worker error.
            finishing_socket = socket.create_connection(("127.0.0.1", port))
            finishing_socket.sendall(b"POST /api/chats HTTP/1.1\r\nHost: localhost\r\n"
                                      b"Content-Type: application/json\r\nContent-Length: 2\r\n\r\n{")
        # Confirm an API save while its 750 ms disk debounce is still pending.
        connection = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
        value = "confirmed immediately before " + mode
        connection.request("PUT", "/api/app-settings/ui", json.dumps({"value": value}),
                           {"Content-Type": "application/json", "X-Marinara-CSRF": "1"})
        response = connection.getresponse()
        assert response.status == 200, response.read()
        assert json.loads(response.read())["value"] == value
        connection.close()
        shard = data / "storage/tables/app_settings/ui.json"
        assert not shard.exists() or value not in shard.read_text(), "Save already flushed; no pending-write proof"
        started = time.monotonic()
        if mode == "signal":
            os.kill(child, signal.SIGHUP)
        else:
            os.close(master)
            master = None
        while time.monotonic() - started < 12:
            waited, result = os.waitpid(child, os.WNOHANG)
            if waited:
                status = result
                break
            if finishing_socket is not None and time.monotonic() - started > 0.1:
                finishing_socket.sendall(b"}")
                finishing_socket.close()
                finishing_socket = None
            pump()
        beat_file = data / "diagnostics/session-heartbeat.json"
        beat = json.loads(beat_file.read_text()) if beat_file.exists() else {}
        saved = shard.exists() and any(row["value"] == value for row in json.loads(shard.read_text()))
        result = {"mode": mode, "nodeEnv": node_env, "elapsed": round(time.monotonic() - started, 2),
                  "exitCode": os.waitstatus_to_exitcode(status) if status is not None else None,
                  "leaseReleased": not (data / "storage/.writer-lease").exists(),
                  "saved": saved, "exitKind": beat.get("exitKind")}
        print(json.dumps(result), flush=True)
        assert result["exitCode"] == 0, "Terminal shutdown must finish before the supervisor's SIGKILL backstop"
        assert result["elapsed"] < 9, "Shutdown reached the 10-second supervisor backstop"
        assert result["leaseReleased"], "Clean shutdown must release the storage writer lease"
        assert saved, "The API-confirmed pending save was lost"
        assert beat.get("exitKind") == "clean" and beat.get("exitCode") == 0, beat
        try:
            os.kill(server_pid, 0)
        except ProcessLookupError:
            pass
        else:
            raise AssertionError("Server survived its launcher")
        # A closed PTY can discard unread output; the persisted state above proves shutdown.
    finally:
        if finishing_socket:
            finishing_socket.close()
        if busy_socket:
            busy_socket.close()
        if master is not None:
            os.close(master)
        if status is None:
            try:
                os.killpg(child, signal.SIGKILL)
            except ProcessLookupError:
                pass
            os.waitpid(child, 0)
        if server_pid:
            try:
                os.kill(server_pid, signal.SIGKILL)
            except ProcessLookupError:
                pass

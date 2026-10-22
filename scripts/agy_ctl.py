#!/usr/bin/env python3
import json, re, ssl, subprocess, sys, urllib.request

def discover_server():
    ps_out = subprocess.check_output(["ps", "aux"], text=True)
    pid, csrf = None, None
    for line in ps_out.splitlines():
        if "Resources/bin/language_server" in line and "--csrf_token" in line:
            parts = line.split()
            pid = parts[1]
            m = re.search(r"--csrf_token\s+([0-9a-fA-F-]+)", line)
            if m:
                csrf = m.group(1)
            break
    if not pid or not csrf:
        raise RuntimeError("Running Antigravity language_server not found")
    lsof_out = subprocess.check_output(["/usr/sbin/lsof", "-nP", "-iTCP", "-sTCP:LISTEN", "-a", "-p", pid], text=True)
    ports = re.findall(r"127\.0\.0\.1:(\d+)\s+\(LISTEN\)", lsof_out)
    ctx = ssl._create_unverified_context()
    for p in ports:
        url = f"https://127.0.0.1:{p}/exa.language_server_pb.LanguageServerService/GetAllCascadeTrajectories"
        req = urllib.request.Request(url, data=b"{}", headers={
            "Content-Type": "application/json",
            "Connect-Protocol-Version": "1",
            "x-codeium-csrf-token": csrf,
        }, method="POST")
        try:
            with urllib.request.urlopen(req, context=ctx, timeout=3) as resp:
                data = json.loads(resp.read().decode())
                return f"https://127.0.0.1:{p}", csrf, data
        except Exception:
            continue
    raise RuntimeError(f"Could not connect to HTTPS RPC on ports {ports}")

def rpc(base_url, csrf, method, payload):
    ctx = ssl._create_unverified_context()
    url = f"{base_url}/exa.language_server_pb.LanguageServerService/{method}"
    req = urllib.request.Request(url, data=json.dumps(payload).encode(), headers={
        "Content-Type": "application/json",
        "Connect-Protocol-Version": "1",
        "x-codeium-csrf-token": csrf,
    }, method="POST")
    with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
        return json.loads(resp.read().decode())

def get_latest_user_config(base_url, csrf, cascade_id):
    steps_resp = rpc(base_url, csrf, "GetCascadeTrajectorySteps", {"cascadeId": cascade_id, "startIndex": 0, "endIndex": 20})
    for s in reversed(steps_resp.get("steps", [])):
        if s.get("type") == "CORTEX_STEP_TYPE_USER_INPUT":
            ui = s.get("userInput", {})
            if ui.get("userConfig"):
                return ui["userConfig"]
    return {}

if __name__ == "__main__":
    base_url, csrf, all_traj = discover_server()
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    summaries = all_traj.get("trajectorySummaries", {})
    if cmd == "list":
        print(f"Connected to {base_url} (CSRF: {csrf[:8]}...)")
        for cid, info in sorted(summaries.items(), key=lambda x: x[1].get("lastModifiedTime", ""), reverse=True)[:10]:
            meta = info.get("trajectoryMetadata", {})
            role = meta.get("subagentSpec", {}).get("role") or info.get("summary") or "session"
            depth = meta.get("nestingDepth", 0)
            st = info.get("status")
            sc = info.get("stepCount")
            print(f"  {cid} | depth={depth} | {st} | steps={sc} | {role}")
    elif cmd == "send":
        target_id = sys.argv[2]
        text = sys.stdin.read() if sys.argv[3] == "-" else sys.argv[3]
        ucfg = get_latest_user_config(base_url, csrf, target_id)
        res = rpc(base_url, csrf, "SendUserCascadeMessage", {
            "cascadeId": target_id,
            "items": [{"text": text}],
            "cascadeConfig": ucfg,
        })
        print("Sent! Response:", json.dumps(res, ensure_ascii=False))
    elif cmd == "spawn":
        text = sys.argv[2]
        res = rpc(base_url, csrf, "StartCascade", {
            "initialPrompt": text,
            "items": [{"text": text}],
            "workspaceUris": ["file:///Users/sunwoo/work/deepmind"],
        })
        print("Spawned! Response:", json.dumps(res, ensure_ascii=False))

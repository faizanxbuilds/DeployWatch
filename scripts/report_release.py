"""Publish the last verified CI milestone to the public release feed."""
import base64
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

repo = os.environ["GITHUB_REPOSITORY"]
sha = os.environ["GITHUB_SHA"]
run = os.environ["GITHUB_RUN_ID"]
stage = sys.argv[1]
endpoint = f"repos/{repo}/contents/latest.json"
previous = subprocess.run(
    ["gh", "api", endpoint + "?ref=release-feed"], capture_output=True, text=True
)
record = {}
payload = {"branch": "release-feed", "message": f"Report {stage} for {sha[:7]}"}
if previous.returncode == 0:
    file = json.loads(previous.stdout)
    payload["sha"] = file["sha"]
    record = json.loads(base64.b64decode(file["content"]))
elif "404" not in previous.stderr:
    raise RuntimeError(previous.stderr)

attempt = os.environ["GITHUB_RUN_ATTEMPT"]
if (record.get("run"), record.get("attempt")) != (run, attempt):
    record = {
        "run": run, "attempt": attempt, "revision": sha,
        "message": subprocess.check_output(["git", "show", "-s", "--format=%s", sha], text=True).strip(),
        "note": Path("app/src/release-note.txt").read_text().strip(),
        "events": {},
    }
record["events"][stage] = datetime.now(timezone.utc).isoformat()
if stage == "helm":
    record["helm_revision"] = (Path(os.environ["RUNNER_TEMP"]) / "helm-revision").read_text().strip()
payload["content"] = base64.b64encode(json.dumps(record).encode()).decode()
subprocess.run(["gh", "api", "--method", "PUT", endpoint, "--input", "-"],
               input=json.dumps(payload), text=True, stdout=subprocess.DEVNULL, check=True)

"""Read CI milestones by immutable commit so a cached branch cannot lag a rollout."""
import json
import re
import threading
import time
from urllib.request import urlopen

REPOSITORY = "faizanxbuilds/DeployWatch"
lock = threading.Lock()
cached_sha = None
cached_record = None
next_check = 0.0


def latest_release():
    global cached_sha, cached_record, next_check
    with lock:
        if time.monotonic() < next_check:
            return cached_record
        refs = f"https://github.com/{REPOSITORY}.git/info/refs?service=git-upload-pack"
        with urlopen(refs, timeout=3) as response:
            match = re.search(rb"([0-9a-f]{40}) refs/heads/release-feed\n", response.read())
        if not match:
            raise ValueError("Release feed branch unavailable")
        sha = match.group(1).decode("ascii")
        if sha != cached_sha:
            url = f"https://raw.githubusercontent.com/{REPOSITORY}/{sha}/latest.json"
            with urlopen(url, timeout=4) as response:
                cached_record = json.load(response)
            cached_sha = sha
        next_check = time.monotonic() + 3
        return cached_record

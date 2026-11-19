"""Execute the checked-in sequential test list in isolated GitHub-hosted shards."""
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import signal
import subprocess
import sys
import time


ROOT = Path(__file__).resolve().parents[2]
SUITES = {
    "unit": ("scripts/guard-validation-writes.js", "unit", 179),
    "optional": ("scripts/run-browser-gates.js", "SCRIPTS", 26),
}
PROVENANCE = [
    ROOT / "docs/evidence/R68/source-manifest.json",
    ROOT / "assets/generated/r68/manifest.json",
    *sorted((ROOT / "assets/generated/r68").glob("*.png")),
]


def registry(suite):
    source, label, number = SUITES[suite]
    block = re.search(rf"const {label}\s*=\s*\[(.*?)\];", (ROOT / source).read_text(), re.S)
    entries = re.findall(r'^\s*"([^"]+)",?\s*$', block.group(1), re.M)
    if len(entries) != number or len(set(entries)) != number:
        raise ValueError(f"{source}: expected {number} distinct commands")
    return [f"node {entry}" if suite == "optional" else entry for entry in entries]


def provenance():
    return {p: (p.stat().st_mtime_ns, hashlib.sha256(p.read_bytes()).hexdigest()) for p in PROVENANCE}


def run(command, log):
    started = time.monotonic()
    with log.open("w", encoding="utf-8") as stream:
        process = subprocess.Popen(shlex.split(command), cwd=ROOT, stdout=stream,
                                   stderr=subprocess.STDOUT, start_new_session=True)
        try:
            status = process.wait(timeout=780)
        except subprocess.TimeoutExpired:
            status = 124
        finally:
            try:
                os.killpg(process.pid, signal.SIGKILL)
            except ProcessLookupError:
                pass
            process.wait()
    return status, round(time.monotonic() - started, 2)


def main():
    suite, shard, total = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    commands = registry(suite)
    out = Path(os.environ["RUNNER_TEMP"]) / "farm-r86-results"
    out.mkdir(exist_ok=True)
    baseline = provenance() if suite == "unit" else {}
    rows = []
    for index, command in enumerate(commands):
        if index % total != shard - 1:
            continue
        log = out / f"{index + 1:03}-{Path(shlex.split(command)[1]).stem}.log"
        print(f"START {index+1}/{len(commands)} {command}", flush=True)
        status, seconds = run(command, log)
        drift = [str(p.relative_to(ROOT)) for p, value in provenance().items()
                 if value != baseline[p]] if suite == "unit" else []
        row = {"index": index + 1, "command": command, "exit": status, "seconds": seconds,
               "protected_changes": drift}
        rows.append(row)
        (out / "results.json").write_text(json.dumps({"suite": suite, "shard": shard, "total": total,
            "commit": os.environ["GITHUB_SHA"], "results": rows}, indent=2), encoding="utf-8")
        if not status and not drift:
            log.unlink()
        else:
            lines = log.read_text(encoding="utf-8", errors="replace").splitlines()
            identifiers = [line for line in lines if re.search(r'(FAIL|AssertionError|Error:|TimeoutError|ENOENT|Traceback|not ok)', line, re.I)]
            print("\n".join(line[:500] for line in (identifiers[:6] or lines[-5:])), flush=True)
        print(f"{'FAIL' if status or drift else 'PASS'} {seconds}s {command}", flush=True)
    failed = sum(bool(row['exit'] or row['protected_changes']) for row in rows)
    print(f"{suite}: {len(rows) - failed}/{len(rows)} passed")
    return bool(failed)


if __name__ == "__main__":
    sys.exit(main())

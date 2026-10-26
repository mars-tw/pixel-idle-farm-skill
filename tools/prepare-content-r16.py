"""Run independent baseline checks without rewriting existing user evidence."""
from __future__ import annotations

import datetime
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/r16'
BASE = ROOT / '.audit-tmp/content-r16-baseline'
SNAPSHOT = BASE / 'workspace'
ENV = os.environ | {'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1'}


def git(*args: str) -> bytes:
    return subprocess.check_output(['git', *args], cwd=ROOT)


def paths(*args: str) -> set[str]:
    return {p for p in git(*args).decode('utf-8').split('\0') if p}


def sha(file: Path) -> str:
    return hashlib.sha256(file.read_bytes()).hexdigest()


def write(file: Path, value: dict) -> None:
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main() -> int:
    assert ROOT == Path.cwd().resolve(), 'Run from the named project root'
    assert not BASE.exists(), 'Do not replace an existing baseline run'
    OUT.mkdir(parents=True, exist_ok=True)
    BASE.mkdir(parents=True)
    dirty = paths('diff', '--name-only', '-z') | paths('diff', '--cached', '--name-only', '-z') | paths('ls-files', '--others', '--exclude-standard', '-z')
    own = {'docs/OPTIM_PLAN_CONTENT_R16.md', 'tools/prepare-content-r16.py'}
    protected = {p: sha(ROOT / p) for p in sorted(dirty - own) if (ROOT / p).is_file()}
    head = git('rev-parse', 'HEAD').decode().strip()
    report = {
        'status': 'EXECUTED', 'kind': 'baseline-only',
        'startedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'head': head, 'branch': git('branch', '--show-current').decode().strip(),
        'missingRequiredReview': not (ROOT / 'docs/content/CONTENT_REVIEW_R15_MUSE.md').is_file(),
        'protectedFiles': protected, 'commands': [],
        'note': 'No R16 gameplay, art, review-set, version bump or cleanup completion is claimed.',
    }
    receipt = OUT / 'baseline-checks.json'
    write(receipt, report)
    archive = BASE / 'head.tar'
    subprocess.run(['git', 'archive', '--format=tar', '--output=' + str(archive), head], cwd=ROOT, check=True)
    SNAPSHOT.mkdir()
    with tarfile.open(archive) as tar:
        for item in tar.getmembers():
            target = (SNAPSHOT / item.name).resolve()
            assert target.is_relative_to(SNAPSHOT.resolve()), item.name
            assert not item.issym() and not item.islnk(), item.name
        tar.extractall(SNAPSHOT, filter='data')
    for p in sorted(dirty):
        source = ROOT / p
        dest = (SNAPSHOT / p).resolve()
        assert dest.is_relative_to(SNAPSHOT.resolve())
        if source.is_file():
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(source.read_bytes())
        elif dest.is_file():
            dest.unlink()
    # Node only resolves the existing read-only dependency installation.
    subprocess.run(['cmd', '/c', 'mklink', '/J', str(SNAPSHOT / 'node_modules'), str(ROOT / 'node_modules')], cwd=ROOT, capture_output=True, check=True, creationflags=subprocess.CREATE_NO_WINDOW)
    try:
        for name, command in [
            ('npm-test', ['npm.cmd', 'test']),
            ('r79-fun-e2e', ['node', 'scripts/test-r79-fun-e2e.js']),
        ]:
            print('EXECUTED', name, flush=True)
            log = OUT / 'logs' / (name + '.log')
            log.parent.mkdir(parents=True, exist_ok=True)
            with log.open('w', encoding='utf-8') as stream:
                result = subprocess.run(command, cwd=SNAPSHOT, env=ENV, stdout=stream, stderr=subprocess.STDOUT, creationflags=subprocess.CREATE_NO_WINDOW)
            report['commands'].append({'command': command, 'exitCode': result.returncode, 'log': log.relative_to(ROOT).as_posix(), 'sha256': sha(log)})
            write(receipt, report)
            print('VERIFIED' if result.returncode == 0 else 'BLOCKED', name, flush=True)
    finally:
        report['protectedFilesUnchanged'] = all((ROOT / p).is_file() and sha(ROOT / p) == h for p, h in protected.items())
        report['endedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        report['status'] = 'VERIFIED' if len(report['commands']) == 2 and all(c['exitCode'] == 0 for c in report['commands']) and report['protectedFilesUnchanged'] else 'BLOCKED'
        write(receipt, report)
    print(report['status'], 'baseline only; missing review remains a separate blocker', flush=True)
    return 0 if report['status'] == 'VERIFIED' else 1


if __name__ == '__main__':
    sys.exit(main())

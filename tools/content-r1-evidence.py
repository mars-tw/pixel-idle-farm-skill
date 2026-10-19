"""Preserve pre-existing files while legacy test scripts refresh their evidence."""
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.audit-tmp/content-r1-baseline'
OUT = ROOT / 'docs/content/r1'

def digest(data):
    return hashlib.sha256(data).hexdigest()

def snapshot():
    if (BASE / 'files.json').exists():
        raise SystemExit('Baseline already exists; do not overwrite')
    BASE.mkdir(parents=True, exist_ok=True)
    names = subprocess.check_output(['git', 'ls-files', '-z'], cwd=ROOT).decode().split('\0')
    records = {}
    for name in names:
        if not name or not name.startswith(('docs/evidence/', 'docs/store/', 'assets/generated/r68/')):
            continue
        source = ROOT / name
        if source.is_file():
            data = source.read_bytes()
            target = BASE / 'files' / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(data)
            records[name] = digest(data)
    (BASE / 'files.json').write_text(json.dumps(records, indent=2), encoding='utf-8')
    (BASE / 'initial-status.txt').write_bytes(subprocess.check_output(['git', 'status', '--short'], cwd=ROOT))
    print('PREPARED baseline', len(records), 'files')

def restore():
    records = json.loads((BASE / 'files.json').read_text(encoding='utf-8'))
    changed = []
    for name, sha in records.items():
        source = ROOT / name
        if source.is_file() and digest(source.read_bytes()) != sha:
            archive = OUT / 'regression' / name
            archive.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(source, archive)
            source.write_bytes((BASE / 'files' / name).read_bytes())
            changed.append(name)
        assert digest(source.read_bytes()) == sha, name
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / 'historical-readback.json').write_text(json.dumps({'status': 'VERIFIED', 'preserved': len(records), 'archivedAndRestored': changed}, indent=2), encoding='utf-8')
    print('VERIFIED preserved baseline; archived changes', len(changed))

if __name__ == '__main__':
    {'snapshot': snapshot, 'restore': restore}[sys.argv[1]]()

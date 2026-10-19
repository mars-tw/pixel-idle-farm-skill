"""Preserve all pre-existing dirty files and historical generated evidence byte for byte."""
import hashlib, json, pathlib, subprocess, zipfile, sys
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / '.audit-tmp/content-r13-protection'
OUT = ROOT / 'docs/content/r13'
sha = lambda b: hashlib.sha256(b).hexdigest()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8')
if sys.argv[1] == 'snapshot':
    BASE.mkdir(parents=True, exist_ok=True)
    if (BASE/'inventory.json').exists():
        raise SystemExit('Already snapshotted; do not replace baseline')
    tracked = git('ls-files', '-z').split('\0')
    dirty = set(git('diff', '--name-only', '-z').split('\0') + git('ls-files', '--others', '--exclude-standard', '-z').split('\0'))
    paths = sorted(p for p in set(tracked)|dirty if p and (ROOT/p).is_file())
    rows = {}
    with zipfile.ZipFile(BASE/'originals.zip', 'w', zipfile.ZIP_DEFLATED, compresslevel=1) as z:
        for p in paths:
            b=(ROOT/p).read_bytes(); rows[p]={'sha256':sha(b),'protected':p in dirty}
            # Runtime modifications stay; historical outputs must return to exact original bytes.
            if p in dirty or p.startswith('docs/') or p.startswith('assets/'):
                z.writestr(p,b)
    (BASE/'inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PREPARED baseline',len(rows),'files;',sum(r['protected'] for r in rows.values()),'dirty files')
elif sys.argv[1] == 'restore':
    rows=json.loads((BASE/'inventory.json').read_text(encoding='utf-8')); OUT.mkdir(parents=True,exist_ok=True)
    changed=[]
    with zipfile.ZipFile(BASE/'originals.zip') as z:
        for p in z.namelist():
            f=ROOT/p
            if f.exists() and sha(f.read_bytes())==rows[p]['sha256']: continue
            # New R13 content has no baseline; existing art must never be overwritten.
            archive=OUT/'regression-outputs'/p; archive.parent.mkdir(parents=True,exist_ok=True)
            if f.exists(): archive.write_bytes(f.read_bytes())
            f.parent.mkdir(parents=True,exist_ok=True); f.write_bytes(z.read(p)); changed.append(p)
    verified=all((ROOT/p).is_file() and sha((ROOT/p).read_bytes())==r['sha256'] for p,r in rows.items() if r['protected'])
    (OUT/'protected-readback.json').write_text(json.dumps({'status':'VERIFIED' if verified else 'BLOCKED','protectedFiles':sum(r['protected'] for r in rows.values()),'restoredHistoricalOutputs':changed},ensure_ascii=False,indent=2),encoding='utf-8')
    assert verified
    print('VERIFIED original dirty files; restored',len(changed),'historical outputs')

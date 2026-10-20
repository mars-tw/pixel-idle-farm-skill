"""Protect pre-existing work and isolate historical test outputs for this local round."""
import hashlib, json, pathlib, subprocess, sys, zipfile
ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = ROOT / '.audit-tmp/content-r14-protection'
OUT = ROOT / 'docs/content/r14'
sha = lambda b: hashlib.sha256(b).hexdigest()
def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT).decode('utf-8').split('\0')
if sys.argv[1] == 'snapshot':
    BASE.mkdir(parents=True, exist_ok=True)
    assert not (BASE/'inventory.json').exists(), 'Baseline already exists'
    dirty = set(git('diff','--name-only','-z') + git('diff','--cached','--name-only','-z') + git('ls-files','--others','--exclude-standard','-z'))
    # This script is this round's scaffold, not pre-existing user work.
    dirty.discard('tools/protect-content-r14.py')
    paths = sorted(p for p in set(git('ls-files','-z'))|dirty if p and (ROOT/p).is_file())
    rows = {}
    with zipfile.ZipFile(BASE/'originals.zip','w',zipfile.ZIP_DEFLATED,compresslevel=1) as z:
        for p in paths:
            b=(ROOT/p).read_bytes(); rows[p]={'sha256':sha(b),'protected':p in dirty}
            if p in dirty: z.writestr(p,b)
    (BASE/'inventory.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2),encoding='utf-8')
    print('PREPARED',len(rows),'files;',sum(r['protected'] for r in rows.values()),'protected')
elif sys.argv[1] in ('restore','verify'):
    rows=json.loads((BASE/'inventory.json').read_text(encoding='utf-8')); OUT.mkdir(parents=True,exist_ok=True)
    prior=json.loads((OUT/'protected-readback.json').read_text(encoding='utf-8')) if (OUT/'protected-readback.json').exists() else {}
    restored=list(prior.get('restoredHistoricalOutputs',[]));reapplied=list(prior.get('archivedRegeneratedCleanupOutputs',[]))
    deleted={r['path'] for r in json.loads((OUT/'cleanup-result.json').read_text(encoding='utf-8'))['candidates']} if (OUT/'cleanup-result.json').exists() else set()
    if sys.argv[1]=='restore':
        with zipfile.ZipFile(BASE/'originals.zip') as z:
            for p in rows:
                if p=='docs/OPTIM_PLAN_CONTENT_R14.md': continue
                f=ROOT/p
                if p in deleted:
                    if f.exists():
                        assert f.resolve().is_relative_to(ROOT/'docs') and not rows[p]['protected']
                        archive=OUT/'regression-outputs'/p;archive.parent.mkdir(parents=True,exist_ok=True)
                        if not archive.exists():archive.write_bytes(f.read_bytes())
                        f.unlink();reapplied.append(p)
                    continue
                if not p.startswith(('docs/','assets/')) and not rows[p]['protected']: continue
                if f.exists() and sha(f.read_bytes())==rows[p]['sha256']: continue
                if f.exists():
                    archive=OUT/'regression-outputs'/p; archive.parent.mkdir(parents=True,exist_ok=True); archive.write_bytes(f.read_bytes())
                original = z.read(p) if rows[p]['protected'] else subprocess.check_output(['git','show','HEAD:'+p],cwd=ROOT)
                if sha(original)!=rows[p]['sha256'] and not rows[p]['protected']:
                    filtered=subprocess.check_output(['git','cat-file','--filters','HEAD:'+p],cwd=ROOT)
                    if sha(filtered)==rows[p]['sha256']:original=filtered
                assert sha(original)==rows[p]['sha256'], p
                f.parent.mkdir(parents=True,exist_ok=True); f.write_bytes(original); restored.append(p)
        # Historical screenshot scripts replace their review-set filenames. Put
        # their newly generated, receipt-listed media in this round's archive.
        # Initial untracked files are always in rows and are never moved here.
        produced=set()
        for receipt in (OUT/'regression-outputs').rglob('*.json'):
            try: data=json.loads(receipt.read_text(encoding='utf-8'))
            except (ValueError,UnicodeDecodeError): continue
            if not isinstance(data,dict):continue
            for key in ['frames','screenshots','reviewSet','images']:
                for item in data.get(key,[]) if isinstance(data.get(key,[]),list) else []:
                    if isinstance(item,str):produced.add(item)
                    elif isinstance(item,dict):produced.update(item.get(k) for k in ['path','source'] if isinstance(item.get(k),str))
        for p in git('ls-files','--others','--exclude-standard','-z'):
            if not p or p in rows or p not in produced or pathlib.Path(p).suffix.lower() not in {'.png','.webm','.webp','.jpg'}:continue
            if not (p.startswith('docs/evidence/') or __import__('re').match(r'docs/content/r(?:[1-9]|1[0-3])/',p)):continue
            f=(ROOT/p).resolve();archive=(OUT/'regression-outputs'/p).resolve()
            assert f.is_relative_to(ROOT/'docs') and archive.is_relative_to(OUT)
            archive.parent.mkdir(parents=True,exist_ok=True)
            if archive.exists():assert sha(archive.read_bytes())==sha(f.read_bytes()),p
            else:archive.write_bytes(f.read_bytes())
            f.unlink();reapplied.append(p)
    errors=[p for p,r in rows.items() if r['protected'] and (not (ROOT/p).is_file() or sha((ROOT/p).read_bytes())!=r['sha256'])]
    (OUT/'protected-readback.json').write_text(json.dumps({'status':'BLOCKED' if errors else 'VERIFIED','protectedFiles':sum(r['protected'] for r in rows.values()),'restoredHistoricalOutputs':sorted(set(restored)),'archivedRegeneratedCleanupOutputs':sorted(set(reapplied)),'errors':errors},ensure_ascii=False,indent=2),encoding='utf-8')
    assert not errors, errors
    print('VERIFIED protected originals;',len(restored),'test outputs restored')

"""Verify immutable R21/media/store bytes and describe only R22 allowed diffs."""
import hashlib,json,pathlib,subprocess,datetime
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r22'
b=json.loads((O/'baseline.json').read_text(encoding='utf-8'));sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
bad=[name for name,row in b['protected'].items() if not (R/name).is_file() or sha(R/name)!=row['sha256']]
allowed=dict(b['allowedBefore']);allowed.update(json.loads((O/'baseline-supplement.json').read_text(encoding='utf-8')))
if (O/'baseline-active-url-supplement.json').exists():allowed.update(json.loads((O/'baseline-active-url-supplement.json').read_text(encoding='utf-8'))['files'])
changed=[];diffs=[]
for name,row in allowed.items():
 if sha(R/name)!=row['sha256']:
  changed.append(name)
  r=subprocess.run(['git','diff','--no-index','--no-ext-diff','--',str(R/row['snapshot']),str(R/name)],capture_output=True,text=True,encoding='utf-8')
  if r.returncode not in (0,1):raise RuntimeError(r.stderr)
  diffs.append(r.stdout)
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
out=O/'checks'/stamp;out.mkdir(parents=True)
(out/'allowed.diff').write_text('\n'.join(diffs),encoding='utf-8')
report={'status':'VERIFIED' if not bad else 'BLOCKED','protectedCount':len(b['protected']),'changedProtected':bad,'changedAllowed':changed,'note':'Diffs are against the R22 before-byte snapshots, not the older git HEAD.'}
(out/'preservation.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({**report,'receipt':str(out.relative_to(R))},ensure_ascii=False))
if bad:raise SystemExit(1)

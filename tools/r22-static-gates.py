"""Bounded release hygiene: print secret paths only, never candidate values."""
import json,pathlib,re,subprocess
R=pathlib.Path(__file__).resolve().parents[1]
active=['package.json','package-lock.json','index.html','manifest.webmanifest','sw.js','src/ui.js']
old=[name for name in active if re.search(r'content-r21-20261024-1|0\.1\.44',(R/name).read_text(encoding='utf-8'))]
command=['rg','--hidden','-l','-g','!.git/**','-g','!node_modules/**','-g','!.audit-tmp/**','-g','!tmp/**','-g','!artifacts/**',r'sk-proj-[A-Za-z0-9_-]{20}|sk-[a-z0-9]{40}',str(R)]
r=subprocess.run(command,capture_output=True,text=True,encoding='utf-8',cwd=R)
assert r.returncode in (0,1),r.stderr
paths=[str(pathlib.Path(p).relative_to(R)) for p in r.stdout.splitlines()]
print(json.dumps({'status':'VERIFIED' if not paths and not old else 'BLOCKED','secretScanCommand':command,'secretCandidatePaths':paths,'activeOldVersionPaths':old},ensure_ascii=False))
if paths or old:raise SystemExit(1)

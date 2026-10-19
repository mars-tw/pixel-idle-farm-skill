"""Run the current CI and applicable supplemental gates sequentially, locally."""
import json
import os
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'docs/content/r1'
LOGS = OUT / 'logs'
LOGS.mkdir(parents=True, exist_ok=True)
env = dict(os.environ, PYTHONIOENCODING='utf-8')
commands = [
    ('npm-test', ['cmd', '/d', '/c', 'npm test']),
    ('browser-ci', ['cmd', '/d', '/c', 'npm run test:e2e']),
    ('water-guide', ['node', 'scripts/test-water-quest-guide.js']),
    ('night-gate', ['node', 'scripts/test-r72-night-gate.js']),
]
if '--resume' in sys.argv:
    commands = [
        ('npm-test-final', ['cmd', '/d', '/c', 'npm test']),
        ('content-r1-final', ['node', 'scripts/test-content-r1-e2e.js']),
        ('water-guide', ['node', 'scripts/test-water-quest-guide.js']),
        ('night-gate', ['node', 'scripts/test-r72-night-gate.js']),
    ]
results = json.loads((OUT/'final-checks.json').read_text(encoding='utf-8')) if '--resume' in sys.argv else []
for name, command in commands:
    print('EXECUTED', name, flush=True)
    started = time.monotonic()
    attempt = 1 + sum(r['name'] == name for r in results)
    logfile = name + (f'-attempt{attempt}' if attempt > 1 else '') + '.txt'
    with (LOGS / logfile).open('wb') as log:
        result = subprocess.run(command, cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    entry = {'name':name,'attempt':attempt,'command':command,'exitCode':result.returncode,'seconds':round(time.monotonic()-started,2),'log':f'docs/content/r1/logs/{logfile}'}
    results.append(entry)
    (OUT / 'final-checks.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(('VERIFIED' if not result.returncode else 'BLOCKED'), name, entry['seconds'], flush=True)
    if result.returncode:
        print((LOGS / logfile).read_text(encoding='utf-8',errors='replace')[-5000:], flush=True)
        raise SystemExit(result.returncode)

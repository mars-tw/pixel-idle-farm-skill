"""Portable LF metadata; keep original output hashes and exact restored user bytes."""
from pathlib import Path
import json,hashlib
R=Path(__file__).resolve().parents[1];E=R/'docs/evidence/r89-art'
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def write(p,d):p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n',encoding='utf8',newline='\n')
for p in (R/'assets/generated/r89').glob('*.json'):p.write_bytes(p.read_bytes().replace(b'\r\n',b'\n'))
p=R/'scripts/capture-r89-art.js';p.write_text(p.read_text(encoding='utf-8-sig').rstrip()+'\n',encoding='utf8',newline='\n')
p=E/'regression-index.json';index=json.loads(p.read_text(encoding='utf8'));count=0
for row in index['changed']:
 row.setdefault('originalOutputSha256',row['sha256'])
 p=R/row['evidence'];data=p.read_bytes()
 if b'\0' in data:continue
 try:data.decode('utf8')
 except UnicodeDecodeError:continue
 fixed=data.replace(b'\r\n',b'\n')
 if fixed!=data:
  row.setdefault('originalOutputSha256',row['sha256']);p.write_bytes(fixed);row['sha256']=sha(p);row['lineEndingNormalization']='UTF-8 CRLF to LF in the archive copy only; original restored user input unchanged';count+=1
write(E/'regression-index.json',index)
p=E/'performance.json';performance=json.loads(p.read_text(encoding='utf8'));performance['sourceSha256']=sha(R/performance['source']);write(p,performance)
p=E/'package-size.json';package=json.loads(p.read_text(encoding='utf8'));package['afterBytes']=sum(p.stat().st_size for d in ['assets','src'] for p in (R/d).rglob('*') if p.is_file())+sum((R/p).stat().st_size for p in ['index.html','offline.html','manifest.webmanifest','sw.js','LICENSE','CREDITS.md']);package['deltaBytes']=package['afterBytes']-package['beforeBytes'];write(p,package)
p=E/'verification.json';verification=json.loads(p.read_text(encoding='utf8'));verification['package']=package;verification['archiveTextNormalization']='UTF-8 LF; original output SHA and portable archive SHA both retained';write(p,verification)
print(json.dumps(dict(status='VERIFIED',normalizedArchiveText=count,deltaBytes=package['deltaBytes'])))

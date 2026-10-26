"""Read back one final full-run group, exact exits, native PNGs and protected bytes."""
import argparse,datetime,hashlib,json,pathlib,re,struct
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1];pa=argparse.ArgumentParser()
for flag in ['owned-root','run-id','unit-receipt','browser-receipt']:pa.add_argument('--'+flag,required=True)
a=pa.parse_args();D=pathlib.Path(a.owned_root);run=D/'docs/content/r22/runs'/a.run_id
assert run.is_dir() and run.resolve().is_relative_to((D/'docs/content/r22/runs').resolve())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest();commands=[]
for kind,p in [('unit',pathlib.Path(a.unit_receipt)),('browser',pathlib.Path(a.browser_receipt))]:
 j=json.loads(p.read_text(encoding='utf-8'));assert j['status']=='VERIFIED' and j['exitCode']==0,(kind,'not an actual full-command exit zero');assert pathlib.Path(j['cwd'])==D
 assert sha(p.parent/'stdout.log')==j['stdoutSha256'] and sha(p.parent/'stderr.log')==j['stderrSha256']
 for name,h in j['sourceHashes'].items():assert sha(R/name)==h and sha(D/name)==h,(kind,name,'source drift')
 if kind=='browser':assert a.run_id in (p.parent/'stdout.log').read_text(encoding='utf-8');browser_command=j
 commands.append({'kind':kind,'path':str(p),'sha256':sha(p),'exitCode':j['exitCode'],'stdoutSha256':j['stdoutSha256'],'stderrSha256':j['stderrSha256']})
required={f'delivery-{v}' for v in ['320x568','390x844','430x932','844x390','1366x600']}
required|={f'{mode}-{v}' for mode in ['serving','serving-correct'] for v in ['320x568','430x932','844x390','1366x600']};required.add('fishing-430x932')
seen=set();rows=[]
for p in run.glob('**/journey-*.json'):
 if p.name.startswith('journey-attempt-'):continue
 j=json.loads(p.read_text(encoding='utf-8'));assert j['status']=='VERIFIED' and not j['errors'],p
 for name,h in j['sourceHashes'].items():assert sha(R/name)==h and sha(D/name)==h,(p,name,'journey source drift')
 seen.add(p.parent.name);frames=[];native_count=0;alias_count=0
 for frame in j['frames']:
  f=D/frame['file'];assert sha(f)==frame['sha256'],f
  data=f.read_bytes();assert data[:8]==b'\x89PNG\r\n\x1a\n';size=list(struct.unpack('>II',data[16:24]));expected=re.match(r'^(\d+)x(\d+)-',f.name);assert expected and size==list(map(int,expected.groups())),(f,size)
  if frame.get('nativeCapture') is False:
   assert frame.get('byte_identical') is True and frame.get('alias_of') and sha(D/frame['alias_of'])==frame['sha256'];alias_count+=1
  else:assert frame.get('nativeCapture') is True;native_count+=1
  frames.append({'path':str(f),'sha256':frame['sha256'],'size':size,'nativeCapture':frame['nativeCapture'],'alias_of':frame.get('alias_of')})
 assert j['nativeCaptureCount']==native_count and j['byteCopyAliasCount']==alias_count
 states={f.name:sha(f) for f in p.parent.glob('*-save.json')}
 roi_audits=j.get('waterRoiAudits')
 if p.parent.name=='fishing-430x932':
  assert roi_audits['status']=='VERIFIED' and len(roi_audits['records'])==3
  for proof in roi_audits['records']:
   assert proof['status']=='VERIFIED' and proof['sourcePngsUnchanged'] and not proof['pngsResizedOrWritten']
   decoded=[]
   for source,expected_roi in zip(proof['sources'],proof['decodedRgbaSha256']):
    file=pathlib.Path(source['path']);assert file.resolve().is_relative_to(D.resolve()) and sha(file)==source['pngSha256']
    assert any(str(D/f['file'])==str(file) and f['sha256']==source['pngSha256'] for f in j['frames'])
    with Image.open(file) as im:assert list(im.size)==proof['nativeViewportPixels'];pixels=im.convert('RGBA').crop(tuple(proof['stableRoiNativePixels'])).tobytes()
    assert hashlib.sha256(pixels).hexdigest()==expected_roi;decoded.append(pixels)
   assert decoded[0]!=decoded[1]
   assert sum(decoded[0][i:i+4]!=decoded[1][i:i+4] for i in range(0,len(decoded[0]),4))==proof['changedRgbaPixels']
 rows.append({'report':str(p),'sha256':sha(p),'checks':len(j['checks']),'errors':j['errors'],'frames':frames,'nativeCaptureCount':native_count,'byteCopyAliasCount':alias_count,'stateHashes':states,'invitationResourceAudit':j.get('invitationResourceAudit'),'noSharedAudit':j.get('noSharedAudit'),'waterRoiAudits':roi_audits})
assert seen==required,{'missing':sorted(required-seen),'unexpected':sorted(seen-required)}
renderers=[]
for p in pathlib.Path(browser_command['rendererDir']).glob('*.json'):
 j=json.loads(p.read_text(encoding='utf-8'));assert j['status']=='VERIFIED' and 'SwiftShader' in j['webgl']['renderer'] and 'SwiftShader' in j['gpu']['auxAttributes']['glRenderer'],p
 renderers.append({'path':str(p),'sha256':sha(p),'renderer':j['webgl']['renderer']})
assert renderers,'No actual current-full renderer receipt'
b=json.loads((R/'docs/content/r22/baseline.json').read_text(encoding='utf-8'))
for name,v in b['protected'].items():assert sha(R/name)==v['sha256'],('protected original changed',name)
for name,v in b['protected'].items():
 if name.startswith('assets/'):assert sha(D/name)==v['sha256'],('isolated screenshot asset changed',name)
assert (R/b['allowedBefore']['src/ui.js']['snapshot']).read_bytes().replace(b'content-r21-20261024-1',b'content-r22-20261024-1')==(R/'src/ui.js').read_bytes(),'UI changed beyond authorized fallback'
assert sha(R/'src/content-r17.css')==b['allowedBefore']['src/content-r17.css']['sha256']
# The resident-pose fix is a later, explicitly approved runtime delta. Bind its
# exact CAS authority and three runtime hashes instead of treating it as a URL edit.
resident_authority=R/'docs/content/r22/resident-pose-target-apply/2026-10-24T15-13-46-000Z/freeze.json'
assert sha(resident_authority)=='efa2df68791d97ddb19ff0a866f43c63fa2c7c9db377d1604be0e71bb4ae6bc1'
resident=json.loads(resident_authority.read_text(encoding='utf-8'))
resident_approval=D/'docs/content/r22/resident-pose-implementation/2026-10-24T14-49-36-956Z/supervisor-cas-target-approval.json'
assert sha(resident_approval)==resident['approvalSha256']=='e565f22f20568ec6e038d37f7a4154a04d9dd3f82993e1666ab7cfd3cd3d31ca'
resident_paths=['src/world-ui.js','src/content-r6.js','src/content-r8.js']
for name in resident_paths:
 assert sha(R/name)==sha(D/name)==resident['sourceHashes'][name],name+' differs from approved resident-pose CAS'
for name,v in json.loads((R/'docs/content/r22/baseline-active-url-supplement.json').read_text(encoding='utf-8'))['files'].items():
 if name=='src/world-ui.js':
  assert sha(R/name)==resident['sourceHashes'][name],'world UI differs from exact approved resident-pose source'
 else:assert (R/v['snapshot']).read_bytes().replace(b'content-r21-20261024-1',b'content-r22-20261024-1')==(R/name).read_bytes(),name+' changed beyond active URL literal'
reference=json.loads((R/'docs/content/r21/journey-serving-430x932.json').read_text(encoding='utf-8'))['sourceHashes']
for name in ['src/adventure.js','src/game.js','src/state.js','src/config.js']:assert sha(R/name)==reference[name],name+' mechanics changed'
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');out=R/'docs/content/r22'/('evidence-readback-'+stamp+'.json')
report={'status':'VERIFIED','selectedFinalFullRun':a.run_id,'commands':commands,'verifiedJourneyCount':len(rows),'verifiedPngCount':sum(len(x['frames']) for x in rows),'nativeCaptureCount':sum(x['nativeCaptureCount'] for x in rows),'byteCopyAliasCount':sum(x['byteCopyAliasCount'] for x in rows),'rendererReceiptCount':len(renderers),'protectedCount':len(b['protected']),'journeys':rows,'renderers':renderers,'limits':['Only this final full-run group is counted. Earlier targeted or stopped/failed groups are historical and excluded.','Mid byte-copy aliases are verified files, not extra native captures or independent movement evidence.','Canvas pre-RGBA hashes identify pixels read before captureNative; they are not extracted from the PNG.','Visual acceptance and independent score are not inferred from byte/hash checks.','SwiftShader rAF regression is not a clean physical-device performance release gate.']}
out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ('commands','journeys','renderers','limits')},ensure_ascii=False));print(str(out.relative_to(R)))

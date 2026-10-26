"""Copy seventeen current-source, native PNGs; visual acceptance stays with root."""
import argparse,datetime,hashlib,json,pathlib,shutil,struct
R=pathlib.Path(__file__).resolve().parents[1];parser=argparse.ArgumentParser();parser.add_argument('--owned-root',required=True);parser.add_argument('--run-id',required=True);args=parser.parse_args();owned=pathlib.Path(args.owned_root)
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
candidates={}
for base in [owned]:
 for p in (base/'docs/content/r22/runs'/args.run_id).glob('**/journey-*.json'):
  j=json.loads(p.read_text(encoding='utf-8'))
  if j.get('status')!='VERIFIED':continue
  if any(not (R/name).is_file() or sha(R/name)!=expected for name,expected in j['sourceHashes'].items()):continue
  for frame in j['frames']:
   if frame.get('nativeCapture') is False:continue
   key=pathlib.Path(frame['file']).name
   if key not in candidates or p.stat().st_mtime>candidates[key][0]:candidates[key]=(p.stat().st_mtime,base,p,j,frame)
selected=[
 ('basket','320x568-phone-basket-merchant-far.png','蘿拉遠處：路線與可取消入口'),
 ('basket','320x568-phone-basket-merchant-near.png','蘿拉接近：交籃文字避開場景物件'),
 ('basket','320x568-phone-basket-merchant-received.png','蘿拉接收：單餐籃與箭頭退場'),
 ('basket','390x844-phone-basket-elder-far.png','班伯遠處：保留 R21 的 390×844 視口'),
 ('basket','390x844-phone-basket-elder-near.png','班伯接近：與 R21 壓桌反例對照'),
 ('basket','390x844-phone-basket-elder-received.png','班伯接收：單餐籃與食材用量'),
 ('basket','430x932-phone-basket-child-far.png','圖圖遠處：路線提示'),
 ('basket','430x932-phone-basket-child-near.png','圖圖接近：站位提示與場景桌椅'),
 ('basket','430x932-phone-basket-child-received.png','圖圖接收：箭頭退場'),
 ('basket','844x390-phone-basket-child-reach.png','矮橫式圖圖伸手：完整頭腳與交接'),
 ('basket','844x390-phone-basket-child-received.png','矮橫式圖圖接收：完整頭腳與單籃'),
 ('basket','1366x600-phone-basket-elder-near.png','矮筆電班伯接近：提示避障'),
 ('memory','430x932-phone-memory-child-received.png','聚餐圖圖接盤：文案只描述實際接收'),
 ('memory','430x932-phone-journal-first.png','手記：當餐補備歷史與實際剩餘份數'),
 ('memory','430x932-phone-journal-invite-child-reloaded.png','重載後手記：實際已邀圖圖狀態'),
 ('memory','320x568-phone-journal-no-shared-reloaded.png','三位都選對：320重載後沒有共享盤，也沒有邀請入口'),
 ('memory','844x390-phone-journal-no-shared-reloaded.png','三位都選對：844矮橫式重載後沒有共享盤，也沒有邀請入口'),
]
assert len(selected)==17
missing=[name for _,name,_ in selected if name not in candidates]
if missing:raise SystemExit('Missing current-source successful evidence: '+repr(missing))
stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ');out=R/'docs/content/r22/review-set'/stamp;out.mkdir(parents=True)
rows=[]
for i,(category,name,note) in enumerate(selected,1):
 _,base,report,j,frame=candidates[name];assert frame.get('nativeCapture') is True;source=base/frame['file'];assert sha(source)==frame['sha256']
 b=source.read_bytes();assert b[:8]==b'\x89PNG\r\n\x1a\n';size=list(struct.unpack('>II',b[16:24]));dest=out/(f'{i:02}-'+name);shutil.copyfile(source,dest);assert sha(dest)==sha(source)
 rows.append({'category':category,'path':dest.relative_to(R).as_posix(),'source':str(source),'sourceReport':str(report),'sourceReportSha256':sha(report),'sha256':sha(dest),'size':size,'selectionNote':note,'visualReview':'not_checked'})
assert len({r['sha256'] for r in rows})==17,'Selected originals must be 17 distinct native PNGs, never the mid byte-copy aliases'
(out/'review-manifest.json').write_text(json.dumps({'status':'VERIFIED','sourceRunGroup':args.run_id,'meaning':'Byte-copy, original PNG dimensions, frame receipt hashes, and current runtime/test source binding verified. Only the explicit final full-run group is used. Visual review is pending root; no independent score.','records':rows},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'VERIFIED','selected':len(rows),'manifest':str((out/'review-manifest.json').relative_to(R))},ensure_ascii=False))

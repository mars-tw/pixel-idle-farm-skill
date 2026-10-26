"""Summarize every recorded rAF sample without discarding a slow run."""
import pathlib,json,hashlib,math
R=pathlib.Path(__file__).resolve().parents[1];O=R/'docs/content/r11';p=O/'performance-reference.json';j=json.loads(p.read_text(encoding='utf-8'));summary={};outliers=[]
for v,old in j['summary'].items():
 samples=[s for s in j['samples'] if s['viewport']==v];xs=sorted(x for s in samples for x in s['rawRafMs'][5:]);pooled=round(xs[math.ceil(len(xs)*.95)-1],2)
 summary[v]=dict(runsP95Ms=old['runsP95Ms'],medianP95Ms=old['medianP95Ms'],pooledP95Ms=pooled,allMeasuredFramesAfterPerRunWarmup=len(xs),framesOver18Ms=sum(x>18 for x in xs))
 outliers.extend(dict(viewport=v,run=s['run'],p95Ms=s['p95Ms']) for s in samples if s['p95Ms']>18)
status='VERIFIED' if all(s['pooledP95Ms']<=18 and s['medianP95Ms']<=18 for s in summary.values()) else 'BLOCKED'
(O/'performance-summary.json').write_text(json.dumps(dict(status=status,trust='Shared concurrent host, reference only. All three runs retained, first five frames of each run excluded as in measurement script; slow run not deleted.',source='docs/content/r11/performance-reference.json',sourceSha256=hashlib.sha256(p.read_bytes()).hexdigest(),summary=summary,individualRunsOver18Ms=outliers),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(status,json.dumps(summary), 'individual outliers',json.dumps(outliers));assert status=='VERIFIED'

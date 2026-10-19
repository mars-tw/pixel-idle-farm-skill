"""Deterministic native-pixel evidence; no image modification."""
import colorsys,json,pathlib
from PIL import Image,ImageChops
R=pathlib.Path(__file__).resolve().parents[1];O=R/'assets/generated/content-r9';rows=[]
manifest=json.loads((O/'manifest.json').read_text(encoding='utf-8'))
palette={tuple(int(c[i:i+2],16) for i in (1,3,5)) for c in manifest['palette']}
colors=[]
for a in manifest['assets']:
 im=Image.open(R/a['path']).convert('RGBA');pixels=[(r,g,b) for r,g,b,v in im.getdata() if v]
 assert all(p in palette for p in pixels)
 xs=[colorsys.rgb_to_hsv(r/255,g/255,b/255) for r,g,b in pixels]
 v=sum(x[2] for x in xs)/len(xs);s=sum(x[1] for x in xs)/len(xs)
 dark=sum(x[2]<.15 for x in xs)/len(xs);low=sum(x[1]<.15 for x in xs)/len(xs)
 assert .30<=v<=.75 and s>=.32 and dark<.35 and low<.20
 colors.append(dict(path=a['path'],brightness=v,saturation=s,nearBlack=dark,lowSaturation=low))
for id in ['merchant','elder','child','player']:
 ims=[Image.open(O/f'{p}-{id}.png').convert('RGBA') for p in ['idle','reach','hold']]
 bounds=[im.getbbox() for im in ims]
 assert max(b[3]-b[1] for b in bounds)-min(b[3]-b[1] for b in bounds)<=2
 for im in ims[1:]:
  assert im.crop((0,0,48,28)).tobytes()==ims[0].crop((0,0,48,28)).tobytes()
  assert im.crop((0,46,48,64)).tobytes()==ims[0].crop((0,46,48,64)).tobytes()
 assert len({im.tobytes() for im in ims})==3
 sits=[Image.open(O/f'{p}-{id}.png').convert('RGBA') for p in ['sit','sip','offer']]
 diffs=[]
 for im in sits[1:]:
  assert im.crop((0,46,48,64)).tobytes()==sits[0].crop((0,46,48,64)).tobytes()
  d=ImageChops.difference(im,sits[0]).convert('RGB').getbbox();assert d and d[2]-d[0]>=14
  diffs.append(d)
 rows.append(dict(id=id,standingAlphaBounds=bounds,headAndFeetIdentical=True,seatedFeetIdentical=True,upperBodyChangeBounds=diffs,minimumHalfHeadWidth=14))
out=R/'docs/content/r9';out.mkdir(parents=True,exist_ok=True)
(out/'native-pixel-checks.json').write_text(json.dumps(dict(status='VERIFIED',actors=rows),indent=2)+'\n',encoding='utf-8')
(out/'character-palette-checks.json').write_text(json.dumps(dict(status='VERIFIED',thresholds=dict(brightness=[.30,.75],saturationMin=.32,nearBlackMax=.35,lowSaturationMax=.20),metrics=colors),indent=2)+'\n',encoding='utf-8')
print('VERIFIED four fixed heads/feet; distinct hand poses, seated lower bodies byte-identical')

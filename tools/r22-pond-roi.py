"""Readonly decoded native-PNG pond ROI comparison; never resize/save a PNG."""
import hashlib,json,math,pathlib,sys
from PIL import Image
R=pathlib.Path(__file__).resolve().parents[1]
sha=lambda b:hashlib.sha256(b).hexdigest()
request=json.load(sys.stdin);results=[]
for pair in request['pairs']:
 frames=[pair['first'],pair['second']];images=[];before=[];contracts=[]
 for frame in frames:
  p=(R/frame['file']).resolve();assert p.is_relative_to(R.resolve()) and p.is_file()
  data=p.read_bytes();assert sha(data)==frame['sha256'];before.append((p,sha(data)))
  capture=frame['capture'];dpr=capture['dpr_at_request'];view=capture['viewport_at_request'];rect=capture['pond_rect_at_request'];expected=(round(view['width']*dpr),round(view['height']*dpr))
  with Image.open(p) as im:
   assert im.format=='PNG' and im.size==expected,(p,im.size,expected)
   images.append(im.convert('RGBA'))
  contracts.append((dpr,expected,tuple(round(rect[k]*dpr,6) for k in ['left','top','right','bottom'])))
 assert contracts[0]==contracts[1],('pond/dpr/native viewport changed between compared PNGs',pair['id'],contracts)
 dpr,expected,_=contracts[0];r=frames[0]['capture']['pond_rect_at_request']
 # The same native-pixel band for both originals. It excludes the fisher at the
 # lower left and all prose/buttons. It includes the rendered water/bobber/line;
 # independent pre-canvas hashes separately establish that water itself changed.
 roi=(math.ceil((r['left']+.30*r['width'])*dpr),math.ceil((r['top']+.04*r['height'])*dpr),math.floor((r['left']+.95*r['width'])*dpr),math.floor((r['top']+.65*r['height'])*dpr))
 assert 0<=roi[0]<roi[2]<=expected[0] and 0<=roi[1]<roi[3]<=expected[1]
 decoded=[im.crop(roi).tobytes() for im in images] # memory-only analysis; no PNG written
 hashes=list(map(sha,decoded));assert hashes[0]!=hashes[1],('decoded pond ROI is identical',pair['id'])
 changed=sum(decoded[0][i:i+4]!=decoded[1][i:i+4] for i in range(0,len(decoded[0]),4));assert changed>0
 for p,h in before:assert sha(p.read_bytes())==h,'Readonly analysis unexpectedly changed PNG bytes'
 results.append({'id':pair['id'],'status':'VERIFIED','nativeViewportPixels':list(expected),'dpr':dpr,'pondRectCss':r,'stableRoiNativePixels':list(roi),'roiPolicy':'Same upper-right water band of actual pond rect: x30%-95%, y4%-65%; excludes fisher/UI/borders; rendered bobber/line may also be present. Water-only change is separately supported by actual pre-canvas RGBA hashes.','decodedRgbaSha256':hashes,'changedRgbaPixels':changed,'roiRgbaPixelCount':len(decoded[0])//4,'sources':[{'path':str(p),'pngSha256':h} for p,h in before],'sourcePngsUnchanged':True,'pngsResizedOrWritten':False})
print(json.dumps({'status':'VERIFIED','method':'Existing Pillow, readonly native PNG decode and in-memory stable ROI byte comparison; no resizing or output PNG','records':results},ensure_ascii=True))

"""Pose registration, alpha, palette and hollow ring invariants, not a visual review score."""
from PIL import Image
import pathlib,json
R=pathlib.Path(__file__).resolve().parents[1];O=R/'assets/generated/content-r15'
ims=[Image.open(O/n).convert('RGBA') for n in ['hold-player.png','reach-player.png','idle-player.png']]
assert all(im.size==(72,96) for im in ims)
assert all(im.crop((0,74,72,96)).tobytes()==ims[0].crop((0,74,72,96)).tobytes() for im in ims)
assert len({im.crop((0,0,72,74)).tobytes() for im in ims})==3
palette=set(Image.open(R/'assets/generated/r89/walk.png').convert('RGBA').getdata())
for im in ims:
    assert set(im.getdata()).issubset(palette|{(0,0,0,0)})
    assert im.getchannel('A').getextrema()==(0,255)
ring=Image.open(O/'wide-1.png').convert('RGBA');a=ring.getchannel('A');assert ring.size==(64,44);assert a.getpixel((32,22))==0
assert any(a.getpixel((x,22))>100 for x in range(0,10)) and any(a.getpixel((x,22))>100 for x in range(54,64))
assert any(a.getpixel((32,y))>100 for y in range(5,13)) and any(a.getpixel((32,y))>100 for y in range(31,39))
print('VERIFIED 3 different upper-body poses, exact fixed lower bodies, R89 palette and hollow oval ring')

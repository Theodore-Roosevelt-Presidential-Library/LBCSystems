"""Build assets/data/systems.json + terrain.bin + roof.bin from drawing extractions.
Sources (conformed set, 20299 TRPL): M001 geothermal site plan (wells, header, vault),
C510 overall wastewater plan (leach trenches, process tanks, lift station),
M301 enlarged MEP E148 plan (equipment layout), M802 schedules, CampusMap GLB terrain."""
import json, numpy as np
W='/home/claude/lbc/'; X='/tmp/claude-0/x/'; OUT='/home/claude/lbcsystems/assets/data/'
rows=json.load(open(X+'rows.json'))['rows']
header=json.load(open(X+'header_stl.json'))
trenches=json.load(open(X+'trenches.json'))
tanks=json.load(open(X+'tanks.json'))
# vault = header end
vault=header[-1]
# --- mech room E148 local frame (M301 at 1/4"=1'-0": 18 pt per ft) ---
F0=np.array([453.,119.]); F1=np.array([427.,-11.])
dS=(F1-F0)/np.linalg.norm(F1-F0); dI=np.array([dS[1],-dS[0]])
if dI[0]>0: dI=-dI  # point west (into building)
s0=8.0
def room(px,py): # M301 pt -> STL
    s=(py-820)/18+s0; i=(2960-px)/18+2.5
    p=F0+dS*s+dI*i; return [round(p[0],1),round(p[1],1)]
eq=[ # tag, pt x, pt y, size along-facade(s), inward(i), height, kind
 ('WWHP-1',2424,1868,4.5,3,6,'hp'),('WWHP-2',2434,1776,4.5,3,6,'hp'),('WWHP-3',2453,1686,4.5,3,6,'hp'),
 ('CH-1',2627,1774,14.2,3.9,7,'chiller'),('AHU-1',2857,1398,33,7.5,8,'ahu'),('B-1',2449,1971,3,4,5.5,'boiler'),
 ('HPLP-1',2640,2080,4,2.2,3,'pump'),('HPLP-2',2695,2080,4,2.2,3,'pump'),('DWST-1',2382,1159,6,6,8,'tank'),
 ('DWH-1',2292,1002,4,4,6,'hp'),('MBR',2610,1080,18,5,7,'mbr'),('BREAK',2638,1434,4.5,4.5,6,'tank')]
room_eq=[dict(tag=t,at=room(x,y),s=s,i=i,h=h,kind=k) for t,x,y,s,i,h,k in eq]
corners=[room(2960,820),room(2210,820),room(2210,2240),room(2960,2240)]
ang=float(np.degrees(np.arctan2(dS[1],dS[0])))
# --- terrain ---
H=np.load(W+'dem/Zfull.npy'); H=np.clip(H,-400,300)  # USGS 3DEP (tools/build_dem.py)
(np.round(H*10).astype('<i2')).tofile(OUT+'terrain.bin')
top=np.load(W+'top.npy'); tb=np.where(top>-90,np.round(top*10),-32768).astype('<i2'); tb.tofile(OUT+'roof.bin')
d=dict(
  terrain=dict(x0=-1300,y0=-1650,cell=6,nx=int(H.shape[1]),ny=int(H.shape[0]),scale=0.1),
  roof=dict(x0=-10,y0=-80,cell=2,nx=int(top.shape[1]),ny=int(top.shape[0]),scale=0.1),
  wellRows=[[ [round(p[0],1),round(p[1],1)] for p in r] for r in rows],
  wellDepth=300, header=header, vault=vault,
  trenches=trenches, processTanks=tanks['process'], liftStation=tanks['lift'],
  mechRoom=dict(corners=corners, angle=round(ang,2), equipment=room_eq),
  # C310.B (registered via C510): Contech underground detention system under the east lot, ~230 x 30 ft
  detention=dict(c=[1940.7,485.5], ang=115.4, l=225, w=30),
)
json.dump(d,open(OUT+'systems.json','w'),separators=(',',':'))
print({k:(len(v) if hasattr(v,'__len__') else v) for k,v in d.items()}, corners, ang)

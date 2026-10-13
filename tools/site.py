import cv2, numpy as np, json
m_,ang,tx,ty=np.load('reg.npy'); a=np.deg2rad(ang)
def to_stl(pts):
    p=np.asarray(pts,float); mx=p[:,0]-tx; my=-(p[:,1]-ty)
    x=mx*np.cos(a)+my*np.sin(a); y=(-mx*np.sin(a)+my*np.cos(a))*m_
    return np.round(np.stack([x,y],1),1).tolist()
def gs(pts): return [(300+x/0.45,700+y/0.45) for x,y in pts]   # g_site img -> px100
def gp(pts): return [(2250+x,2250+y) for x,y in pts]           # g_park img -> px100
tr=json.load(open('trace_px.json'))
site={}
site['basins']=[to_stl(c) for c in tr['basin']]
site['pv']=[to_stl(c) for c in tr['pv']]
# orange sustainability boundary
im=cv2.imread('sp100-1.png'); rgb=im[:,:,::-1].astype(int)
for c in ([252,140,70],[247,150,80]):
    pass
bp=[(160,575),(495,590),(770,425),(800,440),(1222,315),(1210,680),(1255,660),(1280,760),(1095,900),(1085,950),(1185,1000),(1045,1170),(930,1150),(912,1275),(760,1165),(140,1155)]
site['boundary']=to_stl([(x*2.5,y*2.5) for x,y in bp])
site['roofPlan']=to_stl(np.load('roofpoly.npy'))
site['parkingShared']=to_stl(gp([(90,285),(440,368),(447,470),(395,605),(60,555)]))
site['parkingDropoff']=to_stl([(2410,2195),(2470,2175),(2515,2240),(2530,2340),(2505,2440),(2450,2480),(2420,2440),(2455,2350),(2450,2260)])
loop=[(650,500),(710,515),(770,555),(830,615),(868,690),(882,760),(885,820),(870,880),(840,935),(790,965),(735,982),(705,985),(680,950),(655,880),(610,830),(540,808),(470,790),(410,760),(375,700),(380,630),(410,580),(470,540),(560,512),(650,500)]
site['boardwalk']=to_stl(gs(loop))
site['overlook']={'c':to_stl(gs([(705,985)]))[0],'r':42}
site['medicinal']={'c':to_stl(gs([(660,478)]))[0],'r':22}
site['picnic']=to_stl(gs([(530,515)]))[0]
site['trailhead']=to_stl(gs([(900,815)]))[0]
site['omBldg']=to_stl(gs([(860,905)]))[0]
site['musical']=to_stl([(3262,2775)])[0]
site['fondue']=to_stl([(3762,2875)])[0]
site['chateauRoad']=to_stl([(2780,2510),(2950,2520),(3150,2500),(3375,2440),(3700,2250),(4100,2050),(4525,1862)])
site['mdhTrail']=to_stl(gs([(320,745),(240,650),(150,600),(60,520),(0,470)]))
json.dump(site,open('site.json','w'))
print({k:(len(v) if isinstance(v,list) else v) for k,v in site.items()})
# check: draw everything back in STL frame
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(12,10))
def poly(p,**k): p=np.array(p); ax.fill(p[:,0],p[:,1],**k)
poly(site['boundary'],fc='#e8efd8',ec='orange')
for b in site['basins']: poly(b,fc='#3cc')
for b in site['pv']: poly(b,fc='navy')
poly(site['parkingShared'],fc='#dab',alpha=.6); poly(site['parkingDropoff'],fc='#dab',alpha=.6)
poly(site['roofPlan'],fc='#8a9a6a')
b=np.array(site['boardwalk']); ax.plot(b[:,0],b[:,1],'brown',lw=2)
b=np.array(site['chateauRoad']); ax.plot(b[:,0],b[:,1],'gray',lw=3)
for k in ('picnic','trailhead','omBldg','musical','fondue'): ax.annotate(k,site[k]); ax.plot(*site[k],'ko')
V=np.load('V3.npy'); ax.scatter(V[::40,0],V[::40,1],s=.1,c='k')
ax.set_aspect('equal'); plt.savefig('site_stl.png',dpi=70,bbox_inches='tight')

import numpy as np, cv2, trimesh, json
from scipy import ndimage as ndi
top=np.load('top.npy'); floor=np.load('floor.npy')
CELL=2.0; X0,Y0=-10,-80
valid=top>-50
# fill small holes in roof (path gaps) and keep main component
lab,n=ndi.label(valid); sizes=ndi.sum(valid,lab,range(1,n+1)); valid=lab==(np.argmax(sizes)+1)
filled=ndi.binary_fill_holes(valid)
holes=filled&~valid
z=np.where(valid,top,np.nan)
# fill nan inside by nearest
idx=ndi.distance_transform_edt(np.isnan(z),return_distances=False,return_indices=True)
zf=z[tuple(idx)]
zs=ndi.median_filter(zf,size=5)
# lift sagging edge cells to their inner neighbors (removes eave 'teeth')
edge=roofmask_tmp=None
zsm=ndi.gaussian_filter(zs,1.0)
sky=((zs-ndi.gaussian_filter(zs,6))>2.2)&ndi.binary_erosion(ndi.binary_fill_holes(valid),iterations=5)   # skylight bumps
roofmask=filled
inner2=ndi.binary_erosion(filled,iterations=3)
zin=np.where(inner2,zs,np.nan)
idx2=ndi.distance_transform_edt(np.isnan(zin),return_distances=False,return_indices=True)
zedge=zin[tuple(idx2)]
zs=np.where(inner2,zs,np.maximum(zs,zedge-1.0))
zsm=ndi.gaussian_filter(zs,1.0)
NY,NX=roofmask.shape
# vertices at cell centers; quads between 4 neighbors all in mask
H=np.where(roofmask,zsm,0.0)
ii,jj=np.nonzero(roofmask[:-1,:-1]&roofmask[1:,:-1]&roofmask[:-1,1:]&roofmask[1:,1:])
vid=-np.ones((NY,NX),int); used=np.zeros((NY,NX),bool)
for di in (0,1):
    for dj in (0,1): used[ii+di,jj+dj]=True
vi,vj=np.nonzero(used); vid[vi,vj]=np.arange(len(vi))
X=X0+(vj+.5)*CELL; Y=Y0+(vi+.5)*CELL; Z=H[vi,vj]
verts=np.stack([X,Z,-Y],1)
a=vid[ii,jj]; b=vid[ii,jj+1]; c=vid[ii+1,jj+1]; d=vid[ii+1,jj]
faces=np.concatenate([np.stack([a,c,b],1),np.stack([a,d,c],1)])
# colors
rng=np.random.default_rng(1)
base=np.array([142,156,104],float)
noise=ndi.gaussian_filter(rng.random((NY,NX)),1.5)
col=base[None,:]*(0.88+0.24*noise[vi,vj,None])
col[sky[vi,vj]]=[150,88,52]
col[holes[vi,vj]]=[196,178,140]
col=(np.power(np.clip(col,0,255)/255.0,2.2)*255).astype(np.uint8)
roof=trimesh.Trimesh(verts,faces,vertex_colors=np.c_[col,np.full(len(col),255)],process=False)
# fascia skirt along roof outline
cs,_=cv2.findContours(roofmask.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
cont=max(cs,key=len)[:,0,:]
cont=cont[::2]
sv=[];sf=[]
def hgt(px,py):
    j=min(max(int(px),0),NX-1); i=min(max(int(py),0),NY-1); return H[i,j]
for k in range(len(cont)):
    p=cont[k]; q=cont[(k+1)%len(cont)]
    for (u) in (p,q): pass
    x1,y1=X0+(p[0]+.5)*CELL,Y0+(p[1]+.5)*CELL; x2,y2=X0+(q[0]+.5)*CELL,Y0+(q[1]+.5)*CELL
    h1,h2=hgt(*p),hgt(*q)
    b=len(sv)
    sv+= [[x1,h1,-y1],[x2,h2,-y2],[x2,max(0,h2-3.5),-y2],[x1,max(0,h1-3.5),-y1]]
    sf+= [[b,b+1,b+2],[b,b+2,b+3]]
fascia=trimesh.Trimesh(np.array(sv),np.array(sf),process=False)
# floors & walls from floor footprint (two largest comps)
fm=ndi.binary_closing(floor>0,iterations=2)
lab,n=ndi.label(fm); sizes=ndi.sum(fm,lab,range(1,n+1)); order=np.argsort(sizes)[::-1][:2]
wv=[];wf=[];flv=[];flf=[];footprints=[]
for o in order:
    m=(lab==o+1)
    m=ndi.binary_opening(m,iterations=2); m=ndi.binary_fill_holes(m)
    cs,_=cv2.findContours(m.astype(np.uint8),cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_NONE)
    c=max(cs,key=len); c=cv2.approxPolyDP(c,2.5,True)[:,0,:]
    pts=[(X0+(p[0]+.5)*CELL,Y0+(p[1]+.5)*CELL) for p in c]
    footprints.append([[round(x,1),round(y,1)] for x,y in pts])
    for k in range(len(c)):
        p=c[k]; q=c[(k+1)%len(c)]
        x1,y1=pts[k]; x2,y2=pts[(k+1)%len(c)]
        h1,h2=max(hgt(*p)-3.5,12),max(hgt(*q)-3.5,12)
        b=len(wv); wv+=[[x1,0,-y1],[x2,0,-y2],[x2,h2,-y2],[x1,h1,-y1]]; wf+=[[b,b+1,b+2],[b,b+2,b+3]]
walls=trimesh.Trimesh(np.array(wv),np.array(wf),process=False)
json.dump(footprints,open('footprints.json','w'))
print('roof',len(roof.faces),'fascia',len(fascia.faces),'walls',len(walls.faces),[len(f) for f in footprints])
sc=trimesh.Scene()
sc.add_geometry(roof,node_name='roof',geom_name='roof')
sc.add_geometry(fascia,node_name='fascia',geom_name='fascia')
sc.add_geometry(walls,node_name='walls',geom_name='walls')
sc.export('mass_raw.glb')

# glulam beam grid under the roof (every 30 ft both ways), heights follow roof minus 4 ft
beams=[]
inner=ndi.binary_erosion(roofmask,iterations=3)
def run(points):
    seg=[]
    for (x,y) in points:
        j=int((x-X0)/CELL); i=int((y-Y0)/CELL)
        if 0<=i<NY and 0<=j<NX and inner[i,j] and ndi_fp[i,j]:
            seg.append([round(float(x),1),round(float(H[i,j])-4,1),round(float(-y),1)])
        else:
            if len(seg)>1: beams.append(seg)
            seg=[]
    if len(seg)>1: beams.append(seg)
ndi_fp=ndi.binary_dilation(fm,iterations=3)
for x in np.arange(10,600,30): run([(x,y) for y in np.arange(-60,240,4)])
for y in np.arange(-10,230,30): run([(x,y) for x in np.arange(0,620,4)])
json.dump(beams,open('beams.json','w')); print('beams',len(beams))

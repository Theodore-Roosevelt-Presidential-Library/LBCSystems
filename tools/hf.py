import numpy as np, cv2, time
V=np.load('V.npy'); F=np.load('F.npy')
T=V[F]; c=T.mean(1); keep=(c[:,0]<1000)&(c[:,1]>-500); T=T[keep]
CELL=2.0; X0,Y0=-10,-80; NX,NY=int(640/CELL),int(320/CELL)
top=np.full((NY,NX),-99.0)
floor=np.zeros((NY,NX),np.uint8)
t=time.time()
a=T[:,1]-T[:,0]; b=T[:,2]-T[:,0]; cr=np.cross(a,b); area=np.linalg.norm(cr,axis=1)/2; nz=np.abs(cr[:,2])/(2*area+1e-9)
n=np.clip((area/(CELL*CELL)*3).astype(int),3,3000)
# sample barycentric points per triangle in chunks
rng=np.random.default_rng(0)
idx=np.repeat(np.arange(len(T)),n)
for s in range(0,len(idx),4_000_000):
    ii=idx[s:s+4_000_000]
    u=rng.random(len(ii)); v=rng.random(len(ii)); m=u+v>1; u[m]=1-u[m]; v[m]=1-v[m]
    p=T[ii,0]+u[:,None]*a[ii]+v[:,None]*b[ii]
    gx=((p[:,0]-X0)/CELL).astype(int); gy=((p[:,1]-Y0)/CELL).astype(int)
    ok=(gx>=0)&(gx<NX)&(gy>=0)&(gy<NY)
    np.maximum.at(top,(gy[ok],gx[ok]),p[ok,2])
    # floor slab samples: near-horizontal, z in [-2.5,2.5]
    fm=ok&(nz[ii]>0.9)&(np.abs(p[:,2])<2.5)
    floor[gy[fm],gx[fm]]=1
print('sampled',len(idx),time.time()-t)
np.save('top.npy',top); np.save('floor.npy',floor)
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
fig,ax=plt.subplots(2,1,figsize=(12,12))
ax[0].imshow(np.where(top>-99,top,np.nan),origin='lower',cmap='viridis'); ax[0].set_title('top z')
ax[1].imshow(floor,origin='lower'); ax[1].set_title('floor')
plt.savefig('hf.png',dpi=70,bbox_inches='tight')

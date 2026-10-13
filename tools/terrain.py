import trimesh,numpy as np
from scipy.interpolate import LinearNDInterpolator
from matplotlib.tri import Triangulation, LinearTriInterpolator
s=trimesh.load('cm/raw.glb')
reg=np.load('cm/reg_cm.npy'); s_,ang,mm,tx,tz,pcx,pcy=reg
def cm2stl(v):
    a=np.deg2rad(ang); dx=(v[:,0]-tx)/s_; dz=(v[:,2]-tz)/s_
    qx=dx*np.cos(a)+dz*np.sin(a); qy=-dx*np.sin(a)+dz*np.cos(a)
    return np.stack([qx+pcx, qy*mm+pcy, (v[:,1]-1.149)/s_],1)
T,_=s.graph['L A N D']; m=s.geometry['L A N D']
v=cm2stl(trimesh.transform_points(m.vertices,T))
print(v.min(0),v.max(0))
X0,X1,Y0,Y1,C=-480,1480,-1080,560,5
xs=np.arange(X0,X1+.1,C); ys=np.arange(Y0,Y1+.1,C)
keep=(v[:,0]>X0-100)&(v[:,0]<X1+100)&(v[:,1]>Y0-100)&(v[:,1]<Y1+100)
idx=np.where(keep)[0]; remap=-np.ones(len(v),int); remap[idx]=np.arange(len(idx))

from scipy.interpolate import griddata
vv=v[keep]
# also add triangle centroids for density
f=m.faces; fk=f[keep[f].all(1)]
cen=v[fk].mean(1)
P=np.vstack([vv,cen])
ix=np.round((P[:,0]-X0)/C).astype(int); iy=np.round((P[:,1]-Y0)/C).astype(int)
ok=(ix>=0)&(ix<len(xs))&(iy>=0)&(iy<len(ys))
H=np.full((len(ys),len(xs)),-1e9)
np.maximum.at(H,(iy[ok],ix[ok]),P[ok,2])
has=H>-1e8
print('filled',has.mean())
gy,gx=np.nonzero(has)
H2=griddata(np.stack([gx,gy],1),H[has],tuple(np.meshgrid(np.arange(len(xs)),np.arange(len(ys)))),method='linear')
nn=np.isnan(H2)
if nn.any():
    H2[nn]=griddata(np.stack([gx,gy],1),H[has],np.stack(np.nonzero(nn)[::-1],1),method='nearest')
print(H2.shape,H2.min(),H2.max())
np.save('cm/H.npy',H2.astype(np.float32))

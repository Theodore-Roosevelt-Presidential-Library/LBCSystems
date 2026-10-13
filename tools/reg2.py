import cv2, numpy as np
Sf=(cv2.imread('stl_sil.png',0)>0).astype(np.uint8); off=np.array([-20,-80])
roof=np.load('roofpoly.npy'); P=np.zeros((3600,4800),np.uint8); cv2.fillPoly(P,[roof],1); Ps=P.sum()
ys,xs=np.nonzero(Sf); sp=np.stack([xs+off[0],ys+off[1]],1).astype(float)[::7]
n_full=Sf.sum()
cen=roof.mean(0)
def score(mirror,ang,tx,ty):
    a=np.deg2rad(ang); x=sp[:,0]; y=sp[:,1]*mirror
    u=x*np.cos(a)-y*np.sin(a); v=-(x*np.sin(a)+y*np.cos(a))
    U=np.round(u+tx).astype(int); Vv=np.round(v+ty).astype(int)
    ok=(U>=0)&(U<4800)&(Vv>=0)&(Vv<3600)
    inter=P[Vv[ok],U[ok]].sum()*7; return inter/(n_full+Ps-inter)
def search(mirror,angs,center,rng,step):
    best=(0,)
    a0=None
    for ang in angs:
        a=np.deg2rad(ang); x=sp[:,0]; y=sp[:,1]*mirror
        u=x*np.cos(a)-y*np.sin(a); v=-(x*np.sin(a)+y*np.cos(a))
        bx,by=(cen[0]-u.mean(),cen[1]-v.mean()) if center is None else center
        for tx in np.arange(bx-rng,bx+rng+1,step):
            for ty in np.arange(by-rng,by+rng+1,step):
                s=score(mirror,ang,tx,ty)
                if s>best[0]: best=(s,mirror,ang,tx,ty)
    return best
bm=search(-1,np.arange(-80,-0,2),None,60,8); print('mirror -1',bm)
b1=search(1,np.arange(-46,-40,0.25),(1938,1778),10,1); print('mirror 1 refined',b1)
np.save('reg.npy',np.array(b1[1:]))

import pymupdf, numpy as np, cv2, json, sys
from scipy import ndimage as ndi
def render(pdf, scale_ft_per_in):
    p=pymupdf.open(pdf)[0]; z=72/ (scale_ft_per_in) / 1.0  # px per pt so that 1px = 1ft : 1pt = scale/72 ft
    z=scale_ft_per_in/72
    pix=p.get_pixmap(matrix=pymupdf.Matrix(z,z), colorspace=pymupdf.csGRAY)
    return np.frombuffer(pix.samples,np.uint8).reshape(pix.height,pix.width), z
def stl_floor_mask():
    floor=np.load('floor.npy'); X0,Y0,C=-10,-80,2.0
    fm=ndi.binary_closing(floor>0,iterations=2); lab,n=ndi.label(fm); s=ndi.sum(fm,lab,range(1,n+1)); keep=np.argsort(s)[::-1][:2]+1
    fm=np.isin(lab,keep)
    ys,xs=np.nonzero(fm); pts=np.stack([X0+(xs+.5)*C, Y0+(ys+.5)*C],1)   # STL x,y (y up)
    return pts
def register(sheet_mask, pts, ang0=-40, span=12, mirror=(1,)):
    P=sheet_mask.astype(np.uint8); Ps=P.sum(); cen=np.array(np.nonzero(P)[::-1]).mean(1)
    sp=pts[::3]; best=(0,)
    for m in mirror:
        for ang in np.arange(ang0-span,ang0+span+.1,0.5):
            a=np.deg2rad(ang); x=sp[:,0]; y=sp[:,1]*m
            u=x*np.cos(a)-y*np.sin(a); v=-(x*np.sin(a)+y*np.cos(a))
            bx,by=cen[0]-u.mean(),cen[1]-v.mean()
            for tx in np.arange(bx-30,bx+31,3):
                for ty in np.arange(by-30,by+31,3):
                    U=np.round(u+tx).astype(int); V=np.round(v+ty).astype(int)
                    ok=(U>=0)&(U<P.shape[1])&(V>=0)&(V<P.shape[0])
                    inter=P[V[ok],U[ok]].sum()*3*4  # each pt ~ 2x2 ft cell, subsampled 3
                    s=inter/(len(pts)*4+Ps-inter)
                    if s>best[0]: best=(s,m,ang,tx,ty)
    s,m,ang,tx,ty=best; a=np.deg2rad(ang); x=sp[:,0]; y=sp[:,1]*m
    u=x*np.cos(a)-y*np.sin(a); v=-(x*np.sin(a)+y*np.cos(a))
    best2=best
    for ang in np.arange(ang-1,ang+1.01,0.25):
        a=np.deg2rad(ang); u=x*np.cos(a)-y*np.sin(a); v=-(x*np.sin(a)+y*np.cos(a))
        for t1 in np.arange(tx-3,tx+3.1,1):
            for t2 in np.arange(ty-3,ty+3.1,1):
                U=np.round(u+t1).astype(int); V=np.round(v+t2).astype(int); ok=(U>=0)&(U<P.shape[1])&(V>=0)&(V<P.shape[0])
                inter=P[V[ok],U[ok]].sum()*12; sc=inter/(len(pts)*4+Ps-inter)
                if sc>best2[0]: best2=(sc,m,ang,t1,t2)
    return best2
def sheet_to_stl(uv, reg):
    s,m,ang,tx,ty=reg; a=np.deg2rad(ang); uv=np.asarray(uv,float)
    mx=uv[:,0]-tx; my=-(uv[:,1]-ty)
    x=mx*np.cos(a)+my*np.sin(a); y=(-mx*np.sin(a)+my*np.cos(a))*m
    return np.stack([x,y],1)

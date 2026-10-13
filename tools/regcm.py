import numpy as np,cv2
cm=cv2.imread('cm/roofmask.png',0)>0; x0,z0,r=-36,-87,0.05
top=np.load('top.npy'); X0,Y0,C=-10,-80,2.0
ys,xs=np.nonzero(top>8); P=np.stack([X0+(xs+.5)*C,Y0+(ys+.5)*C],1)  # STL x,y
cy,cx=np.nonzero(cm); cmc=np.array([cx.mean()*r+x0, cy.mean()*r+z0])
Pc=P.mean(0)
best=(0,)
def score(s,ang,m,tx,tz,sub=2):
    a=np.deg2rad(ang); q=(P[::sub]-Pc)*[1,m]
    X=s*(q[:,0]*np.cos(a)-q[:,1]*np.sin(a))+tx; Z=s*(q[:,0]*np.sin(a)+q[:,1]*np.cos(a))+tz
    U=((X-x0)/r).astype(int); V=((Z-z0)/r).astype(int)
    ok=(U>=0)&(U<500)&(V>=0)&(V<500)
    inter=cm[V[ok],U[ok]].sum()*sub*(C*s/r)**2
    A=len(P)*(C*s/r)**2
    return inter/(A+cm.sum()-inter)
for m in (1,-1):
  for s in np.arange(0.026,0.036,0.001):
    for ang in range(0,360,4):
        sc=score(s,ang,m,*cmc)
        if sc>best[0]: best=(sc,s,ang,m,*cmc)
print(best)
sc,s,ang,m,tx,tz=best
for it in range(3):
  for ds in (-0.0005,0,0.0005):
    for da in np.arange(-3,3.1,0.5):
      for dx in np.arange(-0.6,0.61,0.15):
        for dz in np.arange(-0.6,0.61,0.15):
          v=score(s+ds,ang+da,m,tx+dx,tz+dz)
          if v>best[0]: best=(v,s+ds,ang+da,m,tx+dx,tz+dz)
  sc,s,ang,m,tx,tz=best; print(best)
np.save('cm/reg_cm.npy',np.array([s,ang,m,tx,tz,*Pc]))

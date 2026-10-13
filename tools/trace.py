import cv2, numpy as np, json
im=cv2.imread('sp100-1.png'); rgb=im[:,:,::-1].astype(int)
H,W=rgb.shape[:2]
# crop away legend/title block: map area roughly x 60..1810 of 1920, y 160..1400 of 1440
x0,x1,y0,y1=int(60/1920*W),int(1810/1920*W),int(150/1440*H),int(1400/1440*H)
def mask(c,tol):
    d=np.sqrt(((rgb-np.array(c))**2).sum(2)); m=(d<tol).astype(np.uint8)
    m[:, :x0]=0; m[:, x1:]=0; m[:y0]=0; m[y1:]=0
    # exclude legend zone (top-left)
    m[:int(420/1440*H), :int(1000/1920*W)]=0
    return m
out={}
spec={'basin':([31,199,236],60),'pv':([6,21,200],90),'roof':([143,163,133],14),'pave':([231,187,203],38),'vspz':([212,241,187],22)}
for k,(c,t) in spec.items():
    m=mask(c,t)
    k3=cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(7,7))
    m=cv2.morphologyEx(m,cv2.MORPH_CLOSE,k3); m=cv2.morphologyEx(m,cv2.MORPH_OPEN,cv2.getStructuringElement(cv2.MORPH_ELLIPSE,(5,5)))
    cs,_=cv2.findContours(m,cv2.RETR_EXTERNAL,cv2.CHAIN_APPROX_SIMPLE)
    cs=[c for c in cs if cv2.contourArea(c)>(400 if k!='vspz' else 20000)]
    cs=[cv2.approxPolyDP(c,2.5,True)[:,0,:].tolist() for c in cs]
    out[k]=cs; print(k,len(cs),[len(c) for c in cs][:20])
    cv2.imwrite(f'mask_{k}.png',m*255)
json.dump(out,open('trace_px.json','w'))
# overlay
ov=im.copy()
cols={'basin':(255,200,0),'pv':(0,0,255),'roof':(0,120,0),'pave':(200,0,200),'vspz':(0,200,0)}
for k,cs in out.items():
    for c in cs: cv2.polylines(ov,[np.array(c,np.int32)],True,cols[k],4)
cv2.imwrite('overlay.jpg',cv2.resize(ov,(1600,1200)))

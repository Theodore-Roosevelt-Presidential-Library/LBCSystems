import pymupdf,numpy as np,cv2,json,sys,collections
sys.path.insert(0,'/home/claude/lbc')
from regsheet import register, sheet_to_stl, stl_floor_mask
p=pymupdf.open('vec/s53.pdf')[0]
d=p.get_drawings()
Z=100/72
H,Wd=int(p.rect.height*Z)+1,int(p.rect.width*Z)+1
mask=np.zeros((H,Wd),np.uint8)
fills=collections.Counter()
for x in d:
    if 'f' in x['type'] and x.get('fill') is not None:
        f=tuple(round(c,2) for c in x['fill']); fills[f]+=1
print(fills.most_common(8))
for x in d:
    if 'f' in x['type'] and x.get('fill') is not None and round(x['fill'][0],2)==0.58:
        for it in x['items']:
            pts=[]
            if it[0]=='l': pts=[it[1],it[2]]
            elif it[0]=='c': pts=[it[1],it[4]]
            elif it[0]=='re': r=it[1]; pts=[r.tl,r.tr,r.br,r.bl]
            elif it[0]=='qu': q=it[1]; pts=[q.ul,q.ur,q.lr,q.ll]
        # fill path polygon
        poly=[]
        for it in x['items']:
            if it[0] in('l','c'): poly+= [it[1]] + ([it[-1]] )
            elif it[0]=='re': r=it[1]; poly+=[r.tl,r.tr,r.br,r.bl]
            elif it[0]=='qu': q=it[1]; poly+=[q.ul,q.ur,q.lr,q.ll]
        if len(poly)>=3:
            P=np.array([[q.x*Z,q.y*Z] for q in poly],np.int32); cv2.fillPoly(mask,[P],1)
print(mask.sum())
cv2.imwrite('/tmp/claude-0/x/c510mask.png',mask*255)
pts=stl_floor_mask()
reg=register(mask,pts,ang0=-38,span=6)
print(reg); json.dump([float(v) for v in reg],open('reg_c510.json','w'))

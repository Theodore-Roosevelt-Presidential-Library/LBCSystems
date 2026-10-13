import pymupdf,numpy as np,json,sys
sys.path.insert(0,'/home/claude/lbc')
from regsheet import sheet_to_stl
p=pymupdf.open('vec/s477.pdf')[0]
reg=json.load(open('reg_m001.json')); Z=50/72
def bez(a,b,c,d,n=8):
    t=np.linspace(0,1,n)[:,None]; P=[np.array([q.x,q.y]) for q in (a,b,c,d)]
    return ((1-t)**3*P[0]+3*(1-t)**2*t*P[1]+3*(1-t)*t**2*P[2]+t**3*P[3])
paths=[]
for x in p.get_drawings():
    if x['type']!='s' or x.get('color')!=(0,0,0) or round(x.get('width') or 0,2) not in (0.36,0.84): continue
    pts=[]
    for it in x['items']:
        if it[0]=='l': seg=np.array([[it[1].x,it[1].y],[it[2].x,it[2].y]])
        elif it[0]=='c': seg=bez(*it[1:5])
        else: continue
        if pts and np.hypot(*(pts[-1][-1]-seg[0]))<0.5: pts[-1]=np.vstack([pts[-1],seg[1:]])
        else: pts.append(seg)
    for s in pts:
        L=np.hypot(*np.diff(s,axis=0).T).sum()
        r=x['rect']
        paths.append(dict(w=round(x['width'],2),L=L,pts=s,rect=r))
print(len(paths))
big=[q for q in paths if q['L']>40 and 1500<q['rect'].x0<2600 and 600<q['rect'].y0<2300]
for q in sorted(big,key=lambda q:-q['L'])[:60]: print(q['w'],round(q['L']),q['rect'],len(q['pts']))
np.save('/tmp/claude-0/x/paths477.npy',np.array([dict(w=q['w'],stl=sheet_to_stl(q['pts']*Z,reg).tolist(),L=q['L']) for q in big],dtype=object),allow_pickle=True)

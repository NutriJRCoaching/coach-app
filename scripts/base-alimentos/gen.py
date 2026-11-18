import sys, json, re, subprocess
sys.path.insert(0,'/tmp/intap')
from keep_old import KEEP
from medidas import M
GROUPS = {"Cereales":("cho",30),"Verduras generales":("cho",5),"Verduras libre consumo":("cho",2.5),"Frutas":("cho",15),
 "Lácteos altos en grasa":("cho",9),"Lácteos medios en grasa":("cho",9),"Lácteos bajos en grasa":("cho",10),
 "Carnes magras":("prot",11),"Carnes grasas":("prot",11),"Huevo":("prot",6),"Legumbres":("cho",30),
 "Aceites y grasas":("fat",20),"Alimentos ricos en lípidos":("fat",15),"Azúcar":("cho",5)}
PREF={'3':0,'2':1,'6':2,'1':3,'4':4}
rows=[]
for l in open('/tmp/intap/t.txt'):
    p,n,s,k,pr,c,fb,f=l.strip().split(';')
    num=lambda x: float(x) if x!='' else None
    rows.append(dict(page=int(p),name=n,src=s,kcal=num(k),prot=num(pr),cho=num(c),fib=num(fb),fat=num(f)))
best={}
for r in rows:
    k=r['name'].lower()
    if k not in best or PREF[r['src']]<PREF[best[k]['src']]: best[k]=r
foods=sorted(best.values(), key=lambda r:(r['page'], r['name']))
def has(n,*w): n=n.lower(); return any(x in n for x in w)
def group(r):
    n,p=r['name'],r['page']; P,C,F=r['prot'] or 0,r['cho'] or 0,r['fat'] or 0
    if p<=19:
        if has(n,'tofu'): return 'Carnes magras'
        if has(n,'condensada'): return ''
        if has(n,'quesillo 0%','light') and has(n,'queso','quesillo'): return 'Lácteos bajos en grasa'
        if has(n,'quesillo','queso fresco','ricotta'): return 'Lácteos medios en grasa'
        if has(n,'queso crema','untable'): return 'Alimentos ricos en lípidos'
        if has(n,'queso'): return 'Carnes grasas'
        if has(n,'materna','burra'): return ''
        if has(n,'sabor','frutas','fruta','purita') and C>=9: return 'Lácteos medios en grasa (ricos en HC)' if F>0.5 else 'Lácteos bajos en grasa'
        ratio=F/C if C else 9
        return 'Lácteos bajos en grasa' if ratio<=0.12 else 'Lácteos medios en grasa' if ratio<=0.5 else 'Lácteos altos en grasa'
    if p==21: return 'Carnes magras' if has(n,'clara') else 'Alimentos ricos en lípidos' if has(n,'yema') else 'Huevo'
    if p<=52:
        if has(n,'soya'): return 'Legumbres'
        if has(n,'nugget','kanikama','paté'): return ''
        return 'Carnes magras' if F*11/max(P,0.1)<=3.5 else 'Carnes grasas'
    if p<=57:
        if has(n,'arvejas','habas','granados') and not has(n,'seca','harina'): return 'Cereales'
        if has(n,'poroto de soya'): return 'Legumbres'
        return 'Legumbres'
    if p<=62:
        if has(n,'castaña cruda','piñón (araucaria)'): return 'Cereales'
        if has(n,'japonés'): return ''
        return 'Alimentos ricos en lípidos'
    if p<=78:
        if has(n,'galleta') and not has(n,'agua','soda','arroz','champaña','cracker'): return ''
        return 'Cereales'
    if p==80: return 'Cereales'
    if p<=87: return 'Aceites y grasas'
    if p<=99:
        if has(n,'luche ahumado','pickles'): return ''
        return 'Verduras libre consumo' if (r['kcal'] or 99)<=20 and not has(n,'champi','tomate','zanahoria') else 'Verduras generales'
    if p<=109:
        if has(n,'aceituna','palta'): return 'Alimentos ricos en lípidos'
        return 'Frutas'
    if p<=112: return 'Azúcar'
    return ''
SRC={'1':'USDA','2':'Tabla Chilena (Schmidt-Hebbel)','3':'Análisis INTA','4':'Etiqueta','6':'INTA'}
out=[]; warn=[]
for r in foods:
    g=group(r); r['cat']=g
    for k in ('prot','cho','fat'):
        if r[k] is None: r[k]=0.0
    calc=4*r['prot']+4*r['cho']+9*r['fat']+2*(r['fib'] or 0)
    if r['kcal'] and r['page']<133 and abs(calc/r['kcal']-1)>0.15 and r['kcal']>30: warn.append((r['name'],r['src'],r['kcal'],round(calc)))
    por=None
    if g in GROUPS:
        m,v=GROUPS[g]; x=r[m]
        por=round(v/x*100) if x and x>0 else None
        if por and por>1000: por=None
    med=M.get(r['name'])
    crudo=(23<=r['page']<=30 or 42<=r['page']<=51) and not has(r['name'],'cocid','rostiz','horne','conserva','ahumad','asad','marinad','charqui','arrollado','choricillo','chorizo','soya','cazuela','carne de cerdo')
    if crudo: r['name']=r['name']+' (crudo)'
    out.append([r['name'], g, r['kcal'], r['cho'], r['fat'], r['prot'], por, med[0] if med else "", med[1] if med else None, 'i'+r['src']])
# viejos (USDA) que INTA no trae
old=json.loads(subprocess.check_output(['node','-e',"import('/home/claude/coach-app/js/realfoods.js').then(m=>console.log(JSON.stringify(m.REAL_FOODS)))"]))
names={o[0].lower() for o in out}
for i,(nn,med,g) in KEEP.items():
    o=old[i]
    if nn.lower() in names: continue
    out.append([nn, o[1], o[2], o[3], o[4], o[5], o[6], med, g, 'u'])
print(len(out),'alimentos;', sum(1 for o in out if o[9]!='u'),'INTA')
print('Revisar energía:'); [print(' ',w) for w in warn]
json.dump(out, open('/tmp/intap/final.json','w'), ensure_ascii=False)
missing=[n for n in M if n.lower() not in names]; print('medidas sin match:',missing)

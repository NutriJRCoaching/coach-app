import pyarrow.parquet as pq, fsspec, json, threading
from concurrent.futures import ThreadPoolExecutor
URL="https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet"
fs=fsspec.filesystem("http")
MD=pq.ParquetFile(fs.open(URL, block_size=2**18)).metadata
hits={int(k):v for k,v in json.load(open('hits.json')).items()}
loc=threading.local()
def pf():
    if not hasattr(loc,'pf'): loc.pf=pq.ParquetFile(fs.open(URL, block_size=2**18), metadata=MD)
    return loc.pf
COLS=['code','product_name','brands','nutriments','serving_quantity','quantity','categories_tags','completeness']
def get(i):
    for t in range(3):
        try:
            tb=pf().read_row_group(i, columns=COLS)
            out=[]
            for k in hits[i]:
                r={c: tb.column(c)[k].as_py() for c in COLS}
                nut={n['name']:(n['100g'],n['unit']) for n in (r['nutriments'] or []) if n['name'] in ('energy-kcal','proteins','carbohydrates','fat','fiber','energy')}
                names={x['lang']:x['text'] for x in (r['product_name'] or [])}
                out.append(dict(code=r['code'], names=names, brands=r['brands'], nut=nut, sq=r['serving_quantity'], q=r['quantity'], cats=(r['categories_tags'] or [])[:6], comp=r['completeness']))
            return out
        except Exception as e: err=e
    print('fail',i,err); return []
res=[]
with ThreadPoolExecutor(24) as ex:
    for n,o in enumerate(ex.map(get, sorted(hits))):
        res+=o
        if n%500==0: print(n,len(res),flush=True)
json.dump(res, open('chile.json','w'), ensure_ascii=False)
print(len(res))

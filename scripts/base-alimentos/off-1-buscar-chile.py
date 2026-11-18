import pyarrow.parquet as pq, fsspec, json, sys, threading
from concurrent.futures import ThreadPoolExecutor
URL="https://huggingface.co/datasets/openfoodfacts/product-database/resolve/main/food.parquet"
fs=fsspec.filesystem("http")
base=pq.ParquetFile(fs.open(URL, block_size=2**18)); MD=base.metadata
loc=threading.local()
def pf():
    if not hasattr(loc,'pf'): loc.pf=pq.ParquetFile(fs.open(URL, block_size=2**16), metadata=MD)
    return loc.pf
def scan(i):
    for t in range(3):
        try:
            col=pf().read_row_group(i, columns=['countries_tags']).column(0).to_pylist()
            return i,[k for k,v in enumerate(col) if v and 'en:chile' in v]
        except Exception as e: err=e
    return i,None
hits={}
with ThreadPoolExecutor(24) as ex:
    for n,(i,ks) in enumerate(ex.map(scan, range(MD.num_row_groups))):
        if ks: hits[i]=ks
        if n%500==0: print(n, sum(len(v) for v in hits.values()), flush=True)
json.dump(hits, open('hits.json','w'))
print('rowgroups', len(hits), 'products', sum(len(v) for v in hits.values()))

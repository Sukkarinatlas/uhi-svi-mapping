# -*- coding: utf-8 -*-
"""Robust administrative per-tambon sweep for Chonburi, Dec 2568 (yymm=6812).
For each of the 92 tambons, query statpop(rcode=U, tt) for every local unit U that
operates in the tambon's amphoe (from action=614 amphoe mapping + the amphoe residual
unit), then sum disjoint slices by tambon. Grand total must equal 1,645,985."""
import requests, time, json, os, urllib3, collections
import geopandas as gpd
urllib3.disable_warnings()
YYMM="6812"; CC="20"; TARGET=1645985
FWD="https://stat.bora.dopa.go.th/stat/statnew/connectSAPI/stat_forward.php?API="
CACHE="cache_admin"; os.makedirs(CACHE, exist_ok=True)
s=requests.Session(); s.verify=False
s.headers.update({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
 "Referer":"https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/","Accept":"application/json","X-Requested-With":"XMLHttpRequest"})
def warm():
    try: s.get("https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/",timeout=45)
    except: pass
def get(api, tries=14):
    for i in range(tries):
        try: r=s.get(FWD+api, timeout=45)
        except Exception: time.sleep(3+2*i); continue
        txt=r.content.decode("utf-8","replace")
        if "Request Rejected" in txt or txt[:6].lower()=="<html>":
            if i and i%4==0: warm()
            time.sleep(2.5+2*i); continue
        return txt
    return None
def jget(api):
    t=get(api)
    if t is None: return None
    try: return json.loads(t)
    except: return None

def unit_amphoes(rcode):
    """set of 4-digit amphoe codes this unit operates in (from 614), cached."""
    cf=os.path.join(CACHE,f"amp_{rcode}.json")
    if os.path.exists(cf): return set(json.load(open(cf)))
    for _ in range(4):
        j=jget(f"/api/stat/statcenter/v1/list?action=614&rcode={rcode}&yymm={YYMM}")
        if j is not None: break
        warm(); time.sleep(4)
    amps=[]
    if isinstance(j,list):
        for r in j:
            rc=str(r.get("rcodeCode",""));
            if rc: amps.append(rc)
    json.dump(amps, open(cf,"w")); return set(amps)

def pop(rcode, tt):
    cf=os.path.join(CACHE, f"pop_{rcode}_{tt}.json")
    if os.path.exists(cf): return json.load(open(cf,encoding="utf-8"))
    for _ in range(4):
        j=jget(f"/api/statpophouse/v1/statpop/list?action=25&yymm={YYMM}&nat=999&popst=99&yymm={YYMM}&cc={CC}&rcode={rcode}&tt={tt}")
        if isinstance(j,list): break
        warm(); time.sleep(3)
    if not isinstance(j,list): return None
    m=f=0
    for rec in j:
        ss=sum(v for k,v in rec.items() if k.startswith("lsAge") and isinstance(v,(int,float)))
        if rec.get("lsageSex")==1: m+=ss
        elif rec.get("lsageSex")==2: f+=ss
    d={"male":int(m),"female":int(f)}
    json.dump(d,open(cf,"w",encoding="utf-8")); return d

warm(); time.sleep(1)
units=[str(u["lsrcodecode"]) for u in json.load(open("chonburi_raw.json",encoding="utf-8"))]

# amphoe -> set(units). Seed residual amphoe units 2001..2011.
amp2units=collections.defaultdict(set)
for a in range(1,12): amp2units[f"20{a:02d}"].add(f"20{a:02d}")
for u in units:
    for amp in unit_amphoes(u):
        if amp.startswith("20"): amp2units[amp].add(u)
print("amphoe->#units:", {k:len(v) for k,v in sorted(amp2units.items())}, flush=True)

# 92 tambons from HDX
g=gpd.read_file("tha_shp/tha_admin3.shp"); ch=g[g["adm1_pcode"]=="TH20"]
tambons=sorted(ch["adm3_pcode"].str[2:]+"00")   # 8-digit tt

agg={}; detail=[]
total_pairs=sum(len(amp2units[tt[:4]]) for tt in tambons)
print(f"tambons={len(tambons)} total (tambon,unit) pairs to check={total_pairs}", flush=True)
done=0
for tt in tambons:
    amp=tt[:4]; m=f=0
    for U in sorted(amp2units[amp]):
        pr=pop(U,tt); done+=1
        if pr is None: print(f"  !! fail {U}/{tt}",flush=True); continue
        if pr["male"]+pr["female"]>0:
            detail.append([U,tt,pr["male"],pr["female"]])
        m+=pr["male"]; f+=pr["female"]
        time.sleep(0.3)
    agg[tt]={"male":m,"female":f,"total":m+f}
    print(f"{tt}: total={m+f} ({done}/{total_pairs} checks)", flush=True)

rows=[]; grand=0
for tt in sorted(agg):
    d=agg[tt]; grand+=d["total"]
    rows.append({"tt":tt,"code6":tt[:6],"male":d["male"],"female":d["female"],"total":d["total"]})
json.dump(rows, open("admin_pop_final.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(detail, open("admin_pop_detail_final.json","w",encoding="utf-8"), ensure_ascii=False)
nz=sum(1 for r in rows if r["total"]>0)
print(f"\nTAMBONS: {len(rows)} ({nz} nonzero)", flush=True)
print(f"GRAND TOTAL: {grand:,}  target={TARGET:,}  diff={grand-TARGET}", flush=True)

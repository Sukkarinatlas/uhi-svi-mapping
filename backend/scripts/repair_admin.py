# -*- coding: utf-8 -*-
"""Repair pass: robustly fetch each unit's tambon list, fill missing pops, re-aggregate."""
import requests, time, json, os, urllib3, collections
urllib3.disable_warnings()
YYMM="6812"; CC="20"
FWD="https://stat.bora.dopa.go.th/stat/statnew/connectSAPI/stat_forward.php?API="
CACHE="cache_admin"; os.makedirs(CACHE, exist_ok=True)
s=requests.Session(); s.verify=False
s.headers.update({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
 "Referer":"https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/","Accept":"application/json","X-Requested-With":"XMLHttpRequest"})

def warm():
    try: s.get("https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/",timeout=45)
    except: pass

def get(api, tries=15):
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

def unit_tambons(rcode):
    """Return list of {code,name} for a unit, cached. None if genuinely empty."""
    cf=os.path.join(CACHE,f"list_{rcode}.json")
    if os.path.exists(cf): return json.load(open(cf,encoding="utf-8"))
    aac=jget(f"/api/stat/statcenter/v1/list?action=614&rcode={rcode}&yymm={YYMM}")
    if aac is None: return "FAIL"
    if not (isinstance(aac,list) and aac and aac[0].get("aaCode") not in (None,"","0")):
        json.dump([],open(cf,"w",encoding="utf-8")); return []   # genuinely empty
    aa=aac[0]["aaCode"]
    tl=jget(f"/api/stat/statcenter/v1/list?action=616&rcode={rcode}&aa={aa}&yymm={YYMM}")
    if tl is None: return "FAIL"
    if not isinstance(tl,list): json.dump([],open(cf,"w",encoding="utf-8")); return []
    lst=[{"code":str(r["lscatmTTcode"]),"name":r.get("lscatmTTdesc")} for r in tl]
    json.dump(lst,open(cf,"w",encoding="utf-8"),ensure_ascii=False); return lst

def pop(rcode, tt):
    cf=os.path.join(CACHE, f"pop_{rcode}_{tt}.json")
    if os.path.exists(cf):
        d=json.load(open(cf,encoding="utf-8"))
        if d["male"]+d["female"]>0: return d
    j=jget(f"/api/statpophouse/v1/statpop/list?action=25&yymm={YYMM}&nat=999&popst=99&yymm={YYMM}&cc={CC}&rcode={rcode}&tt={tt}")
    if not isinstance(j,list): return None
    m=f=0
    for rec in j:
        ss=sum(v for k,v in rec.items() if k.startswith("lsAge") and isinstance(v,(int,float)))
        if rec.get("lsageSex")==1: m+=ss
        elif rec.get("lsageSex")==2: f+=ss
    d={"male":int(m),"female":int(f)}
    if m+f>0: json.dump(d,open(cf,"w",encoding="utf-8"))
    return d

warm(); time.sleep(1)
units=json.load(open("chonburi_raw.json",encoding="utf-8"))
# pass 1: ensure every unit's tambon list cached (retry FAILs)
for u in units:
    rc=str(u["lsrcodecode"])
    for attempt in range(4):
        r=unit_tambons(rc)
        if r!="FAIL": break
        warm(); time.sleep(4)
    n=len(r) if isinstance(r,list) else r
    print(f"unit {rc}: tambons={n}", flush=True)

# pass 2: aggregate; fetch any missing pops
agg=collections.defaultdict(lambda:{"male":0,"female":0,"name":None})
detail=[]
for u in units:
    rc=str(u["lsrcodecode"]); uname=u["lsrcodedesc"]
    lst=json.load(open(os.path.join(CACHE,f"list_{rc}.json"),encoding="utf-8")) if os.path.exists(os.path.join(CACHE,f"list_{rc}.json")) else []
    for t in lst:
        tt=t["code"]
        pr=pop(rc,tt)
        if pr is None:
            for _ in range(3):
                warm(); time.sleep(3); pr=pop(rc,tt)
                if pr is not None: break
        if pr is None: print(f"  !! pop fail {rc}/{tt}",flush=True); continue
        agg[tt]["male"]+=pr["male"]; agg[tt]["female"]+=pr["female"]
        if agg[tt]["name"] is None: agg[tt]["name"]=t["name"]
        detail.append([rc,uname,tt,t["name"],pr["male"],pr["female"]])
        time.sleep(0.35)

rows=[]; grand=0
for tt,d in sorted(agg.items()):
    tot=d["male"]+d["female"]; grand+=tot
    rows.append({"tt":tt,"code6":tt[:6],"name_dopa":d["name"],"male":d["male"],"female":d["female"],"total":tot})
json.dump(rows, open("admin_pop_by_tambon.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(detail, open("admin_pop_detail.json","w",encoding="utf-8"), ensure_ascii=False)
print(f"\nTAMBONS covered: {len(rows)}", flush=True)
print(f"GRAND TOTAL: {grand:,}  (target=1,645,985; diff={grand-1645985})", flush=True)

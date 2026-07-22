# -*- coding: utf-8 -*-
"""Complete administrative per-tambon population for Chonburi, Dec 2568 (yymm=6812).
Strategy: enumerate ALL 54 local units (amphoe residual + municipalities) from action=2,
get each unit's tambon breakdown (614->aaCode, 616->tambons), pull population per
(unit, tambon) via statpop (action=25), then AGGREGATE by geographic tambon code.
This folds municipal residents back into their tambon -> true administrative totals."""
import requests, time, json, os, urllib3, collections
urllib3.disable_warnings()

YYMM="6812"; CC="20"
FWD="https://stat.bora.dopa.go.th/stat/statnew/connectSAPI/stat_forward.php?API="
CACHE="cache_admin"; os.makedirs(CACHE, exist_ok=True)

s=requests.Session(); s.verify=False
s.headers.update({"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
 "Referer":"https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/","Accept":"application/json","X-Requested-With":"XMLHttpRequest"})

def get(api, tries=10):
    for i in range(tries):
        try: r=s.get(FWD+api, timeout=45)
        except Exception: time.sleep(3+2*i); continue
        txt=r.content.decode("utf-8","replace")
        if "Request Rejected" in txt or txt[:6].lower()=="<html>": time.sleep(2.5+2*i); continue
        return txt
    return None

def jget(api):
    t=get(api)
    if t is None: return None
    try: return json.loads(t)
    except Exception: return None

def pop(rcode, tt):
    cf=os.path.join(CACHE, f"pop_{rcode}_{tt}.json")
    if os.path.exists(cf): return json.load(open(cf,encoding="utf-8"))
    j=jget(f"/api/statpophouse/v1/statpop/list?action=25&yymm={YYMM}&nat=999&popst=99&yymm={YYMM}&cc={CC}&rcode={rcode}&tt={tt}")
    m=f=0
    if isinstance(j,list):
        for rec in j:
            ss=sum(v for k,v in rec.items() if k.startswith("lsAge") and isinstance(v,(int,float)))
            if rec.get("lsageSex")==1: m+=ss
            elif rec.get("lsageSex")==2: f+=ss
    d={"male":int(m),"female":int(f)}
    json.dump(d,open(cf,"w",encoding="utf-8")); return d

s.get("https://stat.bora.dopa.go.th/stat/statnew/statMONTH/statmonth/",timeout=45); time.sleep(1)

units=json.load(open("chonburi_raw.json",encoding="utf-8"))  # 54 rcode units
print(f"Units to process: {len(units)}", flush=True)

# tambon accumulator: tt -> {male, female, name}
agg=collections.defaultdict(lambda:{"male":0,"female":0,"name":None})
detail=[]  # (rcode, unit_name, tt, tt_name, male, female)

for n,u in enumerate(units,1):
    rcode=str(u["lsrcodecode"]); uname=u["lsrcodedesc"]
    # get aaCode
    aac=jget(f"/api/stat/statcenter/v1/list?action=614&rcode={rcode}&yymm={YYMM}")
    if not (isinstance(aac,list) and aac and "aaCode" in aac[0]):
        print(f"[{n}/{len(units)}] {rcode} {uname}: no aaCode -> skip", flush=True); continue
    aa=aac[0]["aaCode"]
    tl=jget(f"/api/stat/statcenter/v1/list?action=616&rcode={rcode}&aa={aa}&yymm={YYMM}")
    if not isinstance(tl,list) or not tl:
        print(f"[{n}/{len(units)}] {rcode} {uname}: no tambon list", flush=True); continue
    usum=0
    for r in tl:
        tt=str(r["lscatmTTcode"]); ttname=r.get("lscatmTTdesc")
        pr=pop(rcode,tt)
        agg[tt]["male"]+=pr["male"]; agg[tt]["female"]+=pr["female"]
        if agg[tt]["name"] is None: agg[tt]["name"]=ttname
        detail.append([rcode,uname,tt,ttname,pr["male"],pr["female"]])
        usum+=pr["male"]+pr["female"]
        time.sleep(0.5)
    print(f"[{n}/{len(units)}] {rcode} {uname}: {len(tl)} tambons, unit_total={usum:,}", flush=True)
    time.sleep(0.5)

# results
rows=[]
grand=0
for tt,d in sorted(agg.items()):
    tot=d["male"]+d["female"]; grand+=tot
    rows.append({"tt":tt,"code6":tt[:6],"name_dopa":d["name"],"male":d["male"],"female":d["female"],"total":tot})
json.dump(rows, open("admin_pop_by_tambon.json","w",encoding="utf-8"), ensure_ascii=False, indent=1)
json.dump(detail, open("admin_pop_detail.json","w",encoding="utf-8"), ensure_ascii=False)
print(f"\nTAMBONS covered: {len(rows)}", flush=True)
print(f"GRAND TOTAL: {grand:,}  (target province total = 1,645,985; diff={grand-1645985})", flush=True)

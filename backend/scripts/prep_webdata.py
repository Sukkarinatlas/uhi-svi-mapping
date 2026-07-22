# -*- coding: utf-8 -*-
"""Prepare lightweight web GeoJSON + stats for the CesiumJS app."""
import json, os, shutil, numpy as np
import geopandas as gpd, pandas as pd

# repo root = two levels up from this script (backend/scripts/ -> UHI_WEB/)
BASE=os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
EX=os.path.join(BASE,"data","source"); OUT=os.path.join(BASE,"data","output"); APPD=os.path.join(BASE,"frontend","public","data")
os.makedirs(os.path.join(APPD,"uhi"),exist_ok=True)

# ---------- 1) Chonburi tambons: pop + density, join UHI mean LST per tambon ----------
g=gpd.read_file(os.path.join(OUT,"Chonburi_Population_Tambon_Dec2568.geojson")).to_crs(4326)
# zonal mean LST per tambon
import rasterio
from rasterio.mask import mask as rmask
lstv=[]
with rasterio.open(os.path.join(OUT,"uhi","LST.tif")) as ds:
    nod=ds.nodata
    for geom in g.geometry:
        try:
            out,_=rmask(ds,[geom.__geo_interface__],crop=True,filled=True)
            a=out[0].astype(float); a=a[(a!=nod)&np.isfinite(a)]
            lstv.append(float(np.nanmean(a)) if a.size else None)
        except Exception:
            lstv.append(None)
g["lst_mean"]=[round(v,2) if v is not None else None for v in lstv]
# tidy props
g["density"]=g["pop_density"].round(1)
keep=["code6","amphoe_th","tambon_th","tambon_en","male","female","total_pop","area_km2","density","lst_mean","geometry"]
g=g[keep].copy()
g["geometry"]=g.geometry.simplify(0.0004, preserve_topology=True)
g.to_file(os.path.join(APPD,"chonburi_tambons.geojson"),driver="GeoJSON")
print("tambons:",len(g),"->",os.path.getsize(os.path.join(APPD,"chonburi_tambons.geojson"))//1024,"KB")

# ---------- 2) National province boundaries (light) ----------
prov=gpd.read_file(os.path.join(EX,"AdminProvince.shp")).to_crs(4326)
prov=prov.rename(columns={"PROV_CODE":"prov_code","PROV_NAMT":"prov_th","PROV_NAME":"prov_en"})
prov["prov_th"]=prov["prov_th"].astype(str)
prov["geometry"]=prov.geometry.simplify(0.002, preserve_topology=True)
prov[["prov_code","prov_th","prov_en","geometry"]].to_file(os.path.join(APPD,"provinces.geojson"),driver="GeoJSON")
print("provinces:",len(prov),"->",os.path.getsize(os.path.join(APPD,"provinces.geojson"))//1024,"KB")

# Chonburi province outline (for flyTo + mask)
prov[prov["prov_code"]=="20"][["prov_code","prov_th","prov_en","geometry"]].to_file(
    os.path.join(APPD,"chonburi_province.geojson"),driver="GeoJSON")

# ---------- 3) POI ----------
try:
    poi=pd.read_csv(os.path.join(EX,"POI.csv"))
    print("POI cols:",list(poi.columns),"rows:",len(poi))
    poi.to_json(os.path.join(APPD,"poi_raw.json"),orient="records",force_ascii=False)
except Exception as e:
    print("POI skip",e)

# ---------- 4) overview stats for charts ----------
df=pd.DataFrame(g.drop(columns="geometry"))
amp=df.groupby("amphoe_th").agg(tambons=("tambon_th","count"),pop=("total_pop","sum"),
     male=("male","sum"),female=("female","sum"),area=("area_km2","sum"),
     lst=("lst_mean","mean")).reset_index()
amp["density"]=(amp["pop"]/amp["area"]).round(1); amp["lst"]=amp["lst"].round(2)
amp=amp.sort_values("pop",ascending=False)
um=json.load(open(os.path.join(OUT,"uhi","uhi_meta.json")))
stats={
 "province":{"name_th":"ชลบุรี","name_en":"Chon Buri","tambons":int(len(df)),
   "pop_total":int(df["total_pop"].sum()),"male":int(df["male"].sum()),"female":int(df["female"].sum()),
   "area_km2":round(float(df["area_km2"].sum()),1),
   "density":round(float(df["total_pop"].sum()/df["area_km2"].sum()),1),
   "lst_mean":um["lst"]["mean"],"period":um["period"]},
 "by_amphoe":amp.to_dict(orient="records"),
 "uhi_class_counts":um["class_pixel_counts"],
 "top_density":df.nlargest(10,"density")[["tambon_th","amphoe_th","density","total_pop"]].to_dict(orient="records"),
 "top_hot":df.dropna(subset=["lst_mean"]).nlargest(10,"lst_mean")[["tambon_th","amphoe_th","lst_mean","total_pop"]].to_dict(orient="records"),
 "age_note":"registered population, DOPA statMONTH Dec 2568 (2025)"
}
json.dump(stats,open(os.path.join(APPD,"stats.json"),"w",encoding="utf-8"),ensure_ascii=False,indent=1)
print("stats.json written")

# ---------- 5) copy raster overlays ----------
for f in ["LST.png","UTFVI.png","UHI_Class.png","uhi_meta.json"]:
    shutil.copy(os.path.join(OUT,"uhi",f), os.path.join(APPD,"uhi",f))
print("copied UHI overlays")
print("DONE")

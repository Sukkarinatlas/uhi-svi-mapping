# -*- coding: utf-8 -*-
"""Generate LST / UTFVI / UHI-Class for Chonburi from Landsat 8/9 C2 L2 via Planetary
Computer (same ST_B10 data + formulas as the user's GEE script). Outputs GeoTIFF +
colorized PNG overlays (EPSG:4326) + bounds.json for the CesiumJS app."""
import json, os, numpy as np
import geopandas as gpd, rasterio
from rasterio.vrt import WarpedVRT
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio import features
import planetary_computer as pc, pystac_client
from matplotlib.colors import LinearSegmentedColormap, ListedColormap, Normalize
import matplotlib.cm as cm
from PIL import Image

SP=os.path.dirname(os.path.abspath(__file__))
OUT=r"e:\Gistda_GeoAI_VibeCode\GISTDA GeoAI & Vibe Coding - Material-20260713T022955Z-2-001\GISTDA GeoAI & Vibe Coding - Material\UHI_WEB\output\uhi"
os.makedirs(OUT, exist_ok=True)

# ---- AOI + target grid (EPSG:4326, ~150 m) ----
ch=gpd.read_file(os.path.join(SP,"chonburi_prov.geojson")).to_crs(4326)
minx,miny,maxx,maxy=ch.total_bounds
RES=0.0014
minx=np.floor(minx/RES)*RES; miny=np.floor(miny/RES)*RES
maxx=np.ceil(maxx/RES)*RES;  maxy=np.ceil(maxy/RES)*RES
W=int(round((maxx-minx)/RES)); H=int(round((maxy-miny)/RES))
transform=from_origin(minx,maxy,RES,RES)
print(f"target grid {W}x{H} @ {RES} deg", flush=True)

# ---- scenes ----
cat=pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1", modifier=pc.sign_inplace)
items=list(cat.search(collections=["landsat-c2-l2"], bbox=[minx,miny,maxx,maxy],
    datetime="2025-03-01/2025-05-31",
    query={"eo:cloud_cover":{"lt":20},"platform":{"in":["landsat-8","landsat-9"]}}).items())
print("scenes:",len(items), flush=True)

def warp_read(url, resampling):
    with rasterio.open(url) as src:
        with WarpedVRT(src, crs="EPSG:4326", resampling=resampling,
                       transform=transform, width=W, height=H) as vrt:
            return vrt.read(1)

stack=[]
for it in items:
    st=it.assets["lwir11"].href      # ST_B10
    qa=it.assets["qa_pixel"].href
    try:
        dn=warp_read(st, Resampling.bilinear).astype("float32")
        q =warp_read(qa, Resampling.nearest).astype("uint16")
    except Exception as e:
        print("  skip",it.id,str(e)[:60],flush=True); continue
    cloud=(np.bitwise_and(q,1<<3)>0)|(np.bitwise_and(q,1<<4)>0)   # shadow|cloud
    lst=dn*0.00341802+149.0-273.15
    lst[(dn==0)|cloud|(lst<0)|(lst>70)]=np.nan
    stack.append(lst)
    print("  used",it.id,"valid%",round(100*np.isfinite(lst).mean(),1),flush=True)

arr=np.dstack(stack)
lst=np.nanmedian(arr,axis=2).astype("float32")   # median composite (°C)

# ---- mask to Chonburi polygon ----
polymask=features.rasterize([(g,1) for g in ch.geometry], out_shape=(H,W),
                            transform=transform, fill=0, dtype="uint8").astype(bool)
lst[~polymask]=np.nan

# ---- UTFVI + class (same thresholds as GEE code) ----
lstmean=np.nanmean(lst)
print("LST mean (C):",round(float(lstmean),2), flush=True)
utfvi=(lst-lstmean)/lst
cls=np.full(lst.shape, np.nan, dtype="float32")
cls[utfvi<0]=0
cls[(utfvi>=0)&(utfvi<0.005)]=1
cls[(utfvi>=0.005)&(utfvi<0.010)]=2
cls[(utfvi>=0.010)&(utfvi<0.015)]=3
cls[(utfvi>=0.015)&(utfvi<0.020)]=4
cls[utfvi>=0.020]=5
cls[~np.isfinite(lst)]=np.nan

# ---- save GeoTIFFs ----
def save_tif(name, data, dtype="float32"):
    p=os.path.join(OUT,name); nod=-9999.0
    d=np.where(np.isfinite(data), data, nod).astype(dtype)
    with rasterio.open(p,"w",driver="GTiff",height=H,width=W,count=1,dtype=dtype,
                       crs="EPSG:4326",transform=transform,nodata=nod,compress="LZW",tiled=True) as ds:
        ds.write(d,1)
    return p
save_tif("LST.tif",lst); save_tif("UTFVI.tif",utfvi); save_tif("UHI_Class.tif",cls)

# ---- colorized PNG overlays ----
def hexcm(hexes): return LinearSegmentedColormap.from_list("x",["#"+h for h in hexes])
def to_png(data, cmap, vmin, vmax, name):
    norm=Normalize(vmin,vmax); rgba=cmap(norm(data));
    rgba[...,3]=np.where(np.isfinite(data),1.0,0.0)
    img=(rgba*255).astype("uint8"); Image.fromarray(img,"RGBA").save(os.path.join(OUT,name))
def to_png_class(data,name):
    palette=['1a9850','66bd63','fee08b','fdae61','f46d43','d73027']
    cmap=ListedColormap(["#"+h for h in palette])
    idx=np.where(np.isfinite(data),data,0).astype(int).clip(0,5)
    rgba=cmap(idx/5.0); rgba[...,3]=np.where(np.isfinite(data),1.0,0.0)
    Image.fromarray((rgba*255).astype("uint8"),"RGBA").save(os.path.join(OUT,name))
to_png(lst, hexcm(['040274','2b83ba','abdda4','ffffbf','fdae61','d7191c']),25,45,"LST.png")
to_png(utfvi, hexcm(['313695','74add1','fee090','f46d43','a50026']),-0.02,0.03,"UTFVI.png")
to_png_class(cls,"UHI_Class.png")

# stats + bounds for the app
valid=lst[np.isfinite(lst)]
meta={"bounds":{"west":minx,"south":miny,"east":maxx,"north":maxy},
      "lst":{"min":float(np.nanmin(lst)),"max":float(np.nanmax(lst)),"mean":float(lstmean)},
      "utfvi":{"min":float(np.nanmin(utfvi)),"max":float(np.nanmax(utfvi))},
      "class_pixel_counts":{int(k):int((cls==k).sum()) for k in range(6)},
      "period":"2025-03-01..2025-05-31","scenes":len(stack),"res_deg":RES}
json.dump(meta, open(os.path.join(OUT,"uhi_meta.json"),"w"), indent=1)
print("DONE. LST range %.1f..%.1f mean %.1f"%(valid.min(),valid.max(),lstmean), flush=True)
print("class counts:",meta["class_pixel_counts"], flush=True)

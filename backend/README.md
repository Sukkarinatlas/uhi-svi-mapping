# Backend — Data Pipeline (Python)

สคริปต์ที่ใช้สร้างข้อมูลให้ frontend (รันครั้งเดียวเพื่อเตรียมข้อมูล ไม่ใช่ API แบบ realtime)

```bash
python -m venv .venv && .venv\Scripts\activate   # (Windows)
pip install -r requirements.txt
```

## ลำดับการทำงาน (pipeline)
| # | สคริปต์ | หน้าที่ | อ่าน | เขียน |
|---|---|---|---|---|
| 1 | `scripts/sweep_admin.py` | ดึงประชากรรายตำบล ชลบุรี (DOPA statMONTH ธ.ค. 2568) แบบครบทุก อปท. รวมเข้าตำบล → ตรวจยอดรวม = 1,645,985 | DOPA API + `data/source` | `admin_pop_final.json` |
| 2 | `scripts/uhi_generate.py` | สร้าง LST/UTFVI/UHI-Class จาก Landsat 8/9 C2 L2 (Planetary Computer) สูตรเดียวกับ GEE | Landsat (STAC) + ขอบเขตชลบุรี | `data/output/uhi/*.png,*.tif` |
| 3 | `scripts/build_outputs.py` | รวมประชากร+ขอบเขต → Excel + GeoTIFF ความหนาแน่น 1 กม. (EPSG:4326) | ผลข้อ 1–2 | `data/output/*.xlsx,*.tif,*.geojson` |
| 4 | `scripts/prep_webdata.py` | ทำข้อมูลเบา ๆ สำหรับเว็บ (GeoJSON/สถิติ) + คัดลอก overlay | `data/output`, `data/source` | `frontend/public/data/*` |

> หมายเหตุ
> - GEE เดิมหมดอายุ จึงใช้ **Microsoft Planetary Computer** (Landsat C2 L2, ST_B10) ให้ผลเทียบเท่าโค้ด GEE
> - `sweep_admin.py` ต้องมีไฟล์รายการหน่วย อปท. (`chonburi_raw.json` จาก DOPA `list?action=2&cc=20`) และแคชคำตอบใน `cache_admin/`
> - `harvest_admin.py`, `repair_admin.py` เป็นเวอร์ชันก่อนหน้าของการดึงประชากร (เก็บไว้อ้างอิง) — เวอร์ชันที่ใช้จริงคือ `sweep_admin.py`
> - แหล่งข้อมูลขอบเขต: `data/source/` (AdminProvince/Amphoe/Tambon .shp, EPSG:32647)

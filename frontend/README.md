# Urban Heat Island &amp; Social Vulnerability Mapping (UHI · SVI)

แอปพลิเคชันแผนที่ 3D วิเคราะห์เกาะความร้อนเมือง (LST/UTFVI/UHI) ซ้อนทับความหนาแน่นประชากรรายตำบล
เพื่อชี้เป้าพื้นที่วิกฤตทางความร้อนที่มีความเปราะบางทางสังคมสูง — พื้นที่ศึกษา: **จังหวัดชลบุรี**

Stack: **Vite + CesiumJS + Tailwind CSS + ECharts**

## การใช้งาน

```bash
npm install
npm run dev        # เปิด http://localhost:5173
npm run build      # สร้าง production ที่ dist/
npm run preview    # ทดสอบ production build
```

- `index.html` — หน้า Story (ที่มา/วิธีการ/แหล่งข้อมูล)
- `map.html` — แอปแผนที่ (เปิดได้จากปุ่ม “เปิดแผนที่”)
- `map.html?dash=1` — เปิดพร้อมแดชบอร์ด

## ฟีเจอร์แผนที่
- เลเยอร์: UHI Class, UTFVI, LST, ความหนาแน่นประชากรรายตำบล, ขอบเขตจังหวัด (ทั้งประเทศ), POI — เปิด/ปิด + ปรับความทึบ + Legend
- แผนที่ฐาน: OSM, OpenTopoMap, Carto Dark, **Sphere Hybrid (GISTDA)**
- เลือกจังหวัด + บินไปยังพื้นที่ (มุมมองเอียง 3D), ปุ่มสลับ 2D/3D, โหมด 3D ยกสูงตามความหนาแน่น
- คลิกดูรายละเอียดตำบล (popup) + แดชบอร์ดกราฟ (ECharts) ทั้งภาพรวมและรายตำบล
- ค้นหาตำบล/อำเภอ, วัดระยะทาง, พิมพ์/บันทึกภาพแผนที่

## ข้อมูล (`public/data/`)
| ไฟล์ | คำอธิบาย |
|---|---|
| `uhi/LST.png · UTFVI.png · UHI_Class.png` | เลเยอร์ความร้อน (EPSG:4326) จาก Landsat 8/9 C2 L2 ผ่าน Microsoft Planetary Computer (สูตรเดียวกับสคริปต์ GEE), มี.ค.–พ.ค. 2025 |
| `chonburi_tambons.geojson` | 92 ตำบล + ประชากร/ความหนาแน่น (DOPA ธ.ค. 2568) + LST เฉลี่ยรายตำบล |
| `provinces.geojson` | ขอบเขต 77 จังหวัด (GISTDA) |
| `poi_raw.json` | จุดสนใจ (POI) |
| `stats.json` | สถิติสรุปสำหรับแดชบอร์ด |

## หมายเหตุ
- ข้อมูล UHI และประชากรรายตำบลครบเฉพาะ **จังหวัดชลบุรี**; จังหวัดอื่นแสดงเฉพาะขอบเขต (โครงรองรับทั้งประเทศ)
- ประชากรรวมทั้งจังหวัด 1,645,985 คน (ตรวจสอบตรงกับยอดรวม DOPA)
- ไม่ใช้ Cesium ion token (ใช้ imagery provider ฟรี) — ทำงานได้ทันทีหลัง `npm install`

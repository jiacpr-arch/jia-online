// deploy ตรงชั่วคราวระหว่างบัญชี GitHub ถูกระงับ: รูป/ไฟล์ binary ใน public ไม่ได้อัปโหลดมากับ
// deployment (ใหญ่เกิน) — ดึงไฟล์เดิมจาก production ปัจจุบันมาใส่ public/ ก่อน vite build แทน
// รายชื่อไฟล์อยู่ใน scripts/binary-assets.txt (ตัด public/ads/* ที่ไม่ถูกใช้ในเว็บออก)
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const ORIGIN = "https://cpr.morroo.com";
const list = readFileSync("scripts/binary-assets.txt", "utf8").trim().split("\n").filter(Boolean);
let failed = 0;
await Promise.all(list.map(async (p) => {
  const url = `${ORIGIN}/${p.replace(/^public\//, "")}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = Buffer.from(await res.arrayBuffer());
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, buf);
    console.log(`ok  ${p} (${buf.length}b)`);
  } catch (e) {
    failed++;
    console.error(`FAIL ${p}: ${e.message}`);
  }
}));
if (failed) { console.error(`${failed}/${list.length} assets failed — abort build`); process.exit(1); }
console.log(`fetched ${list.length} assets`);

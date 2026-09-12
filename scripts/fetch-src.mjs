// deploy ตรงชั่วคราวระหว่างบัญชี GitHub ถูกระงับ: ซอร์สโค้ดถูกฝากเป็น chunk base64
// ในตาราง Supabase deploy_chunks (อ่านได้ด้วย anon key) — ประกอบกลับ ตรวจ md5 แล้วแตก tar ก่อน build
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const URL_ = "https://tpoiyykbgsgnrdwzgzvn.supabase.co/rest/v1/deploy_chunks?select=id,data&order=id.asc&limit=1000";
const KEY = "sb_publishable_1kXSE788PB9XqH_2vU3pqg_6xtqI1Mf";
const EXPECT_MD5 = "39e6a63bf9d938825597302f2133ba82";

const res = await fetch(URL_, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
if (!res.ok) { console.error(`fetch chunks failed: HTTP ${res.status}`); process.exit(1); }
const rows = await res.json();
console.log(`chunks: ${rows.length}`);
const b64 = rows.map((r) => r.data).join("");
const buf = Buffer.from(b64, "base64");
const md5 = createHash("md5").update(buf).digest("hex");
if (md5 !== EXPECT_MD5) { console.error(`md5 mismatch: ${md5} != ${EXPECT_MD5} — abort`); process.exit(1); }
writeFileSync("src.tar.gz", buf);
execSync("tar xzf src.tar.gz", { stdio: "inherit" });
console.log("source extracted, md5 verified");

// แท็บแอดมินของระบบที่เพิ่มรอบ "ระบบแนะนำเพิ่ม" (ชวนเพื่อน, พอร์ทัล HR, ใบกำกับภาษี, รีวิว)
// ข้อมูลทั้งหมดผ่าน admin-api (service role หลังตรวจรหัสแอดมิน) — ต้องมีชื่อตารางใน ALLOW ของ admin-api
import { useState, useEffect, useCallback } from "react";
import { B, css, adminRest, REFERRAL_REWARD_TEXT } from "../lib/core";

const th = { padding: "10px 12px", textAlign: "left", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", borderTop: `1px solid ${B.ltGray}`, verticalAlign: "top" };
const fmtDate = (v) => (v ? new Date(v).toLocaleString("th-TH", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—");
const Table = ({ head, children, empty }) => (
  <div style={{ overflowX: "auto", background: B.white, borderRadius: 12 }}>
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead><tr style={{ background: B.gray }}>{head.map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
      <tbody>{children}{empty && <tr><td colSpan={head.length} style={{ ...td, textAlign: "center", color: B.dkGray, padding: 24 }}>{empty}</td></tr>}</tbody>
    </table>
  </div>
);
const Note = ({ children }) => <div style={{ fontSize: 12.5, color: B.dkGray, lineHeight: 1.6, marginBottom: 12 }}>{children}</div>;

// ==================== ชวนเพื่อน (referral leaderboard) ====================
export function ReferralReport() {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    (async () => {
      const [codes, events] = await Promise.all([
        adminRest("referral_codes", "GET", null, "?select=code,created_at,customers(name,tel)&limit=10000"),
        adminRest("referral_events", "GET", null, "?select=code,kind,amount,discount,created_at&order=created_at.desc&limit=10000"),
      ]);
      const agg = new Map();
      for (const c of Array.isArray(codes) ? codes : []) agg.set(c.code, { ...c, signups: 0, purchases: 0, revenue: 0, discount: 0, last: null });
      for (const e of Array.isArray(events) ? events : []) {
        const r = agg.get(e.code); if (!r) continue;
        if (e.kind === "signup") r.signups++;
        if (e.kind === "purchase") { r.purchases++; r.revenue += Number(e.amount || 0); r.discount += Number(e.discount || 0); }
        if (!r.last || e.created_at > r.last) r.last = e.created_at;
      }
      setRows([...agg.values()].filter((r) => r.signups || r.purchases).sort((a, b) => b.purchases - a.purchases || b.signups - a.signups));
    })();
  }, []);
  if (!rows) return <div style={{ padding: 20, color: B.dkGray }}>กำลังโหลด...</div>;
  const tot = rows.reduce((t, r) => ({ s: t.s + r.signups, p: t.p + r.purchases, rev: t.rev + r.revenue }), { s: 0, p: 0, rev: 0 });
  return <div>
    <Note>ผู้เรียนที่มีเพื่อนสมัคร/ซื้อผ่านลิงก์ชวน (เรียงตามยอดซื้อ) · ส่วนลดเพื่อนคำนวณใน stripe-checkout อัตโนมัติ · รางวัลผู้ชวนมอบเองตามนโยบาย: “{REFERRAL_REWARD_TEXT}”</Note>
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      {[["เพื่อนสมัคร", tot.s], ["เพื่อนซื้อ", tot.p], ["ยอดขายจากการชวน", `฿${tot.rev.toLocaleString()}`]].map(([l, v]) => <div key={l} style={{ ...css.card, padding: 14, minWidth: 140 }}><div style={{ fontSize: 12, color: B.dkGray }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div></div>)}
    </div>
    <Table head={["ผู้ชวน", "เบอร์", "โค้ด", "เพื่อนสมัคร", "เพื่อนซื้อ", "ยอดขาย", "ล่าสุด"]} empty={!rows.length && "ยังไม่มีการชวนเพื่อน"}>
      {rows.map((r) => <tr key={r.code}>
        <td style={{ ...td, fontWeight: 600 }}>{r.customers?.name || "—"}</td><td style={td}>{r.customers?.tel || "—"}</td>
        <td style={{ ...td, fontFamily: "monospace" }}>{r.code}</td><td style={td}>{r.signups}</td>
        <td style={{ ...td, fontWeight: 700, color: r.purchases >= 3 ? B.green : B.black }}>{r.purchases}</td>
        <td style={td}>฿{r.revenue.toLocaleString()}</td><td style={td}>{fmtDate(r.last)}</td>
      </tr>)}
    </Table>
  </div>;
}

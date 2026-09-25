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

// ==================== พอร์ทัล HR: สร้าง/เพิกถอนลิงก์ของบริษัท (ใช้ในแท็บ "รายงานคะแนน (บริษัท)") ====================
const genPortalToken = () => {
  const a = new Uint8Array(24); crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); // 32 ตัว base64url
};
export function CompanyPortalLinks({ company }) {
  const [links, setLinks] = useState([]);
  const [days, setDays] = useState(180);
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(null);
  const reload = useCallback(async () => {
    if (!company) { setLinks([]); return; }
    const r = await adminRest("company_portal_links", "GET", null, `?company=eq.${encodeURIComponent(company)}&select=*&order=created_at.desc`);
    setLinks(Array.isArray(r) ? r : []);
  }, [company]);
  useEffect(() => { reload(); }, [reload]);
  const url = (t) => `${window.location.origin}/org/${t}`;
  const create = async () => {
    setBusy(true);
    const expires = Number(days) > 0 ? new Date(Date.now() + Number(days) * 86400000).toISOString() : null;
    const r = await adminRest("company_portal_links", "POST", { token: genPortalToken(), company, label: label.trim() || null, expires_at: expires });
    setBusy(false); setLabel("");
    if (!Array.isArray(r) || !r.length) alert("สร้างลิงก์ไม่สำเร็จ (ตรวจว่า apply migration company_portal แล้ว และ admin-api อนุญาตตาราง company_portal_links)");
    reload();
  };
  const revoke = async (t) => { if (!confirm("เพิกถอนลิงก์นี้? HR จะเปิดดูไม่ได้อีก")) return; await adminRest("company_portal_links", "PATCH", { revoked_at: new Date().toISOString() }, `?token=eq.${encodeURIComponent(t)}`); reload(); };
  const copy = async (t) => { try { await navigator.clipboard.writeText(url(t)); setCopied(t); setTimeout(() => setCopied(null), 2000); } catch (e) { prompt("คัดลอกลิงก์", url(t)); } };
  if (!company) return null;
  const active = (l) => !l.revoked_at && (!l.expires_at || new Date(l.expires_at) > new Date());
  return <div style={{ ...css.card, padding: 16, marginBottom: 14 }}>
    <div style={{ fontWeight: 800, marginBottom: 4 }}>ลิงก์พอร์ทัลสำหรับ HR — {company}</div>
    <Note>ส่งลิงก์ให้ฝ่าย HR เปิดดูความคืบหน้า/คะแนนพนักงานได้เอง (เห็นเบอร์แค่ 4 ตัวท้าย ไม่เห็นอีเมล) ดาวน์โหลด CSV ได้ · เพิกถอนได้ทุกเมื่อ</Note>
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="หมายเหตุ เช่น ชื่อผู้ติดต่อ HR" style={{ flex: "1 1 200px", padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
      <select value={days} onChange={(e) => setDays(e.target.value)} style={{ padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}>
        <option value={30}>ใช้ได้ 30 วัน</option><option value={90}>ใช้ได้ 90 วัน</option><option value={180}>ใช้ได้ 180 วัน</option><option value={365}>ใช้ได้ 1 ปี</option><option value={0}>ไม่หมดอายุ</option>
      </select>
      <button onClick={create} disabled={busy} style={{ ...css.btn(B.red, B.white), padding: "8px 16px", fontSize: 13 }}>{busy ? "กำลังสร้าง..." : "สร้างลิงก์ใหม่"}</button>
    </div>
    {links.length > 0 && <div style={{ marginTop: 12 }}>
      {links.map((l) => <div key={l.token} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "8px 0", borderTop: `1px solid ${B.gray}`, fontSize: 12.5, opacity: active(l) ? 1 : .5 }}>
        <span style={{ fontFamily: "monospace", flex: "1 1 220px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>/org/{l.token.slice(0, 8)}…</span>
        <span style={{ color: B.dkGray }}>{l.label || ""}</span>
        <span style={{ color: B.dkGray }}>{l.revoked_at ? "เพิกถอนแล้ว" : l.expires_at ? `ถึง ${fmtDate(l.expires_at)}` : "ไม่หมดอายุ"} · เปิดดู {l.view_count || 0} ครั้ง</span>
        {active(l) && <><button onClick={() => copy(l.token)} style={{ ...css.btn(B.gray, B.black), padding: "6px 12px", fontSize: 12 }}>{copied === l.token ? "คัดลอกแล้ว" : "คัดลอกลิงก์"}</button>
        <button onClick={() => revoke(l.token)} style={{ ...css.btn(B.white, B.red), padding: "6px 12px", fontSize: 12, border: `1px solid ${B.red}55` }}>เพิกถอน</button></>}
      </div>)}
    </div>}
  </div>;
}

// ==================== คำขอใบกำกับภาษี ====================
// ออกใบจริงใน FlowAccount แล้วกรอกเลขที่ใบที่นี่ → สถานะ "ออกแล้ว" (ส่งให้ลูกค้าทางอีเมล/LINE เอง)
export function TaxInvoiceRequests() {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState("รอออก");
  const reload = useCallback(async () => {
    const r = await adminRest("tax_invoice_requests", "GET", null, `?select=*&order=created_at.desc&limit=500${status ? `&status=eq.${encodeURIComponent(status)}` : ""}`);
    setRows(Array.isArray(r) ? r : []);
  }, [status]);
  useEffect(() => { reload(); }, [reload]);
  const issue = async (r) => {
    const no = prompt(`เลขที่ใบกำกับภาษี (จาก FlowAccount) สำหรับ ${r.name}`, r.invoice_no || "");
    if (no == null) return;
    await adminRest("tax_invoice_requests", "PATCH", { status: "ออกแล้ว", invoice_no: no.trim() || null, issued_at: new Date().toISOString() }, `?id=eq.${r.id}`);
    reload();
  };
  const cancel = async (r) => {
    const note = prompt("เหตุผลที่ยกเลิก (ไม่บังคับ)", "");
    if (note == null) return;
    await adminRest("tax_invoice_requests", "PATCH", { status: "ยกเลิก", admin_note: note || null }, `?id=eq.${r.id}`);
    reload();
  };
  const copy = (r) => { const t = [r.name, `เลขประจำตัวผู้เสียภาษี ${r.tax_id}${r.branch ? ` (${r.branch})` : ""}`, r.address, r.email || "", `ยอด ${r.amount ?? "-"} บาท · บทเรียน ${r.modules || "-"}`].filter(Boolean).join("\n"); try { navigator.clipboard.writeText(t); } catch (e) {} };
  return <div>
    <Note>คำขอจากหน้า “ขอใบกำกับภาษีเต็มรูป” — ยอด/บทเรียนผูกอัตโนมัติถ้าเบอร์ตรงกับการซื้อที่ชำระแล้ว (ช่องยอดว่าง = ต้องตรวจยอดเอง) · กด “คัดลอกข้อมูล” ไปวางใน FlowAccount</Note>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {["รอออก", "ออกแล้ว", "ยกเลิก", ""].map((s) => <button key={s || "all"} onClick={() => setStatus(s)} style={{ ...css.btn(status === s ? B.red : B.white, status === s ? B.white : B.black), padding: "6px 14px", fontSize: 13, border: `1px solid ${B.ltGray}` }}>{s || "ทั้งหมด"}</button>)}
    </div>
    {!rows ? <div style={{ color: B.dkGray }}>กำลังโหลด...</div> :
    <Table head={["วันที่", "ผู้เสียภาษี", "เลขภาษี / สาขา", "ที่อยู่", "ติดต่อ", "ยอด", "สถานะ", ""]} empty={!rows.length && "ไม่มีคำขอ"}>
      {rows.map((r) => <tr key={r.id}>
        <td style={td}>{fmtDate(r.created_at)}</td>
        <td style={{ ...td, fontWeight: 600 }}>{r.name}<div style={{ fontSize: 11, color: B.dkGray }}>{r.buyer_type === "person" ? "บุคคลธรรมดา" : "นิติบุคคล"}</div></td>
        <td style={{ ...td, fontFamily: "monospace" }}>{r.tax_id}<div style={{ fontFamily: "inherit", fontSize: 11, color: B.dkGray }}>{r.branch || ""}</div></td>
        <td style={{ ...td, maxWidth: 260, fontSize: 12 }}>{r.address}</td>
        <td style={{ ...td, fontSize: 12 }}>{r.phone}<br/>{r.email || ""}</td>
        <td style={td}>{r.amount != null ? `฿${r.amount}` : <span style={{ color: B.gold }}>ตรวจเอง</span>}</td>
        <td style={td}>{r.status}{r.invoice_no ? <div style={{ fontSize: 11, fontFamily: "monospace" }}>{r.invoice_no}</div> : null}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          <button onClick={() => copy(r)} style={{ ...css.btn(B.gray, B.black), padding: "6px 10px", fontSize: 12 }}>คัดลอกข้อมูล</button>{" "}
          {r.status === "รอออก" && <><button onClick={() => issue(r)} style={{ ...css.btn(B.green, B.white), padding: "6px 10px", fontSize: 12 }}>ออกแล้ว</button>{" "}
          <button onClick={() => cancel(r)} style={{ ...css.btn(B.white, B.red), padding: "6px 10px", fontSize: 12, border: `1px solid ${B.red}55` }}>ยกเลิก</button></>}
        </td>
      </tr>)}
    </Table>}
  </div>;
}

// ==================== รีวิวคอร์ส (อนุมัติก่อนขึ้นหน้าแรก) ====================
export function ReviewsModeration() {
  const [rows, setRows] = useState(null);
  const [show, setShow] = useState("pending"); // pending | approved | all
  const reload = useCallback(async () => {
    const f = show === "pending" ? "&approved=is.false" : show === "approved" ? "&approved=is.true" : "";
    const r = await adminRest("course_reviews", "GET", null, `?select=*,customers(tel)&order=updated_at.desc&limit=500${f}`);
    setRows(Array.isArray(r) ? r : []);
  }, [show]);
  useEffect(() => { reload(); }, [reload]);
  const setApproved = async (r, v) => { await adminRest("course_reviews", "PATCH", { approved: v }, `?id=eq.${r.id}`); reload(); };
  const del = async (r) => { if (!confirm("ลบรีวิวนี้?")) return; await adminRest("course_reviews", "DELETE", null, `?id=eq.${r.id}`); reload(); };
  return <div>
    <Note>รีวิวจากผู้เรียนที่เรียนจบแล้ว (1 คน 1 รีวิว แก้ไขได้ — แก้แล้วต้องอนุมัติใหม่) · หน้าแรกแสดงเฉพาะที่อนุมัติและมีข้อความ</Note>
    <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
      {[["pending", "รออนุมัติ"], ["approved", "อนุมัติแล้ว"], ["all", "ทั้งหมด"]].map(([k, l]) => <button key={k} onClick={() => setShow(k)} style={{ ...css.btn(show === k ? B.red : B.white, show === k ? B.white : B.black), padding: "6px 14px", fontSize: 13, border: `1px solid ${B.ltGray}` }}>{l}</button>)}
    </div>
    {!rows ? <div style={{ color: B.dkGray }}>กำลังโหลด...</div> :
    <Table head={["วันที่", "ชื่อที่แสดง", "เบอร์", "คะแนน", "ข้อความ", "สถานะ", ""]} empty={!rows.length && "ไม่มีรีวิว"}>
      {rows.map((r) => <tr key={r.id}>
        <td style={td}>{fmtDate(r.updated_at)}</td><td style={{ ...td, fontWeight: 600 }}>{r.display_name}</td><td style={td}>{r.customers?.tel || "—"}</td>
        <td style={{ ...td, color: B.gold, whiteSpace: "nowrap" }}>{"★".repeat(r.rating)}</td>
        <td style={{ ...td, maxWidth: 360 }}>{r.comment || <span style={{ color: B.dkGray }}>(ไม่มีข้อความ)</span>}</td>
        <td style={td}>{r.approved ? "✓ แสดงอยู่" : "รออนุมัติ"}</td>
        <td style={{ ...td, whiteSpace: "nowrap" }}>
          {r.approved ? <button onClick={() => setApproved(r, false)} style={{ ...css.btn(B.gray, B.black), padding: "6px 10px", fontSize: 12 }}>ซ่อน</button>
            : <button onClick={() => setApproved(r, true)} style={{ ...css.btn(B.green, B.white), padding: "6px 10px", fontSize: 12 }}>อนุมัติ</button>}{" "}
          <button onClick={() => del(r)} style={{ ...css.btn(B.white, B.red), padding: "6px 10px", fontSize: 12, border: `1px solid ${B.red}55` }}>ลบ</button>
        </td>
      </tr>)}
    </Table>}
  </div>;
}

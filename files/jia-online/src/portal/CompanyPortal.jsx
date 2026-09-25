// พอร์ทัล HR — cpr.morroo.com/org/<token> (ลิงก์ลับที่แอดมินสร้างให้บริษัท)
// ดึงข้อมูลผ่าน RPC company_portal (SECURITY DEFINER) — token ผิด/หมดอายุ/ถูกเพิกถอน = null
import { useState, useEffect, useMemo } from "react";
import { B, css, COURSE, LINE_URL, Logo, supaRpc, safeTrack, phCapture } from "../lib/core";

const PASS = 80;
const chapters = COURSE.modules.filter((m) => m.vid);
const isDone = (s) => (s.status || "").startsWith("จบคอร์ส") || !!s.completedAt;
const fmt = (v) => (v ? new Date(v).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" }) : "—");

export default function CompanyPortal({ token }) {
  const [data, setData] = useState(undefined); // undefined = loading, null = invalid
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all"); // all | done | progress
  useEffect(() => {
    supaRpc("company_portal", { p_token: token }).then((d) => {
      setData(d && d.company ? d : null);
      if (d?.company) { safeTrack("company_portal_view"); phCapture("company_portal_view", { company: d.company }); }
    });
  }, [token]);

  const students = data?.students || [];
  const stats = useMemo(() => {
    const done = students.filter(isDone);
    const scores = done.map((s) => s.finalScore).filter((x) => typeof x === "number");
    return {
      total: students.length, done: done.length, progress: students.length - done.length,
      rate: students.length ? Math.round((done.length / students.length) * 100) : 0,
      avg: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    };
  }, [students]);
  const shown = students.filter((s) => (filter === "all" || (filter === "done" ? isDone(s) : !isDone(s))) && (!q || (s.name || "").toLowerCase().includes(q.toLowerCase())));

  const exportCSV = () => {
    const esc = (v) => { if (v == null) return ""; const s = String(v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
    const head = ["ชื่อ", "เบอร์", "สถานะ", ...chapters.map((m) => m.short), "สอบปลายภาค", "วันที่ลงทะเบียน", "วันที่เรียนจบ"];
    const body = students.map((s) => [s.name, s.phone, s.status, ...chapters.map((m) => s.chapterScores?.[m.id] ?? ""), s.finalScore ?? "", s.registeredAt || "", s.completedAt || ""].map(esc).join(","));
    const blob = new Blob(["﻿" + head.join(",") + "\n" + body.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `JIA_CPR_${data.company}_${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    safeTrack("company_portal_export");
  };

  if (data === undefined) return <div style={{ ...css.page, display: "flex", alignItems: "center", justifyContent: "center", color: B.dkGray }}>กำลังโหลด...</div>;
  if (data === null) return (
    <div style={{ ...css.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ ...css.card, maxWidth: 420, textAlign: "center" }}>
        <Logo size={120}/>
        <div style={{ fontSize: 18, fontWeight: 800, margin: "16px 0 8px" }}>ลิงก์นี้ใช้ไม่ได้แล้ว</div>
        <div style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6 }}>ลิงก์รายงานอาจหมดอายุหรือถูกยกเลิก กรุณาติดต่อทีม JIA ทาง LINE เพื่อขอลิงก์ใหม่</div>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ ...css.btn("#06C755", B.white, true), marginTop: 16, textAlign: "center" }}>ติดต่อ LINE @jiacpr</a>
      </div>
    </div>
  );

  const Stat = ({ label, value, color }) => <div style={{ ...css.card, padding: 16, flex: "1 1 140px" }}><div style={{ fontSize: 12, color: B.dkGray }}>{label}</div><div style={{ fontSize: 26, fontWeight: 800, color: color || B.black }}>{value}</div></div>;
  const chip = (key, label) => <button key={key} onClick={() => setFilter(key)} style={{ border: `1px solid ${filter === key ? B.red : B.ltGray}`, background: filter === key ? `${B.red}10` : B.white, color: filter === key ? B.red : B.black, borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{label}</button>;

  return (
    <div style={css.page}>
      <div style={{ background: "#0E1E3C", color: B.white, padding: "18px 16px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ fontSize: 12, opacity: .75 }}>รายงานการอบรม CPR & AED ออนไลน์ · JIA TRAINER CENTER</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 2 }}>{data.company}</div>
          {data.label && <div style={{ fontSize: 13, opacity: .85 }}>{data.label}</div>}
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "16px 16px 40px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <Stat label="ผู้เรียนทั้งหมด" value={stats.total}/>
          <Stat label="เรียนจบแล้ว" value={stats.done} color={B.green}/>
          <Stat label="กำลังเรียน" value={stats.progress} color={B.gold}/>
          <Stat label="อัตราเรียนจบ" value={`${stats.rate}%`}/>
          <Stat label="คะแนนปลายภาคเฉลี่ย" value={stats.avg == null ? "—" : `${stats.avg}%`}/>
          {data.vouchers?.issued > 0 && <Stat label="สิทธิ์ที่ใช้แล้ว" value={`${data.vouchers.redeemed}/${data.vouchers.issued}`}/>}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
          {chip("all", `ทั้งหมด (${stats.total})`)}{chip("done", `จบแล้ว (${stats.done})`)}{chip("progress", `กำลังเรียน (${stats.progress})`)}
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อ" style={{ flex: "1 1 160px", minWidth: 0, padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
          <button onClick={exportCSV} disabled={!students.length} style={{ ...css.btn(B.black, B.white), padding: "8px 16px", fontSize: 13 }}>ดาวน์โหลด CSV</button>
        </div>
        <div style={{ overflowX: "auto", background: B.white, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: B.gray, textAlign: "left" }}>
              <th style={{ padding: "10px 12px" }}>ชื่อ</th>
              {chapters.map((m) => <th key={m.id} style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap" }}>{m.short}</th>)}
              <th style={{ padding: "10px 12px", textAlign: "center" }}>ปลายภาค</th>
              <th style={{ padding: "10px 12px" }}>สถานะ</th>
              <th style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>เรียนจบ</th>
            </tr></thead>
            <tbody>
              {shown.map((s, i) => <tr key={i} style={{ borderTop: `1px solid ${B.ltGray}` }}>
                <td style={{ padding: "10px 12px", minWidth: 140 }}><div style={{ fontWeight: 600 }}>{s.name}</div><div style={{ fontSize: 11, color: B.dkGray }}>{s.phone}</div></td>
                {chapters.map((m) => { const v = s.chapterScores?.[m.id]; return <td key={m.id} style={{ padding: "10px 8px", textAlign: "center", color: v == null ? B.ltGray : v >= PASS ? B.green : B.red }}>{v == null ? "—" : `${v}%`}</td>; })}
                <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{s.finalScore != null ? `${s.finalScore}%` : "—"}</td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap", color: isDone(s) ? B.green : B.dkGray }}>{isDone(s) ? "✓ จบแล้ว" : "กำลังเรียน"}</td>
                <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmt(s.completedAt)}</td>
              </tr>)}
              {!shown.length && <tr><td colSpan={4 + chapters.length} style={{ padding: 24, textAlign: "center", color: B.dkGray }}>ไม่พบผู้เรียน</td></tr>}
            </tbody>
          </table>
        </div>
        <div style={{ ...css.card, marginTop: 16, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ flex: "1 1 260px" }}>
            <div style={{ fontWeight: 800, marginBottom: 4 }}>ต้องการสิทธิ์เพิ่ม หรือจัดอบรมภาคปฏิบัติที่บริษัท?</div>
            <div style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.6 }}>ซื้อสิทธิ์เรียนออนไลน์เพิ่มสำหรับพนักงานใหม่ หรือให้ครูฝึกไปสอน CPR & AED กับหุ่นจริงที่สถานที่ของคุณ ออกใบกำกับภาษีในนามบริษัทได้</div>
          </div>
          <a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={() => { safeTrack("company_portal_contact"); phCapture("company_portal_contact", { company: data.company }); }} style={{ ...css.btn("#06C755", B.white), textAlign: "center" }}>คุยกับทีม JIA ทาง LINE</a>
        </div>
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 12, textAlign: "center" }}>ข้อมูลนี้เป็นความลับของบริษัท — โปรดอย่าส่งต่อลิงก์นอกฝ่ายที่เกี่ยวข้อง{data.expiresAt ? ` · ลิงก์ใช้ได้ถึง ${fmt(data.expiresAt)}` : ""}</div>
      </div>
    </div>
  );
}

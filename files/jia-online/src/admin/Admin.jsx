// หน้าแอดมิน (/admin) — โหลดแบบ lazy จาก App.jsx เฉพาะตอนเข้า /admin
import { useState, useEffect, useCallback, useRef } from "react";
import {
  B, SUPABASE_KEY, FN_URL, PRICING, VOUCHER_ALL_MODULES, STANDING_NEVER_EXPIRES, VOUCHER_SOURCES, SITE_URL, PARTNER_SOURCE, genPartnerCode, _adminKey, setAdminKey, adminRest, adminPing, thaiShortDate, genVoucherCode, normalizePhone, save, load, captureNodeToPng, deliverBlob, dataUrlToBlob, COURSE, I, Logo, css,
} from "../lib/core";
import { ReferralReport, CompanyPortalLinks } from "./GrowthPanels";

// ==================== ADMIN ====================
// รหัสแอดมินถูกตรวจฝั่ง server (edge function admin-api ตั้ง ADMIN_API_KEY) — ไม่มีความลับในบันเดิลแล้ว
const ADMIN_SESSION_KEY = "jia_admin_auth";

const TABS = [
  { key: "pipeline",        label: "Pipeline (jiaroo)", custom: true },
  { key: "dashboard",       label: "Dashboard",         custom: true },
  { key: "team",            label: "ทีมเซลล์",         custom: true },
  { key: "online_students", label: "นักเรียนออนไลน์", cols: ["name","phone","email","company","pre_course","status","final_score","coupon_code","registered_at"] },
  { key: "customers",       label: "ลูกค้าทั้งหมด",   cols: ["name","tel","email","source","created_at"] },
  { key: "bookings",        label: "การจอง On-site", cols: ["name","tel","course_name","start_date","time_slot","total_people","final_price","payment_status","created_at"] },
  { key: "sales_tracking",  label: "ติดตามขาย",      cols: ["name","phone","score","coupon_code","follow_status","completed_date"] },
  { key: "online_purchases",label: "การซื้อออนไลน์", cols: ["phone","modules","amount","payment_status","slip_url"] },
  { key: "lead_promo_codes",label: "โค้ดส่วนลด Lead", cols: ["code","name","phone","email","line_id","source","company","unlock_modules","multi_use","created_at","expires_at","redeemed_at","email_sent_status"] },
  { key: "voucher_issue",   label: "ออก Voucher",      custom: true },
  { key: "partner_coupons", label: "คูปองพาร์ทเนอร์ (QR)", custom: true },
  { key: "company_report",  label: "รายงานคะแนน (บริษัท)", custom: true },
  { key: "referrals",       label: "ชวนเพื่อน",        custom: true },
  { key: "game_chars",      label: "รูปตัวละครเกม",   custom: true },
];

// ==================== JIAROO CRM ====================
const JIAROO_TENANT = "jiaroo";
const STAGES = [
  { key: "new",       label: "ใหม่",         color: "#94A3B8" },
  { key: "called",    label: "โทรแล้ว",     color: "#3B82F6" },
  { key: "scheduled", label: "นัดคุย",       color: "#8B5CF6" },
  { key: "quoted",    label: "เสนอราคา",    color: "#F59E0B" },
  { key: "deciding",  label: "รอตัดสินใจ",  color: "#EAB308" },
  { key: "won",       label: "ปิดดีล",       color: "#22C55E" },
  { key: "lost",      label: "ไม่สนใจ",     color: "#94A3B8" },
];
const STAGE_BY_KEY = Object.fromEntries(STAGES.map(s => [s.key, s]));
const fmtDT = (v) => v ? new Date(v).toLocaleString("th-TH", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" }) : "—";

function Pipeline() {
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filterAssignee, setFilterAssignee] = useState(() => load("pipeline_filter", "mine"));
  const [stuckOnly, setStuckOnly] = useState(false);
  const [filterTag, setFilterTag] = useState("all");
  const [selected, setSelected] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [meId, setMeId] = useState(() => load("pipeline_me", ""));
  const [toast, setToast] = useState(null);

  const showToast = (msg, kind = "ok") => {
    setToast({ msg, kind });
    setTimeout(() => setToast(null), 3000);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    const [l, t] = await Promise.all([
      adminRest("jiaroo_leads", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=updated_at.desc&limit=2000`),
      adminRest("jiaroo_team",  "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&active=eq.true&order=name.asc`),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setTeam(Array.isArray(t) ? t : []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  // Auto-refresh every 30s to catch newly claimed leads / new leads
  useEffect(() => {
    const id = setInterval(reload, 30000);
    return () => clearInterval(id);
  }, [reload]);

  useEffect(() => { save("pipeline_filter", filterAssignee); }, [filterAssignee]);
  useEffect(() => { save("pipeline_me", meId); }, [meId]);

  const me = team.find(t => t.id === meId);

  const hoursSince = (iso) => iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : 0;
  const isStuck = (l) => l.stage !== "won" && l.stage !== "lost" && hoursSince(l.updated_at) >= 24;
  const parseTags = (s) => (s || "").split(/[,\s]+/).map(t => t.trim()).filter(Boolean);
  const tagColor = (t) => {
    let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    const palette = ["#3B82F6","#8B5CF6","#EC4899","#F59E0B","#10B981","#06B6D4","#EF4444","#84CC16"];
    return palette[Math.abs(h) % palette.length];
  };
  const allTags = Array.from(new Set(leads.flatMap(l => parseTags(l.tags)))).sort();

  const filtered = leads.filter(l => {
    if (filterAssignee === "mine") {
      if (!meId || l.assignee_id !== meId) return false;
    } else if (filterAssignee === "unassigned") {
      if (l.assignee_id) return false;
    } else if (filterAssignee !== "all") {
      if (l.assignee_id !== filterAssignee) return false;
    }
    if (stuckOnly && !isStuck(l)) return false;
    if (filterTag !== "all") {
      const tags = parseTags(l.tags);
      if (!tags.includes(filterTag)) return false;
    }
    if (search) {
      const s = search.toLowerCase();
      const hay = [l.name, l.display_name, l.phone, l.email, l.notes, l.tags].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });

  const byStage = STAGES.reduce((acc, s) => { acc[s.key] = filtered.filter(l => l.stage === s.key); return acc; }, {});
  const teamById = Object.fromEntries(team.map(t => [t.id, t]));

  const moveStage = async (lead, newStage) => {
    if (lead.stage === newStage) return;
    const prev = lead.stage;
    setLeads(rs => rs.map(r => r.id === lead.id ? { ...r, stage: newStage } : r));
    await adminRest("jiaroo_leads", "PATCH", { stage: newStage }, `?id=eq.${lead.id}`);
    await adminRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "stage_change", data: { from: prev, to: newStage }, created_by: me?.name || "admin" });
  };

  // Optimistic claim — only succeeds if lead is still unassigned
  const claim = async (e, lead) => {
    e.stopPropagation();
    if (!meId) { showToast("เลือก \"ฉันคือ\" ก่อน", "warn"); return; }
    if (lead.assignee_id) { showToast("มีคนรับไปแล้ว", "warn"); return; }
    const result = await adminRest("jiaroo_leads", "PATCH", { assignee_id: meId }, `?id=eq.${lead.id}&assignee_id=is.null`);
    if (Array.isArray(result) && result.length > 0) {
      setLeads(rs => rs.map(r => r.id === lead.id ? { ...r, assignee_id: meId } : r));
      await adminRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "claim", data: { by: meId, name: me?.name }, created_by: me?.name || "admin" });
      showToast(`✓ รับ ${lead.name || lead.display_name || "lead"} แล้ว`, "ok");
    } else {
      showToast("ช้าไป! คนอื่นรับไปก่อนแล้ว", "warn");
      reload();
    }
  };

  const newCount = leads.filter(l => !l.assignee_id && l.stage === "new").length;

  const exportCSV = () => {
    const cols = ["display_name","name","phone","email","stage","assignee","tags","product_interest","deal_value","source","last_message_preview","created_at","updated_at"];
    const esc = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const rows = filtered.map(l => cols.map(c => {
      if (c === "assignee") return esc(teamById[l.assignee_id]?.name);
      if (c === "stage") return esc(STAGE_BY_KEY[l.stage]?.label || l.stage);
      return esc(l[c]);
    }).join(","));
    const csv = "﻿" + cols.join(",") + "\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jiaroo_leads_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      {/* "Me" selector — each sales picks themselves once */}
      <div style={{ background: meId ? `${B.green}10` : `${B.gold}10`, border: `1px solid ${meId ? B.green : B.gold}40`, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: meId ? B.green : B.gold }}>{meId ? "👤 ฉันคือ" : "⚠ เลือกชื่อตัวเองก่อนเริ่มรับลูกค้า"}</div>
        <select value={meId} onChange={e => setMeId(e.target.value)} style={{ padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white, fontWeight: 600 }}>
          <option value="">— เลือก —</option>
          {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {me?.picture_url && <img src={me.picture_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover" }}/>}
        {newCount > 0 && <div style={{ marginLeft: "auto", background: B.red, color: B.white, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700 }}>🔔 {newCount} lead รอรับ</div>}
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ค้นหา ชื่อ / เบอร์ / โน้ต / แท็ก" style={{ flex: "1 1 220px", padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
        <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
          <option value="mine">ของฉัน</option>
          <option value="unassigned">ยังไม่มีคนรับ</option>
          <option value="all">ทั้งหมด</option>
          <optgroup label="— ตามคน —">
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </optgroup>
        </select>
        <button onClick={() => setStuckOnly(s => !s)} style={{ background: stuckOnly ? B.red : B.white, color: stuckOnly ? B.white : B.red, border: `1px solid ${B.red}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>🔥 ค้างเกิน 24 ชม</button>
        {allTags.length > 0 && (
          <select value={filterTag} onChange={e => setFilterTag(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
            <option value="all">ทุกแท็ก</option>
            {allTags.map(t => <option key={t} value={t}>🏷 {t}</option>)}
          </select>
        )}
        <button onClick={exportCSV} disabled={!filtered.length} style={{ background: B.white, color: B.green, border: `1px solid ${B.green}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5 }}>⬇ CSV</button>
        <button onClick={() => setShowNew(true)} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ เพิ่ม Lead</button>
        <button onClick={reload} style={{ background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "10px 14px", fontSize: 13, cursor: "pointer" }}>↻</button>
        <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{filtered.length} / {leads.length} leads</div>
      </div>

      {loading ? (
        <div style={{ background: B.white, padding: 40, borderRadius: 12, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>
      ) : (
        <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 12 }}>
          {STAGES.map(s => (
            <div key={s.key}
              onDragOver={e => { e.preventDefault(); if (dragOverStage !== s.key) setDragOverStage(s.key); }}
              onDragLeave={() => setDragOverStage(null)}
              onDrop={e => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain");
                const lead = leads.find(l => l.id === id);
                if (lead) moveStage(lead, s.key);
                setDragOverStage(null);
              }}
              style={{ minWidth: 260, flex: "0 0 260px", background: dragOverStage === s.key ? `${s.color}22` : B.gray, borderRadius: 12, padding: 10, transition: "background .15s", outline: dragOverStage === s.key ? `2px dashed ${s.color}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }}/>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{s.label}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{byStage[s.key].length}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: "calc(100vh - 320px)", overflowY: "auto" }}>
                {byStage[s.key].length === 0 ? (
                  <div style={{ fontSize: 12, color: B.dkGray, padding: 12, textAlign: "center" }}>—</div>
                ) : byStage[s.key].map(l => {
                  const a = l.assignee_id ? teamById[l.assignee_id] : null;
                  const isMine = l.assignee_id === meId;
                  const unclaimed = !l.assignee_id;
                  const h = hoursSince(l.updated_at);
                  const closed = l.stage === "won" || l.stage === "lost";
                  const ageColor = closed ? null : h >= 72 ? B.red : h >= 24 ? B.gold : null;
                  const ageLabel = h < 1 ? "เพิ่ง" : h < 24 ? `${Math.floor(h)} ชม` : `${Math.floor(h / 24)} วัน`;
                  return (
                    <div key={l.id}
                      draggable
                      onDragStart={e => { e.dataTransfer.setData("text/plain", l.id); e.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => setSelected(l)}
                      style={{ background: B.white, borderRadius: 10, padding: 10, cursor: "grab", boxShadow: "0 1px 3px rgba(0,0,0,.05)", borderLeft: `3px solid ${s.color}`, position: "relative", outline: isMine ? `2px solid ${B.green}` : "none" }}>
                      {ageColor && <div title={`อัปเดตล่าสุด ${ageLabel}ที่แล้ว`} style={{ position: "absolute", top: 8, right: 8, background: ageColor, color: B.white, padding: "1px 6px", borderRadius: 999, fontSize: 9, fontWeight: 700 }}>{h >= 72 ? "🔥" : "⚠"} {ageLabel}</div>}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", paddingRight: ageColor ? 60 : 0 }}>
                        {l.picture_url && <img src={l.picture_url} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}/>}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.name || l.display_name || "(ไม่มีชื่อ)"}</div>
                          {l.phone && <div style={{ fontSize: 11, color: B.dkGray }}>{l.phone}</div>}
                        </div>
                      </div>
                      {l.last_message_preview && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>💬 {l.last_message_preview}</div>}
                      {parseTags(l.tags).length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 6 }}>
                          {parseTags(l.tags).slice(0, 4).map(t => (
                            <span key={t} style={{ background: `${tagColor(t)}20`, color: tagColor(t), padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600 }}>{t}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, gap: 6 }}>
                        {unclaimed ? (
                          <button onClick={e => claim(e, l)} disabled={!meId} style={{ background: meId ? B.red : B.ltGray, color: B.white, border: "none", borderRadius: 6, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: meId ? "pointer" : "not-allowed", flex: 1 }}>🤚 รับ Lead</button>
                        ) : (
                          <span style={{ fontSize: 11, color: isMine ? B.green : B.dkGray, fontWeight: isMine ? 700 : 400 }}>{isMine ? "✓ ของฉัน" : `👤 ${a?.name || "—"}`}</span>
                        )}
                        <span style={{ fontSize: 10, color: B.dkGray }}>{fmtDT(l.updated_at)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: toast.kind === "warn" ? B.gold : B.green, color: B.white, padding: "12px 24px", borderRadius: 999, fontSize: 14, fontWeight: 700, boxShadow: "0 4px 16px rgba(0,0,0,.2)", zIndex: 2000 }}>{toast.msg}</div>
      )}

      {selected && <LeadDetail lead={selected} team={team} onClose={() => setSelected(null)} onChange={reload} onStage={moveStage}/>}
      {showNew && <LeadNew team={team} onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); reload(); }}/>}
    </div>
  );
}

function LeadDetail({ lead, team, onClose, onChange, onStage }) {
  const [form, setForm] = useState({
    name: lead.name || "",
    phone: lead.phone || "",
    email: lead.email || "",
    notes: lead.notes || "",
    tags: lead.tags || "",
    product_interest: lead.product_interest || "",
    deal_value: lead.deal_value || "",
    assignee_id: lead.assignee_id || "",
    stage: lead.stage,
  });
  const [events, setEvents] = useState([]);
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState("chat");
  const [saving, setSaving] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteSaving, setNoteSaving] = useState(false);

  const reloadEvents = useCallback(() => {
    adminRest("jiaroo_lead_events", "GET", null, `?lead_id=eq.${lead.id}&order=created_at.desc&limit=100`).then(r => setEvents(Array.isArray(r) ? r : []));
  }, [lead.id]);

  useEffect(() => {
    reloadEvents();
    adminRest("jiaroo_messages", "GET", null, `?lead_id=eq.${lead.id}&order=created_at.asc&limit=500`).then(r => setMessages(Array.isArray(r) ? r : []));
  }, [lead.id, reloadEvents]);

  const addNote = async () => {
    const txt = noteText.trim();
    if (!txt) return;
    setNoteSaving(true);
    await adminRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "note", data: { text: txt }, created_by: "admin" });
    setNoteText("");
    setNoteSaving(false);
    reloadEvents();
  };

  const save = async () => {
    setSaving(true);
    const patch = {
      name: form.name || null, phone: form.phone || null, email: form.email || null,
      notes: form.notes || null, tags: form.tags || null,
      product_interest: form.product_interest || null,
      deal_value: form.deal_value === "" ? null : Number(form.deal_value),
      assignee_id: form.assignee_id || null,
      stage: form.stage,
    };
    await adminRest("jiaroo_leads", "PATCH", patch, `?id=eq.${lead.id}`);
    if (form.stage !== lead.stage) {
      await adminRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "stage_change", data: { from: lead.stage, to: form.stage }, created_by: "admin" });
    }
    if (form.assignee_id !== (lead.assignee_id || "")) {
      await adminRest("jiaroo_lead_events", "POST", { lead_id: lead.id, type: "assign", data: { from: lead.assignee_id, to: form.assignee_id || null }, created_by: "admin" });
    }
    setSaving(false);
    onChange();
    onClose();
  };

  const del = async () => {
    if (!confirm("ลบ lead นี้?")) return;
    await adminRest("jiaroo_leads", "DELETE", null, `?id=eq.${lead.id}`);
    onChange();
    onClose();
  };

  const convertToTeam = async () => {
    if (!confirm(`แปลง "${lead.display_name || lead.name}" เป็นสมาชิกทีมเซลล์?\n\nLead นี้จะถูกลบ และเมื่อคนนี้ทักเข้ามาอีก ระบบจะไม่สร้าง lead ใหม่`)) return;
    await adminRest("jiaroo_team", "POST", {
      tenant_slug: JIAROO_TENANT,
      name: lead.display_name || lead.name || "(ไม่มีชื่อ)",
      picture_url: lead.picture_url || null,
      line_user_id: lead.line_user_id || null,
      phone: lead.phone || null,
      email: lead.email || null,
      role: "sales",
      active: true,
    });
    await adminRest("jiaroo_leads", "DELETE", null, `?id=eq.${lead.id}`);
    onChange();
    onClose();
  };

  const Fld = (k, label, type = "text") => (
    <div style={{ marginBottom: 10 }}>
      <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{label}</label>
      {type === "textarea" ? (
        <textarea value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} rows={3} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}/>
      ) : (
        <input type={type} value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", justifyContent: "flex-end" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, width: "100%", maxWidth: 480, height: "100%", overflowY: "auto", padding: 20, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{lead.display_name || lead.name || "Lead"}</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", fontSize: 22, cursor: "pointer", color: B.dkGray }}>×</button>
        </div>
        {lead.line_user_id && <div style={{ fontSize: 11, color: B.dkGray, marginBottom: 10 }}>LINE: {lead.line_user_id}</div>}

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>Stage</label>
          <select value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>มอบหมาย</label>
          <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="">— ยังไม่มอบหมาย —</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>

        {Fld("name", "ชื่อ")}
        {Fld("phone", "เบอร์")}
        {Fld("email", "อีเมล")}
        {Fld("product_interest", "สนใจสินค้า/คอร์ส")}
        {Fld("deal_value", "มูลค่าดีล (บาท)", "number")}
        {Fld("tags", "แท็ก (คั่นด้วย ,)")}
        {Fld("notes", "โน้ต", "textarea")}

        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "กำลังบันทึก..." : "บันทึก"}</button>
          <button onClick={del} style={{ background: B.white, color: B.red, border: `1px solid ${B.red}`, borderRadius: 8, padding: "12px 14px", fontSize: 13, cursor: "pointer" }}>ลบ</button>
        </div>

        {lead.line_user_id && (
          <button onClick={convertToTeam} style={{ width: "100%", background: B.white, color: B.dkGray, border: `1px dashed ${B.ltGray}`, borderRadius: 8, padding: "10px", fontSize: 13, cursor: "pointer", marginTop: 8 }}>
            👤 ทำให้เป็นทีมเซลล์ (ไม่ใช่ลูกค้า)
          </button>
        )}

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", borderBottom: `1px solid ${B.ltGray}`, marginBottom: 12 }}>
            {[
              { k: "chat", l: `💬 แชท (${messages.length})` },
              { k: "notes", l: `📝 โน้ต (${events.filter(e => e.type === "note").length})` },
              { k: "timeline", l: `📋 Timeline (${events.length})` },
            ].map(t => (
              <button key={t.k} onClick={() => setTab(t.k)} style={{ background: "transparent", border: "none", padding: "8px 14px", fontSize: 13, fontWeight: tab === t.k ? 700 : 400, color: tab === t.k ? B.red : B.dkGray, borderBottom: `2px solid ${tab === t.k ? B.red : "transparent"}`, cursor: "pointer", marginBottom: -1 }}>{t.l}</button>
            ))}
          </div>

          {tab === "chat" && (
            messages.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีข้อความ</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 480, overflowY: "auto", background: `${B.gray}80`, borderRadius: 10, padding: 12 }}>
                {(() => {
                  let lastDate = "";
                  return messages.map(m => {
                    const dateStr = new Date(m.created_at).toLocaleDateString("th-TH", { day: "2-digit", month: "short" });
                    const showDate = dateStr !== lastDate;
                    lastDate = dateStr;
                    const inbound = m.direction === "in";
                    return (
                      <div key={m.id}>
                        {showDate && <div style={{ textAlign: "center", fontSize: 10, color: B.dkGray, padding: "8px 0 4px" }}>— {dateStr} —</div>}
                        <div style={{ display: "flex", justifyContent: inbound ? "flex-start" : "flex-end" }}>
                          <div style={{ maxWidth: "78%", background: inbound ? B.white : `${B.green}20`, color: B.black, borderRadius: 12, padding: "8px 12px", fontSize: 13, wordBreak: "break-word", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
                            <div style={{ whiteSpace: "pre-wrap" }}>{m.text || `[${m.message_type}]`}</div>
                            <div style={{ fontSize: 9, color: B.dkGray, marginTop: 4, textAlign: "right" }}>{new Date(m.created_at).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}</div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )
          )}

          {tab === "notes" && (
            <div>
              <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="เขียนโน้ตเกี่ยวกับลูกค้า เช่น คุยอะไรไปแล้ว สิ่งที่ต้องตามต่อ..." rows={2} style={{ flex: 1, padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}/>
                <button onClick={addNote} disabled={!noteText.trim() || noteSaving} style={{ background: B.red, color: B.white, border: "none", borderRadius: 6, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: noteText.trim() ? "pointer" : "not-allowed", opacity: noteText.trim() && !noteSaving ? 1 : 0.5, alignSelf: "stretch" }}>{noteSaving ? "..." : "เพิ่ม"}</button>
              </div>
              {events.filter(e => e.type === "note").length === 0 ? (
                <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีโน้ต — เริ่มจดบันทึกได้เลย</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {events.filter(e => e.type === "note").map(ev => (
                    <div key={ev.id} style={{ padding: 10, background: `${B.gold}10`, border: `1px solid ${B.gold}40`, borderRadius: 8 }}>
                      <div style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{ev.data?.text || ""}</div>
                      <div style={{ color: B.dkGray, fontSize: 11, marginTop: 6 }}>{fmtDT(ev.created_at)} {ev.created_by ? `• ${ev.created_by}` : ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "timeline" && (
            events.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray, padding: 20, textAlign: "center" }}>ยังไม่มีกิจกรรม</div> : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {events.map(ev => {
                  const d = ev.data || {};
                  let label = ev.type;
                  if (ev.type === "stage_change") label = `เปลี่ยน stage: ${STAGE_BY_KEY[d.from]?.label || d.from} → ${STAGE_BY_KEY[d.to]?.label || d.to}`;
                  else if (ev.type === "assign") label = "เปลี่ยนผู้รับผิดชอบ";
                  else if (ev.type === "claim") label = `${d.name || "ใครบางคน"} กดรับ lead`;
                  else if (ev.type === "created") label = `สร้าง lead (${d.source || ""})`;
                  else if (ev.type === "follow") label = "เพิ่มเพื่อน LINE";
                  else if (ev.type === "unfollow") label = "บล็อก / ลบเพื่อน";
                  else if (ev.type === "note") label = `📝 โน้ต: ${(d.text || "").slice(0, 80)}${(d.text || "").length > 80 ? "..." : ""}`;
                  return (
                    <div key={ev.id} style={{ padding: 8, background: B.gray, borderRadius: 8, fontSize: 12 }}>
                      <div style={{ fontWeight: 600 }}>{label}</div>
                      <div style={{ color: B.dkGray, fontSize: 11 }}>{fmtDT(ev.created_at)} {ev.created_by ? `• ${ev.created_by}` : ""}</div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}

function LeadNew({ team, onClose, onCreated }) {
  const [form, setForm] = useState({ name: "", phone: "", email: "", source: "manual", assignee_id: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name && !form.phone) { alert("กรอกชื่อหรือเบอร์อย่างน้อย 1"); return; }
    setSaving(true);
    const res = await adminRest("jiaroo_leads", "POST", {
      tenant_slug: JIAROO_TENANT,
      name: form.name || null,
      phone: form.phone || null,
      email: form.email || null,
      source: form.source,
      assignee_id: form.assignee_id || null,
      notes: form.notes || null,
      stage: "new",
    });
    const id = Array.isArray(res) && res[0]?.id;
    if (id) await adminRest("jiaroo_lead_events", "POST", { lead_id: id, type: "created", data: { source: form.source }, created_by: "admin" });
    setSaving(false);
    onCreated();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, borderRadius: 12, padding: 20, width: "100%", maxWidth: 400 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>เพิ่ม Lead ใหม่</div>
        {["name","phone","email"].map(k => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{k === "name" ? "ชื่อ" : k === "phone" ? "เบอร์" : "อีเมล"}</label>
            <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
          </div>
        ))}
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>แหล่งที่มา</label>
          <select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="manual">เพิ่มเอง</option>
            <option value="line">LINE OA</option>
            <option value="facebook">Facebook</option>
            <option value="phone">โทรเข้า</option>
            <option value="referral">แนะนำ</option>
            <option value="website">เว็บไซต์</option>
          </select>
        </div>
        <div style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>มอบหมาย</label>
          <select value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="">— ยังไม่มอบหมาย —</option>
            {team.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>โน้ต</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={3} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box", fontFamily: "inherit" }}/>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "เพิ่ม"}</button>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [leads, setLeads] = useState([]);
  const [team, setTeam] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState(30);

  const reload = useCallback(async () => {
    setLoading(true);
    const sinceISO = new Date(Date.now() - range * 86400000).toISOString();
    const [l, t, e] = await Promise.all([
      adminRest("jiaroo_leads", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&limit=5000`),
      adminRest("jiaroo_team",  "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=name.asc`),
      adminRest("jiaroo_lead_events", "GET", null, `?created_at=gte.${sinceISO}&order=created_at.desc&limit=200`),
    ]);
    setLeads(Array.isArray(l) ? l : []);
    setTeam(Array.isArray(t) ? t : []);
    setEvents(Array.isArray(e) ? e : []);
    setLoading(false);
  }, [range]);
  useEffect(() => { reload(); }, [reload]);

  if (loading) return <div style={{ background: B.white, padding: 40, borderRadius: 12, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>;

  const sinceMs = Date.now() - range * 86400000;
  const inRange = leads.filter(l => new Date(l.created_at).getTime() >= sinceMs);
  const won = leads.filter(l => l.stage === "won");
  const lost = leads.filter(l => l.stage === "lost");
  const closed = won.length + lost.length;
  const conv = closed > 0 ? Math.round((won.length / closed) * 100) : 0;
  const totalValue = won.reduce((s, l) => s + (Number(l.deal_value) || 0), 0);
  const teamById = Object.fromEntries(team.map(t => [t.id, t]));

  const byStage = STAGES.map(s => ({ ...s, count: leads.filter(l => l.stage === s.key).length }));
  const maxStage = Math.max(1, ...byStage.map(b => b.count));

  const bySource = leads.reduce((acc, l) => { const k = l.source || "—"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]);

  const byAssignee = team.map(t => {
    const my = leads.filter(l => l.assignee_id === t.id);
    return { name: t.name, total: my.length, won: my.filter(l => l.stage === "won").length, lost: my.filter(l => l.stage === "lost").length };
  }).filter(r => r.total > 0).sort((a, b) => b.total - a.total);
  const unassigned = leads.filter(l => !l.assignee_id).length;
  const stuckCount = leads.filter(l => l.stage !== "won" && l.stage !== "lost" && (Date.now() - new Date(l.updated_at).getTime()) / 3600000 >= 24).length;

  const stat = (label, val, color) => (
    <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
      <div style={{ fontSize: 11, color: B.dkGray }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color, marginTop: 4 }}>{val}</div>
    </div>
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, color: B.dkGray }}>ภาพรวม jiaroo CRM</div>
        <select value={range} onChange={e => setRange(Number(e.target.value))} style={{ padding: "8px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
          <option value={7}>7 วันล่าสุด</option>
          <option value={30}>30 วันล่าสุด</option>
          <option value={90}>90 วันล่าสุด</option>
          <option value={365}>1 ปีล่าสุด</option>
        </select>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
        {stat("Leads ทั้งหมด", leads.length, B.black)}
        {stat(`Leads ใหม่ (${range}d)`, inRange.length, B.red)}
        {stat("ปิดดีลได้", won.length, B.green)}
        {stat("Conversion", `${conv}%`, B.gold)}
        {stat("มูลค่ารวม", "฿" + totalValue.toLocaleString(), B.green)}
        {stat("ยังไม่มอบหมาย", unassigned, unassigned > 0 ? B.red : B.dkGray)}
        {stat("ค้างเกิน 24 ชม", stuckCount, stuckCount > 0 ? B.red : B.dkGray)}
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>Leads ตาม Stage</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {byStage.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 100, fontSize: 12 }}>{s.label}</div>
              <div style={{ flex: 1, background: B.gray, borderRadius: 6, height: 22, position: "relative", overflow: "hidden" }}>
                <div style={{ width: `${(s.count / maxStage) * 100}%`, background: s.color, height: "100%", borderRadius: 6, transition: "width .3s" }}/>
              </div>
              <div style={{ width: 40, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{s.count}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, marginBottom: 12 }}>
        <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>แหล่งที่มา</div>
          {sourceRows.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>—</div> : sourceRows.map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.gray}`, fontSize: 13 }}>
              <span>{k}</span>
              <span style={{ fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>

        <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>ผลงานทีม</div>
          {byAssignee.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>ยังไม่มีการมอบหมาย</div> : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead><tr style={{ color: B.dkGray, fontSize: 11 }}>
                <th style={{ textAlign: "left", padding: "4px 0" }}>ชื่อ</th>
                <th style={{ textAlign: "right", padding: "4px 0" }}>ทั้งหมด</th>
                <th style={{ textAlign: "right", padding: "4px 0", color: B.green }}>ปิดได้</th>
                <th style={{ textAlign: "right", padding: "4px 0", color: B.dkGray }}>เสีย</th>
              </tr></thead>
              <tbody>
                {byAssignee.map(r => (
                  <tr key={r.name} style={{ borderTop: `1px solid ${B.gray}` }}>
                    <td style={{ padding: "6px 0", fontWeight: 600 }}>{r.name}</td>
                    <td style={{ textAlign: "right" }}>{r.total}</td>
                    <td style={{ textAlign: "right", color: B.green, fontWeight: 600 }}>{r.won}</td>
                    <td style={{ textAlign: "right", color: B.dkGray }}>{r.lost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div style={{ background: B.white, borderRadius: 12, padding: 16, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>กิจกรรมล่าสุด ({events.length})</div>
        {events.length === 0 ? <div style={{ fontSize: 12, color: B.dkGray }}>ยังไม่มีกิจกรรมในช่วงเวลานี้</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 320, overflowY: "auto" }}>
            {events.slice(0, 50).map(ev => {
              const lead = leads.find(l => l.id === ev.lead_id);
              const data = ev.data || {};
              let desc = ev.type;
              if (ev.type === "stage_change") desc = `${STAGE_BY_KEY[data.from]?.label || data.from} → ${STAGE_BY_KEY[data.to]?.label || data.to}`;
              else if (ev.type === "assign") desc = `มอบหมายให้ ${teamById[data.to]?.name || "ใครก็ตาม"}`;
              else if (ev.type === "created") desc = `สร้าง (${data.source || ""})`;
              else if (ev.type === "claim") desc = `${data.name || "ใครบางคน"} กดรับ`;
              else if (ev.type === "note") desc = `📝 ${(data.text || "").slice(0, 60)}${(data.text || "").length > 60 ? "..." : ""}`;
              else if (ev.type === "follow") desc = "เพิ่มเพื่อน LINE";
              else if (ev.type === "unfollow") desc = "บล็อก / ลบเพื่อน";
              return (
                <div key={ev.id} style={{ display: "flex", gap: 8, padding: 8, background: B.gray, borderRadius: 6, fontSize: 12 }}>
                  <div style={{ minWidth: 90, color: B.dkGray, fontSize: 11 }}>{fmtDT(ev.created_at)}</div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{lead ? (lead.name || lead.display_name || "—") : "(ลบแล้ว)"}</span>
                    <span style={{ color: B.dkGray, marginLeft: 6 }}>{desc}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TeamManager() {
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showNew, setShowNew] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const r = await adminRest("jiaroo_team", "GET", null, `?tenant_slug=eq.${JIAROO_TENANT}&order=active.desc,name.asc`);
    setTeam(Array.isArray(r) ? r : []);
    setLoading(false);
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const toggleActive = async (m) => {
    await adminRest("jiaroo_team", "PATCH", { active: !m.active }, `?id=eq.${m.id}`);
    reload();
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, color: B.dkGray }}>{team.filter(t => t.active).length} active / {team.length} ทั้งหมด</div>
        <button onClick={() => setShowNew(true)} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ เพิ่มสมาชิก</button>
      </div>
      <div style={{ background: B.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
        {loading ? <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div> :
         team.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>ยังไม่มีสมาชิก — กด "+ เพิ่มสมาชิก"</div> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ background: B.gray }}>
              {["ชื่อ","อีเมล","เบอร์","บทบาท","สถานะ",""].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: B.dkGray, fontSize: 12, borderBottom: `1px solid ${B.ltGray}` }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {team.map(m => (
                <tr key={m.id} style={{ borderBottom: `1px solid ${B.ltGray}`, opacity: m.active ? 1 : 0.5 }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{m.name}</td>
                  <td style={{ padding: "10px 12px" }}>{m.email || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{m.phone || "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{m.role}</td>
                  <td style={{ padding: "10px 12px" }}>{m.active ? "✓ active" : "ปิดอยู่"}</td>
                  <td style={{ padding: "10px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button onClick={() => setEditing(m)} style={{ background: "transparent", color: B.red, border: "none", cursor: "pointer", fontSize: 12, marginRight: 8 }}>แก้ไข</button>
                    <button onClick={() => toggleActive(m)} style={{ background: "transparent", color: B.dkGray, border: "none", cursor: "pointer", fontSize: 12 }}>{m.active ? "ปิด" : "เปิด"}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {(showNew || editing) && <TeamForm member={editing} onClose={() => { setShowNew(false); setEditing(null); }} onSaved={() => { setShowNew(false); setEditing(null); reload(); }}/>}
    </div>
  );
}

function TeamForm({ member, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: member?.name || "",
    email: member?.email || "",
    phone: member?.phone || "",
    role: member?.role || "sales",
  });
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!form.name) { alert("กรอกชื่อ"); return; }
    setSaving(true);
    if (member) {
      await adminRest("jiaroo_team", "PATCH", { name: form.name, email: form.email || null, phone: form.phone || null, role: form.role }, `?id=eq.${member.id}`);
    } else {
      await adminRest("jiaroo_team", "POST", { tenant_slug: JIAROO_TENANT, name: form.name, email: form.email || null, phone: form.phone || null, role: form.role, active: true });
    }
    setSaving(false);
    onSaved();
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: B.white, borderRadius: 12, padding: 20, width: "100%", maxWidth: 380 }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 14 }}>{member ? "แก้ไขสมาชิก" : "เพิ่มสมาชิก"}</div>
        {[["name","ชื่อ"],["email","อีเมล"],["phone","เบอร์"]].map(([k, l]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>{l}</label>
            <input value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, boxSizing: "border-box" }}/>
          </div>
        ))}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, color: B.dkGray, display: "block", marginBottom: 4 }}>บทบาท</label>
          <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 13, background: B.white }}>
            <option value="sales">sales</option>
            <option value="manager">manager</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: B.white, color: B.dkGray, border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "12px", fontSize: 14, cursor: "pointer" }}>ยกเลิก</button>
          <button onClick={submit} disabled={saving} style={{ flex: 1, background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "12px", fontSize: 14, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>{saving ? "..." : "บันทึก"}</button>
        </div>
      </div>
    </div>
  );
}

function AdminLogin({ onAuth }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!pw) { setErr("กรุณากรอกรหัสผ่าน"); return; }
    setErr(""); setBusy(true);
    const ok = await adminPing(pw); // ตรวจรหัสฝั่ง server
    setBusy(false);
    if (ok) {
      setAdminKey(pw);
      sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      onAuth();
    } else {
      setErr("รหัสผ่านไม่ถูกต้อง หรือระบบยังไม่ได้ตั้งค่า ADMIN_API_KEY");
    }
  };
  return (
    <div style={{ ...css.page, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ ...css.card, maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.red}15`, display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
            <I name="lock" size={28} color={B.red}/>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>JIA Admin</h2>
          <p style={{ fontSize: 13, color: B.dkGray, marginTop: 6 }}>กรอกรหัสผ่านเพื่อเข้าระบบ</p>
        </div>
        <input
          type="password"
          value={pw}
          onChange={e => { setPw(e.target.value); setErr(""); }}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="รหัสผ่าน"
          autoFocus
          style={{ width: "100%", padding: "14px 16px", border: `1px solid ${B.ltGray}`, borderRadius: 10, fontSize: 15, marginBottom: 10, boxSizing: "border-box" }}
        />
        {err && <div style={{ color: B.red, fontSize: 13, marginBottom: 10 }}>{err}</div>}
        <button onClick={submit} disabled={busy} style={{ ...css.btn(B.red, B.white, true), opacity: busy ? 0.6 : 1 }}>{busy ? "กำลังตรวจสอบ…" : "เข้าระบบ →"}</button>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <a href="/" style={{ fontSize: 12, color: B.dkGray }}>← กลับหน้าหลัก</a>
        </div>
      </div>
    </div>
  );
}

// ==================== VOUCHER ISSUE (ออกโค้ดเต็มคอร์สให้ลูกค้าจ่ายเงินแล้ว/บริษัท) ====================
function VoucherIssuePanel() {
  const [form, setForm] = useState({ name: "", phone: "", company: "", source: "voucher_sale" });
  const [issuing, setIssuing] = useState(false);
  const [err, setErr] = useState("");
  const [issued, setIssued] = useState(null);
  const [copied, setCopied] = useState(false);

  const F = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(""); };

  const issue = async () => {
    setErr("");
    if (!form.name.trim()) { setErr("กรุณากรอกชื่อลูกค้า"); return; }
    const phone = normalizePhone(form.phone);
    if (phone.length < 9) { setErr("กรุณากรอกเบอร์โทรที่ถูกต้อง"); return; }
    setIssuing(true);
    try {
      const code = genVoucherCode();
      const expires = new Date(); expires.setFullYear(expires.getFullYear() + 2); // voucher จ่ายเงินแล้ว ไม่ควรหมดอายุเร็วแบบโค้ด lead-capture
      const payload = {
        code, name: form.name.trim(), phone, email: "", source: form.source,
        company: form.company.trim() || null,
        unlock_modules: VOUCHER_ALL_MODULES,
        expires_at: expires.toISOString(),
      };
      const res = await adminRest("lead_promo_codes", "POST", payload);
      if (!Array.isArray(res) || !res.length) { setErr("ออกโค้ดไม่สำเร็จ (เบอร์นี้อาจมีโค้ดที่ยังไม่ใช้อยู่แล้ว ลองค้นในแท็บ \"โค้ดส่วนลด Lead\")"); setIssuing(false); return; }
      setIssued({ code, ...form, phone });
      setForm({ name: "", phone: "", company: form.company, source: form.source });
    } catch (ex) { console.error(ex); setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setIssuing(false);
  };

  const copyCode = () => {
    if (!issued) return;
    navigator.clipboard?.writeText(issued.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={{ background: B.white, borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>ออก Voucher ปลดล็อกเต็มคอร์ส</h3>
        <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 16 }}>สำหรับลูกค้าที่จ่ายเงินมาแล้ว (ขาย voucher โดยตรง หรือบริษัทซื้อให้พนักงานเรียน pre-course) — โค้ดปลดล็อกทุกบท ไม่หมดอายุเร็ว</p>

        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ประเภท</label>
          <select value={form.source} onChange={e => F("source", e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}>
            {VOUCHER_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่อลูกค้า *</label>
          <input type="text" value={form.name} onChange={e => F("name", e.target.value)} placeholder="เช่น สมชาย ใจดี" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทร *</label>
          <input type="tel" value={form.phone} onChange={e => F("phone", e.target.value)} placeholder="เช่น 081-234-5678" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
        </div>
        <div style={{ marginBottom: 4 }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>บริษัท (ถ้ามี — ใช้กรองรายงานคะแนนทีหลัง)</label>
          <input type="text" value={form.company} onChange={e => F("company", e.target.value)} placeholder="เช่น บริษัท เอบีซี จำกัด" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
        </div>
        {err && <div style={{ color: B.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button onClick={issue} disabled={issuing} style={{ ...css.btn(B.red, B.white, true), marginTop: 16, opacity: issuing ? .6 : 1 }}>{issuing ? "กำลังออกโค้ด..." : "ออกโค้ด →"}</button>
      </div>

      {issued && (
        <div style={{ background: `${B.gold}12`, border: `2px solid ${B.gold}`, borderRadius: 14, padding: 20, textAlign: "center" }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ออกโค้ดสำเร็จ — ส่งให้ {issued.name} ({issued.phone})</div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 3, fontFamily: "monospace", margin: "8px 0" }}>{issued.code}</div>
          <button onClick={copyCode} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>{copied ? "คัดลอกแล้ว ✓" : "คัดลอกโค้ด"}</button>
          <div style={{ fontSize: 11, color: B.dkGray, marginTop: 10 }}>ลูกค้านำโค้ดนี้ไปกรอกที่หน้า "มีโค้ดส่วนลด" ในแอป</div>
        </div>
      )}
    </div>
  );
}

// ==================== STANDING CODE (โค้ดกลางใช้ซ้ำได้ ตั้งวันหมดอายุได้ — นักเรียน pre-course) ====================
function StandingCodePanel() {
  const [codes, setCodes] = useState([]);
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ code: "", company: "", expires: "" });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [copiedCode, setCopiedCode] = useState("");

  const refresh = async () => {
    setLoading(true);
    const rows = await adminRest("lead_promo_codes", "GET", null, "?multi_use=eq.true&select=code,unlock_modules,company,created_at,expires_at&order=created_at.desc");
    const list = Array.isArray(rows) ? rows : [];
    setCodes(list);
    if (list.length) {
      const inList = list.map(r => encodeURIComponent(r.code)).join(",");
      const ev = await adminRest("lead_capture_events", "GET", null, `?event_type=eq.redeemed&code=in.(${inList})&select=code`);
      const c = {};
      (Array.isArray(ev) ? ev : []).forEach(e => { c[e.code] = (c[e.code] || 0) + 1; });
      setCounts(c);
    }
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    setErr("");
    const code = form.code.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(code)) { setErr("ตั้งชื่อโค้ด 4-20 ตัว ใช้ A-Z, 0-9 และขีดกลาง เช่น JIA-STUDENT"); return; }
    // เว้นว่าง = ไม่หมดอายุ (ใช้ค่า sentinel ปี 2099) — ถ้ากรอกวันที่ ให้หมดอายุปลายวันนั้น (23:59:59)
    let expiresAt = STANDING_NEVER_EXPIRES;
    if (form.expires) {
      const d = new Date(`${form.expires}T23:59:59`);
      if (isNaN(d.getTime())) { setErr("วันหมดอายุไม่ถูกต้อง"); return; }
      if (d.getTime() < Date.now()) { setErr("วันหมดอายุต้องเป็นวันในอนาคต"); return; }
      expiresAt = d.toISOString();
    }
    setCreating(true);
    try {
      const res = await adminRest("lead_promo_codes", "POST", {
        code, email: "", phone: `standing:${code}`, name: "โค้ดกลางนักเรียน Pre-course",
        source: "pre_course", company: form.company.trim() || null,
        unlock_modules: VOUCHER_ALL_MODULES,
        expires_at: expiresAt, multi_use: true,
      });
      if (!Array.isArray(res) || !res.length) { setErr("สร้างไม่สำเร็จ (ชื่อโค้ดนี้อาจมีอยู่แล้ว)"); setCreating(false); return; }
      setForm({ code: "", company: "", expires: "" });
      refresh();
    } catch (ex) { console.error(ex); setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setCreating(false);
  };

  const copy = (code) => {
    navigator.clipboard?.writeText(code).then(() => { setCopiedCode(code); setTimeout(() => setCopiedCode(""), 2000); });
  };

  return (
    <div style={{ maxWidth: 480, marginTop: 20 }}>
      <div style={{ background: B.white, borderRadius: 14, padding: 20 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>โค้ดกลาง (ใช้ซ้ำได้)</h3>
        <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 16 }}>โค้ดเดียวแจกนักเรียนได้ทุกคน ทุกวัน — สำหรับให้นักเรียนที่จองคลาสจริงเรียนออนไลน์มาก่อน (ปลดล็อกทุกบท) แต่ละคนยังต้องกรอกชื่อ+เบอร์ตอนใช้โค้ด จึงตามดูคะแนนรายคนได้ตามปกติ ตั้งวันหมดอายุได้ (เว้นว่าง = ไม่หมดอายุ)</p>

        {loading ? <div style={{ fontSize: 13, color: B.dkGray }}>กำลังโหลด...</div> : codes.length === 0 ? (
          <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 12 }}>ยังไม่มีโค้ดกลางในระบบ</div>
        ) : codes.map(r => {
          const never = !r.expires_at || new Date(r.expires_at).getFullYear() >= 2099;
          const expired = !never && new Date(r.expires_at) < new Date();
          return (
          <div key={r.code} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: `1px solid ${B.gray}`, opacity: expired ? .55 : 1 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 16, fontWeight: 800, fontFamily: "monospace", letterSpacing: 1 }}>
                {r.code}
                {expired && <span style={{ fontSize: 10, fontWeight: 700, color: B.red, marginLeft: 8, verticalAlign: "middle" }}>หมดอายุแล้ว</span>}
              </div>
              <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>
                ใช้ไปแล้ว <strong>{counts[r.code] || 0}</strong> คน{r.company ? ` • ${r.company}` : ""} • สร้าง {new Date(r.created_at).toLocaleDateString("th-TH")}
                {" • "}{never ? "ไม่หมดอายุ" : `หมดอายุ ${new Date(r.expires_at).toLocaleDateString("th-TH")}`}
              </div>
            </div>
            <button onClick={() => copy(r.code)} style={{ ...css.btn(B.white, B.black), border: `1px solid ${B.ltGray}`, fontSize: 12, padding: "6px 14px" }}>{copiedCode === r.code ? "คัดลอกแล้ว ✓" : "คัดลอก"}</button>
          </div>
          );
        })}

        <div style={{ marginTop: 16, paddingTop: 16, borderTop: `1px solid ${B.gray}` }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>สร้างโค้ดกลางใหม่</label>
          <input type="text" value={form.code} onChange={e => { setForm(p => ({ ...p, code: e.target.value.toUpperCase() })); setErr(""); }} placeholder="เช่น JIA-STUDENT" autoCapitalize="characters"
            style={{ width: "100%", padding: "12px 14px", border: `2px solid ${err ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 }}/>
          <input type="text" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder="บริษัท (ถ้ามี — ใช้กรองรายงานคะแนน)"
            style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", marginBottom: 10 }}/>
          <label style={{ fontSize: 12, color: B.dkGray, display: "block", marginBottom: 6 }}>วันหมดอายุ (เว้นว่าง = ไม่หมดอายุ)</label>
          <input type="date" value={form.expires} onChange={e => { setForm(p => ({ ...p, expires: e.target.value })); setErr(""); }}
            style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          {err && <div style={{ color: B.red, fontSize: 13, marginTop: 8 }}>{err}</div>}
          <button onClick={create} disabled={creating || !form.code.trim()} style={{ ...css.btn(B.red, B.white, true), marginTop: 12, opacity: (creating || !form.code.trim()) ? .6 : 1 }}>{creating ? "กำลังสร้าง..." : "สร้างโค้ดกลาง →"}</button>
        </div>
      </div>
    </div>
  );
}

// ==================== PARTNER COUPON (QR ใบละ 1 สิทธิ์ — ธุรกิจพันธมิตรแจกให้ลูกค้าเรียนคอร์สเต็มฟรี) ====================
function PartnerCouponPanel({ onPrint }) {
  const [groups, setGroups] = useState([]); // [{ company, rows: [...] }]
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null); // company ที่กำลังดูรายชื่อคนใช้
  const [editing, setEditing] = useState(null); // company ที่กำลังแก้ไขช่องทางติดต่อ
  const [editForm, setEditForm] = useState({ sponsor_line: "", sponsor_phone: "", sponsor_value: "" });
  const [savingEdit, setSavingEdit] = useState(false);

  const [form, setForm] = useState({ company: "", prefix: "", sponsor_line: "", sponsor_phone: "", sponsor_value: String(PRICING.full), count: "50", expires: "" });
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState(null); // ชุดที่เพิ่งสร้าง { company, rows }

  const F = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(""); };

  const refresh = async () => {
    setLoading(true);
    const res = await adminRest("lead_promo_codes", "GET", null, "?source=eq.partner_coupon&select=code,company,name,redeemed_at,redeemed_phone,expires_at,created_at,sponsor_line,sponsor_phone,sponsor_value&order=created_at.desc&limit=5000");
    const list = Array.isArray(res) ? res : [];
    const byCompany = new Map();
    for (const r of list) {
      if (!byCompany.has(r.company)) byCompany.set(r.company, []);
      byCompany.get(r.company).push(r);
    }
    setGroups([...byCompany.entries()].map(([company, rows]) => ({ company, rows })));
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);

  const create = async () => {
    setErr("");
    const company = form.company.trim();
    const prefix = form.prefix.trim().toUpperCase();
    const n = parseInt(form.count, 10) || 0;
    if (!company) { setErr("กรุณากรอกชื่อพาร์ทเนอร์"); return; }
    if (!/^[A-Z0-9]{2,8}$/.test(prefix)) { setErr("รหัสย่อ 2-8 ตัว ใช้ A-Z, 0-9 เท่านั้น เช่น OMNOI"); return; }
    if (n < 1 || n > 200) { setErr("จำนวนใบต้องอยู่ระหว่าง 1-200"); return; }
    const sponsorValue = parseInt(form.sponsor_value, 10) || PRICING.full;
    let expiresAt;
    if (form.expires) {
      const d = new Date(`${form.expires}T23:59:59`);
      if (isNaN(d.getTime()) || d.getTime() < Date.now()) { setErr("วันหมดอายุไม่ถูกต้อง (ต้องเป็นวันในอนาคต)"); return; }
      expiresAt = d.toISOString();
    } else {
      const d = new Date(); d.setFullYear(d.getFullYear() + 1);
      expiresAt = d.toISOString();
    }
    setCreating(true);
    const buildRows = () => {
      const codes = new Set();
      while (codes.size < n) codes.add(genPartnerCode(prefix));
      return [...codes].map(code => ({
        code, email: "", phone: `coupon:${code}`, name: `คูปองพาร์ทเนอร์ ${company}`,
        source: PARTNER_SOURCE, company, unlock_modules: VOUCHER_ALL_MODULES,
        expires_at: expiresAt, multi_use: false,
        sponsor_line: form.sponsor_line.trim() || null,
        sponsor_phone: form.sponsor_phone.trim() || null,
        sponsor_value: sponsorValue,
      }));
    };
    try {
      // PostgREST insert หลายแถวเป็น atomic — ถ้าโค้ดชนกัน (ความน่าจะเป็นต่ำมาก) สุ่มชุดใหม่ลองอีกครั้งเดียว
      let res = await adminRest("lead_promo_codes", "POST", buildRows());
      if (!Array.isArray(res) || !res.length) res = await adminRest("lead_promo_codes", "POST", buildRows());
      if (!Array.isArray(res) || !res.length) { setErr("สร้างคูปองไม่สำเร็จ กรุณาลองใหม่"); setCreating(false); return; }
      setCreated({ company, rows: res });
      await refresh();
    } catch (ex) { console.error(ex); setErr("เกิดข้อผิดพลาด กรุณาลองใหม่"); }
    setCreating(false);
  };

  const startEdit = (g) => {
    const latest = g.rows[0] || {};
    setEditing(g.company);
    setEditForm({ sponsor_line: latest.sponsor_line || "", sponsor_phone: latest.sponsor_phone || "", sponsor_value: String(latest.sponsor_value || PRICING.full) });
  };
  const saveEdit = async (company) => {
    setSavingEdit(true);
    await adminRest("lead_promo_codes", "PATCH", {
      sponsor_line: editForm.sponsor_line.trim() || null,
      sponsor_phone: editForm.sponsor_phone.trim() || null,
      sponsor_value: parseInt(editForm.sponsor_value, 10) || PRICING.full,
    }, `?source=eq.partner_coupon&company=eq.${encodeURIComponent(company)}`);
    setSavingEdit(false);
    setEditing(null);
    refresh();
  };

  const printGroup = (g, onlyUnused) => {
    const latest = g.rows[0] || {};
    const rows = onlyUnused ? g.rows.filter(r => !r.redeemed_at && new Date(r.expires_at) > new Date()) : g.rows;
    if (!rows.length) { alert("ไม่มีคูปองที่พิมพ์ได้ในเงื่อนไขนี้"); return; }
    onPrint({ company: g.company, rows, sponsor: { line: latest.sponsor_line, phone: latest.sponsor_phone, value: latest.sponsor_value } });
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ background: B.white, borderRadius: 14, padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>สร้างคูปองพาร์ทเนอร์ (QR ใบละ 1 สิทธิ์)</h3>
        <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 16 }}>ธุรกิจพันธมิตร (เช่น ออฟฟิศอ้อมน้อย) แจกคูปองให้ลูกค้า สแกนแล้วเรียนคอร์สเต็มฟรีทันที — คนละ 1 ใบ 1 สิทธิ์ หลังใช้จะเห็น LINE/เบอร์ที่กรอกไว้นี้บนหน้าเว็บ</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่อพาร์ทเนอร์ *</label>
            <input type="text" value={form.company} onChange={e => F("company", e.target.value)} placeholder="เช่น ออฟฟิศอ้อมน้อย" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>รหัสย่อ (ใช้ขึ้นต้นโค้ด) *</label>
            <input type="text" value={form.prefix} onChange={e => F("prefix", e.target.value.toUpperCase())} placeholder="เช่น OMNOI" autoCapitalize="characters" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "monospace", textTransform: "uppercase" }}/>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>LINE (ID หรือลิงก์)</label>
            <input type="text" value={form.sponsor_line} onChange={e => F("sponsor_line", e.target.value)} placeholder="เช่น @omnoi หรือลิงก์ line.me" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทร</label>
            <input type="tel" value={form.sponsor_phone} onChange={e => F("sponsor_phone", e.target.value)} placeholder="เช่น 081-234-5678" style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 4 }}>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>มูลค่าที่โชว์ (฿)</label>
            <input type="number" value={form.sponsor_value} onChange={e => F("sponsor_value", e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>จำนวนใบ (1-200)</label>
            <input type="number" value={form.count} onChange={e => F("count", e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>วันหมดอายุ (เว้นว่าง = 1 ปี)</label>
            <input type="date" value={form.expires} onChange={e => F("expires", e.target.value)} style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box" }}/>
          </div>
        </div>
        {err && <div style={{ color: B.red, fontSize: 13, marginTop: 10 }}>{err}</div>}
        <button onClick={create} disabled={creating} style={{ ...css.btn(B.red, B.white, true), marginTop: 16, opacity: creating ? .6 : 1 }}>{creating ? "กำลังสร้าง..." : "สร้างชุดคูปอง →"}</button>
      </div>

      {created && (
        <div style={{ background: `${B.gold}12`, border: `2px solid ${B.gold}`, borderRadius: 14, padding: 20, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>สร้างคูปองพาร์ทเนอร์ {created.company} สำเร็จ {created.rows.length} ใบ</div>
          <button onClick={() => printGroup({ company: created.company, rows: created.rows }, false)} style={{ ...css.btn(B.gold, B.black, true), fontSize: 14 }}>พิมพ์ชุดนี้ →</button>
        </div>
      )}

      {loading ? <div style={{ fontSize: 13, color: B.dkGray }}>กำลังโหลด...</div> : groups.length === 0 ? (
        <div style={{ fontSize: 13, color: B.dkGray }}>ยังไม่มีคูปองพาร์ทเนอร์ในระบบ</div>
      ) : groups.map(g => {
        const total = g.rows.length;
        const used = g.rows.filter(r => r.redeemed_at).length;
        const expired = g.rows.filter(r => !r.redeemed_at && new Date(r.expires_at) < new Date()).length;
        const left = total - used - expired;
        const latest = g.rows[0] || {};
        return (
          <div key={g.company} style={{ background: B.white, borderRadius: 14, padding: 18, marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{g.company}</div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>
                  ทั้งหมด {total} · ใช้แล้ว <strong style={{ color: B.green }}>{used}</strong> · เหลือ <strong style={{ color: B.gold }}>{left}</strong>{expired > 0 && <> · หมดอายุ {expired}</>}
                </div>
                <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>LINE: {latest.sponsor_line || "—"} · โทร: {latest.sponsor_phone || "—"} · มูลค่า ฿{latest.sponsor_value || PRICING.full}</div>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <button onClick={() => printGroup(g, true)} style={{ ...css.btn(B.gold, B.black), fontSize: 12, padding: "8px 12px" }}>พิมพ์ใบที่ยังไม่ใช้</button>
                <button onClick={() => printGroup(g, false)} style={{ ...css.btn(B.white, B.black), border: `1px solid ${B.ltGray}`, fontSize: 12, padding: "8px 12px" }}>พิมพ์ทั้งหมด</button>
                <button onClick={() => setExpanded(expanded === g.company ? null : g.company)} style={{ ...css.btn(B.white, B.dkGray), border: `1px solid ${B.ltGray}`, fontSize: 12, padding: "8px 12px" }}>{expanded === g.company ? "ซ่อนรายชื่อ" : "ดูรายชื่อคนใช้"}</button>
                <button onClick={() => startEdit(g)} style={{ ...css.btn(B.white, B.dkGray), border: `1px solid ${B.ltGray}`, fontSize: 12, padding: "8px 12px" }}>แก้ไขช่องทางติดต่อ</button>
              </div>
            </div>

            {editing === g.company && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.gray}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input type="text" value={editForm.sponsor_line} onChange={e => setEditForm(p => ({ ...p, sponsor_line: e.target.value }))} placeholder="LINE" style={{ padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
                  <input type="tel" value={editForm.sponsor_phone} onChange={e => setEditForm(p => ({ ...p, sponsor_phone: e.target.value }))} placeholder="เบอร์โทร" style={{ padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
                  <input type="number" value={editForm.sponsor_value} onChange={e => setEditForm(p => ({ ...p, sponsor_value: e.target.value }))} placeholder="มูลค่า ฿" style={{ padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
                </div>
                <button onClick={() => saveEdit(g.company)} disabled={savingEdit} style={{ ...css.btn(B.red, B.white), fontSize: 12, padding: "8px 16px" }}>{savingEdit ? "กำลังบันทึก..." : "บันทึก"}</button>
                <button onClick={() => setEditing(null)} style={{ ...css.btn(B.white, B.dkGray), border: `1px solid ${B.ltGray}`, fontSize: 12, padding: "8px 16px", marginLeft: 8 }}>ยกเลิก</button>
                <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6 }}>ใช้กับคูปองทุกใบของพาร์ทเนอร์นี้ (คูปองที่พิมพ์ไปแล้วไม่ต้องพิมพ์ใหม่ — QR เดิมยังใช้ได้ แค่หน้าเว็บจะโชว์ข้อมูลใหม่)</div>
              </div>
            )}

            {expanded === g.company && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: `1px solid ${B.gray}` }}>
                {g.rows.filter(r => r.redeemed_at).length === 0 ? (
                  <div style={{ fontSize: 12, color: B.dkGray }}>ยังไม่มีใครใช้คูปองนี้</div>
                ) : g.rows.filter(r => r.redeemed_at).map(r => (
                  <div key={r.code} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${B.gray}`, fontSize: 12.5 }}>
                    <span>{r.name} · {r.redeemed_phone}</span>
                    <span style={{ color: B.dkGray }}>{new Date(r.redeemed_at).toLocaleString("th-TH")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==================== PARTNER COUPON CARD (การ์ดคูปอง 1 ใบ — ใช้ทั้งพิมพ์และบันทึกรูป) ====================
// ขั้นตอนใช้คูปอง — โชว์เป็นวงกลมเลข 1-2-3 พร้อม label สั้นใต้แต่ละวง (อ่านง่ายกว่าข้อความยาว)
const PARTNER_COUPON_STEPS = ["สแกน QR", "กรอกชื่อ-เบอร์", "เรียนได้ทันที"];

function PartnerCouponCard({ row, svg, cardRef }) {
  const expiryTh = row.expires_at ? thaiShortDate(String(row.expires_at).slice(0, 10)) : "-";
  const value = row.sponsor_value || PRICING.full;
  return (
    <div ref={cardRef} style={{ width: "90mm", height: "62mm", boxSizing: "border-box", border: "1px dashed #B8862F", borderRadius: "3mm", background: "#FFFDF7", display: "flex", overflow: "hidden", position: "relative", breakInside: "avoid", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", fontFamily: "'Noto Sans Thai', sans-serif" }}>
      {/* แผงซ้าย: QR เด่นชัดในกรอบขาวขอบทอง + คำกำกับ "สแกนรับสิทธิ์ฟรี" ใต้ QR โดยตรง */}
      <div style={{ width: "34mm", flexShrink: 0, background: "#FDF3E7", borderRight: "0.6mm solid #F3DB8E", boxSizing: "border-box", padding: "2.4mm", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1mm" }}>
        <div className="partner-coupon-qr" style={{ width: "30mm", height: "30mm", background: "#fff", border: "0.35mm solid #F3DB8E", borderRadius: "1.5mm", boxSizing: "border-box", padding: "0.8mm", boxShadow: "0 0.4mm 1mm rgba(0,0,0,.08)" }} dangerouslySetInnerHTML={{ __html: svg || "" }}/>
        <div style={{ fontSize: "6.8pt", fontWeight: 800, color: "#C8102E", textAlign: "center", lineHeight: 1.15 }}>สแกนรับสิทธิ์ฟรี</div>
        <div style={{ fontFamily: "monospace", fontSize: "6pt", fontWeight: 600, letterSpacing: ".3px", wordBreak: "break-all", color: "#8a6d1a", textAlign: "center" }}>{row.code}</div>
      </div>
      {/* แผงขวา: หัวเรื่อง+ป้ายมูลค่า, รายละเอียดคอร์ส, ขั้นตอน, ติดต่อ */}
      <div style={{ flex: 1, minWidth: 0, boxSizing: "border-box", padding: "2.6mm 3mm", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", rowGap: "0.8mm", columnGap: "1.5mm" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "1.3mm" }}>
            <Logo size={24}/>
            <div style={{ fontSize: "10.5pt", fontWeight: 900, color: "#C8102E", whiteSpace: "nowrap" }}>คูปองเรียนฟรี</div>
          </div>
          <div style={{ background: "#F59E0B", color: "#1A1A1A", borderRadius: 999, padding: "0.6mm 2.4mm", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: "4.6pt", fontWeight: 700, letterSpacing: ".3px", lineHeight: 1 }}>มูลค่า</div>
            <div style={{ fontSize: "8.2pt", fontWeight: 900, lineHeight: 1.1 }}>฿{value}</div>
          </div>
        </div>
        <div style={{ height: "0.4mm", background: "#F3DB8E", margin: "1.3mm 0" }}/>
        <div style={{ fontSize: "7.6pt", color: "#333", lineHeight: 1.3 }}>คอร์ส CPR &amp; AED ออนไลน์ เต็มหลักสูตร + ใบประกาศนียบัตร</div>
        <div style={{ fontSize: "7.8pt", fontWeight: 700, color: "#1A1A1A", marginTop: "1.2mm" }}>มอบโดย {row.company}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "1.8mm", gap: "1mm" }}>
          {PARTNER_COUPON_STEPS.map((label, i) => (
            <div key={label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.5mm", flex: 1, minWidth: 0 }}>
              <div style={{ width: "3.4mm", height: "3.4mm", borderRadius: "50%", background: "#C8102E", color: "#fff", fontSize: "4.2pt", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</div>
              <div style={{ fontSize: "5.6pt", color: "#555", textAlign: "center", lineHeight: 1.15 }}>{label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "auto", paddingTop: "1.5mm" }}>
          <div style={{ fontSize: "6.3pt", color: "#666" }}>ใช้ได้ถึง {expiryTh} · 1 คูปอง/1 คน</div>
          <div style={{ fontSize: "6.5pt", color: "#333", fontWeight: 600, marginTop: "0.8mm" }}>ติดต่อ {row.company}{row.sponsor_line ? ` · LINE ${row.sponsor_line}` : ""}{row.sponsor_phone ? ` · โทร ${row.sponsor_phone}` : ""}</div>
        </div>
      </div>
    </div>
  );
}

// ==================== PARTNER COUPON PRINT SHEET (แทนที่หน้าแอดมินทั้งหน้าตอนพิมพ์ — ไม่ใช้ window.open) ====================
function PartnerCouponPrintSheet({ job, onClose }) {
  const [svgs, setSvgs] = useState({}); // code -> svg string
  const [ready, setReady] = useState(false);
  const cardRefs = useRef({});
  const [savingCode, setSavingCode] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("qrcode");
      const QR = mod.default || mod;
      const entries = await Promise.all(job.rows.map(async (r) => {
        const url = `${SITE_URL}/?promo=${r.code}&utm_source=partner&utm_medium=qr&utm_campaign=${encodeURIComponent((r.code.split("-")[0] || "").toLowerCase())}`;
        const s = await QR.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
        return [r.code, s];
      }));
      if (!cancelled) { setSvgs(Object.fromEntries(entries)); setReady(true); }
    })();
    return () => { cancelled = true; };
  }, [job]);

  const saveImage = async (row) => {
    const el = cardRefs.current[row.code];
    if (!el || savingCode) return;
    setSavingCode(row.code);
    try {
      const dataUrl = await captureNodeToPng(el);
      await deliverBlob(await dataUrlToBlob(dataUrl), `coupon_${row.code}.png`, "image/png");
    } catch (e) { alert("บันทึกรูปไม่สำเร็จ"); }
    setSavingCode(null);
  };

  const PER_PAGE = 8;
  const pages = [];
  for (let i = 0; i < job.rows.length; i += PER_PAGE) pages.push(job.rows.slice(i, i + PER_PAGE));

  return (
    <div style={{ minHeight: "100vh", background: "#E5E5E5" }}>
      <style>{`@page { size: A4 portrait; margin: 10mm } @media print { .no-print { display: none !important } body { background: #fff } } .partner-coupon-qr svg { display: block; width: 100%; height: 100%; }`}</style>
      <div className="no-print" style={{ position: "sticky", top: 0, zIndex: 10, background: B.black, color: B.white, padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={onClose} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={22} color={B.white}/></button>
        <div style={{ fontSize: 14, fontWeight: 700 }}>พิมพ์คูปองพาร์ทเนอร์ — {job.company} ({job.rows.length} ใบ)</div>
        <button onClick={() => window.print()} disabled={!ready} style={{ ...css.btn(B.gold, B.black), fontSize: 13, padding: "8px 18px", opacity: ready ? 1 : .5, marginLeft: "auto" }}>{ready ? "พิมพ์" : "กำลังสร้าง QR..."}</button>
      </div>
      {pages.map((pageRows, pi) => (
        <div key={pi} style={{ background: "#fff", width: "210mm", minHeight: "277mm", margin: "10mm auto", padding: "10mm", boxSizing: "border-box", breakAfter: "page" }}>
          <div style={{ display: "grid", gridTemplateColumns: "90mm 90mm", gap: "6mm", justifyContent: "center" }}>
            {pageRows.map(row => (
              <div key={row.code} style={{ position: "relative" }}>
                <PartnerCouponCard row={row} svg={svgs[row.code]} cardRef={el => { cardRefs.current[row.code] = el; }}/>
                <button className="no-print" onClick={() => saveImage(row)} disabled={savingCode === row.code}
                  style={{ position: "absolute", top: -22, right: 0, background: B.white, border: `1px solid ${B.ltGray}`, borderRadius: 6, fontSize: 10, padding: "3px 6px", cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,.15)" }}>
                  {savingCode === row.code ? "..." : "บันทึกรูป"}
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ==================== COMPANY SCORE REPORT (สำหรับ HR ดูคะแนน pre-course) ====================
function CompanyReport() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [company, setCompany] = useState("");
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    (async () => {
      const res = await adminRest("online_students", "GET", null, "?company=not.is.null&select=company&order=company.asc");
      const uniq = [...new Set((Array.isArray(res) ? res : []).map(r => r.company).filter(Boolean))];
      setCompanies(uniq);
      if (uniq.length && !company) setCompany(uniq[0]);
    })();
  }, []);

  useEffect(() => {
    if (!company) { setRows([]); return; }
    (async () => {
      setLoading(true);
      const res = await adminRest("online_students", "GET", null, `?company=eq.${encodeURIComponent(company)}&select=name,phone,status,final_score,chapter_scores,registered_at,completed_at&order=registered_at.desc`);
      setRows(Array.isArray(res) ? res : []);
      setLoading(false);
    })();
  }, [company]);

  const chapterCols = COURSE.modules.filter(m => m.vid); // บทที่ 1-6 (ไม่รวมแบบทดสอบสุดท้าย)

  const exportCSV = () => {
    if (!rows.length) return;
    const header = ["name", "phone", "status", ...chapterCols.map(m => m.short), "final_score", "registered_at", "completed_at"].join(",");
    const esc = (v) => { if (v == null) return ""; const s = String(v).replace(/"/g, '""'); return /[",\n]/.test(s) ? `"${s}"` : s; };
    const body = rows.map(r => [r.name, r.phone, r.status, ...chapterCols.map(m => (r.chapter_scores || {})[m.id] ?? ""), r.final_score ?? "", r.registered_at, r.completed_at].map(esc).join(",")).join("\n");
    const csv = "﻿" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `jia_company_${company}_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14, flexWrap: "wrap" }}>
        <select value={company} onChange={e => setCompany(e.target.value)} style={{ padding: "10px 14px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 14 }}>
          {!companies.length && <option value="">— ยังไม่มีบริษัทในระบบ —</option>}
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={exportCSV} disabled={!rows.length} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 16px", opacity: rows.length ? 1 : .5 }}>Export CSV</button>
      </div>

      <CompanyPortalLinks company={company}/>
      {loading ? <div style={{ padding: 20, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div> : (
        <div style={{ overflowX: "auto", background: B.white, borderRadius: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: B.gray, textAlign: "left" }}>
                <th style={{ padding: "10px 12px" }}>ชื่อ</th>
                <th style={{ padding: "10px 12px" }}>เบอร์โทร</th>
                {chapterCols.map(m => <th key={m.id} style={{ padding: "10px 12px", textAlign: "center" }}>{m.short}</th>)}
                <th style={{ padding: "10px 12px", textAlign: "center" }}>สอบสุดท้าย</th>
                <th style={{ padding: "10px 12px" }}>สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ borderTop: `1px solid ${B.ltGray}` }}>
                  <td style={{ padding: "10px 12px", fontWeight: 600 }}>{r.name}</td>
                  <td style={{ padding: "10px 12px" }}>{r.phone}</td>
                  {chapterCols.map(m => {
                    const s = (r.chapter_scores || {})[m.id];
                    return <td key={m.id} style={{ padding: "10px 12px", textAlign: "center", color: s == null ? B.ltGray : s >= 80 ? B.green : B.red }}>{s == null ? "—" : `${s}%`}</td>;
                  })}
                  <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 700 }}>{r.final_score != null ? `${r.final_score}%` : "—"}</td>
                  <td style={{ padding: "10px 12px" }}>{r.status}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={4 + chapterCols.length} style={{ padding: 20, textAlign: "center", color: B.dkGray }}>ยังไม่มีนักเรียนของบริษัทนี้</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ==================== ADMIN: รูปตัวละครเกม CPR HERO ====================
// อัปโหลดรูป override ให้ตัวละครในเกม (แทน pixel art มาตรฐาน) โดยไม่ต้อง deploy ใหม่:
// ไฟล์ขึ้น Supabase storage ผ่าน admin-api (service role) + จด URL ในตาราง game_character_images
// ฝั่งเกมโหลดตารางนี้ตอนเปิดเกมแล้วใช้รูปแทนอัตโนมัติ — ลบรายการ = กลับไปใช้รูปมาตรฐาน
const GAME_CHARS = [
  { id: "aunt_kaew", name: "ป้าแก้ว" },
  { id: "helper_oat", name: "พี่โอ๊ต" },
  { id: "guard_dam", name: "ลุงดำ รปภ." },
  { id: "dispatcher_prom", name: "หมอพร้อม 1669" },
];
const GAME_POSES = [
  { id: "idle", label: "นิ่ง" }, { id: "talk", label: "พูด" }, { id: "panic", label: "ตกใจ" },
  { id: "stern", label: "ดุ" }, { id: "happy", label: "ยิ้ม" },
];
// ย่อรูปให้สูงไม่เกิน 800px + แปลงเป็น webp (คงพื้นหลังโปร่งใส) → base64 ไม่รวม data: prefix
const prepCharImage = (file) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, 800 / img.height);
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    cv.getContext("2d").drawImage(img, 0, 0, w, h);
    const dataUrl = cv.toDataURL("image/webp", 0.95);
    URL.revokeObjectURL(img.src);
    resolve(dataUrl.split(",")[1]);
  };
  img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error("bad image")); };
  img.src = URL.createObjectURL(file);
});
const adminUploadCharImage = async (charId, poseKey, base64) => {
  try {
    const res = await fetch(FN_URL("admin-api"), {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "x-admin-key": _adminKey || "" },
      body: JSON.stringify({ storage_upload: { charId, file: `${poseKey}-${Date.now()}.webp`, base64, contentType: "image/webp" } }),
    });
    const d = await res.json().catch(() => ({}));
    return res.ok && d?.url ? d.url : null;
  } catch (e) { return null; }
};

function GameCharacterImages() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null); // key `${charId}/${pose}` ที่กำลังอัป/ลบ
  const [msg, setMsg] = useState(null);
  const reload = useCallback(async () => {
    const data = await adminRest("game_character_images", "GET", null, "?select=*");
    setRows(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { reload(); }, [reload]);
  const map = Object.fromEntries(rows.map(r => [`${r.char_id}/${r.pose}`, r.url]));
  const flash = (t, ok) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 4000); };

  const upload = async (charId, poseKey, file) => {
    if (!file) return;
    const key = `${charId}/${poseKey}`;
    setBusy(key);
    try {
      const base64 = await prepCharImage(file);
      if (base64.length > 2800000) { flash("ไฟล์ใหญ่เกินไป (เกิน ~2MB หลังย่อ)", false); setBusy(null); return; }
      const url = await adminUploadCharImage(charId, poseKey, base64);
      if (!url) { flash("อัปโหลดไม่สำเร็จ — เช็คอินเทอร์เน็ตหรือรหัสแอดมิน", false); setBusy(null); return; }
      // upsert แบบสองจังหวะ (ลบของเดิมก่อนแล้วเพิ่มใหม่) — admin-api proxy ไม่รองรับ on_conflict
      await adminRest("game_character_images", "DELETE", null, `?char_id=eq.${charId}&pose=eq.${poseKey}`);
      await adminRest("game_character_images", "POST", { char_id: charId, pose: poseKey, url });
      await reload();
      flash("อัปโหลดสำเร็จ — เกมใช้รูปใหม่ทันที (ไม่ต้อง deploy)", true);
    } catch (e) { flash("อ่านไฟล์รูปไม่ได้", false); }
    setBusy(null);
  };
  const revert = async (charId, poseKey) => {
    if (!confirm("ลบรูปที่อัปโหลด แล้วกลับไปใช้รูปมาตรฐานของเกม?")) return;
    setBusy(`${charId}/${poseKey}`);
    await adminRest("game_character_images", "DELETE", null, `?char_id=eq.${charId}&pose=eq.${poseKey}`);
    await reload();
    setBusy(null);
  };

  const Cell = ({ charId, pose }) => {
    const mainKey = `${charId}/${pose.id}`;
    const talkKey = `${charId}/${pose.id}_talk`;
    const preview = map[mainKey] || `/images/characters/${charId}/${pose.id}.webp`;
    return (
      <div style={{ background: B.white, borderRadius: 12, padding: 10, border: `2px solid ${map[mainKey] ? B.green : B.ltGray}`, textAlign: "center", width: 128 }}>
        <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{pose.label} <span style={{ color: B.dkGray, fontWeight: 400 }}>({pose.id})</span></div>
        <div style={{ height: 110, display: "flex", alignItems: "center", justifyContent: "center", background: "#10182F", borderRadius: 8, marginBottom: 6 }}>
          <img src={preview} alt={mainKey} style={{ maxHeight: 104, maxWidth: 104, imageRendering: "pixelated" }} onError={e => { e.currentTarget.style.opacity = .25; }}/>
        </div>
        {map[mainKey] && <div style={{ fontSize: 10, color: B.green, fontWeight: 700, marginBottom: 4 }}>✓ ใช้รูปที่อัปโหลด</div>}
        <label style={{ display: "block", background: B.red, color: B.white, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: busy === mainKey ? .5 : 1 }}>
          {busy === mainKey ? "กำลังอัป..." : "อัปรูปหลัก"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={!!busy}
            onChange={e => { upload(charId, pose.id, e.target.files?.[0]); e.target.value = ""; }}/>
        </label>
        <label style={{ display: "block", background: B.gray, color: B.dkGray, borderRadius: 8, padding: "5px 0", fontSize: 11, fontWeight: 600, cursor: "pointer", marginTop: 4, opacity: busy === talkKey ? .5 : 1 }}>
          {busy === talkKey ? "กำลังอัป..." : map[talkKey] ? "เฟรมปากอ้า ✓" : "เฟรมปากอ้า (ไม่บังคับ)"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={!!busy}
            onChange={e => { upload(charId, `${pose.id}_talk`, e.target.files?.[0]); e.target.value = ""; }}/>
        </label>
        {(map[mainKey] || map[talkKey]) && (
          <button onClick={() => { if (map[mainKey]) revert(charId, pose.id); if (map[talkKey]) revert(charId, `${pose.id}_talk`); }} disabled={!!busy}
            style={{ marginTop: 4, width: "100%", background: "transparent", border: `1px solid ${B.ltGray}`, borderRadius: 8, padding: "4px 0", fontSize: 11, color: B.dkGray, cursor: "pointer" }}>
            ใช้รูปมาตรฐาน
          </button>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={{ background: `${B.gold}12`, border: `1px solid ${B.gold}40`, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, lineHeight: 1.7 }}>
        🎮 รูปตัวละครเกม CPR HERO — อัปโหลดรูปใหม่แทน pixel art มาตรฐานได้ทันที ไม่ต้อง deploy
        <div style={{ fontSize: 12, color: B.dkGray }}>แนะนำ: รูปพื้นหลังโปร่งใส (PNG/WebP) สัดส่วนแนวตั้ง ~4:5 · ระบบย่อให้สูงไม่เกิน 800px อัตโนมัติ · "เฟรมปากอ้า" ใช้สลับตอนตัวละครพูด มีหรือไม่มีก็ได้</div>
      </div>
      {msg && <div style={{ background: msg.ok ? `${B.green}15` : `${B.red}12`, color: msg.ok ? "#15803D" : B.red, borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13, fontWeight: 600 }}>{msg.t}</div>}
      {GAME_CHARS.map(ch => (
        <div key={ch.id} style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 8 }}>{ch.name} <span style={{ fontSize: 12, color: B.dkGray, fontWeight: 400 }}>({ch.id})</span></div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {GAME_POSES.map(p => <Cell key={p.id} charId={ch.id} pose={p}/>)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(ADMIN_SESSION_KEY) === "1");
  const [tab, setTab] = useState("pipeline");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [stats, setStats] = useState({ total: 0, finished: 0, in_progress: 0, customers: 0, line_linked: 0, bookings: 0, new_24h: 0, new_7d: 0 });
  // "เห็นแล้วล่าสุด" — ใช้ไฮไลต์นักเรียนที่สมัครหลังจากครั้งที่เปิดดูรอบก่อน
  const [studentsSeenAt, setStudentsSeenAt] = useState(() => load("admin_students_seen_at", null));
  // คูปองพาร์ทเนอร์ที่กำลังเปิดพิมพ์ — โชว์แผ่นพิมพ์แทนที่หน้าแอดมินทั้งหน้า (ไม่ใช้ window.open/print trick)
  const [printJob, setPrintJob] = useState(null);

  const currentTab = TABS.find(t => t.key === tab);
  const isCustomTab = !!currentTab?.custom;

  const fetchTab = useCallback(async (key) => {
    const t = TABS.find(x => x.key === key);
    if (t?.custom) { setRows([]); return; }
    setLoading(true);
    const orderCol = key === "online_students" ? "registered_at"
      : key === "bookings" || key === "customers" || key === "lead_promo_codes" ? "created_at"
      : key === "sales_tracking" ? "completed_date"
      : "id";
    const data = await adminRest(key, "GET", null, `?order=${orderCol}.desc.nullslast&limit=1000`);
    setRows(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  const fetchStats = useCallback(async () => {
    const [students, customers, bookings] = await Promise.all([
      adminRest("online_students", "GET", null, "?select=status,registered_at&limit=10000"),
      adminRest("customers", "GET", null, "?select=id,line_user_id&limit=10000"),
      adminRest("bookings", "GET", null, "?select=id&limit=10000"),
    ]);
    const s = Array.isArray(students) ? students : [];
    const cust = Array.isArray(customers) ? customers : [];
    const now = Date.now();
    const since = (ms) => s.filter(x => x.registered_at && (now - new Date(x.registered_at).getTime()) <= ms).length;
    setStats({
      total: s.length,
      finished: s.filter(x => (x.status || "").startsWith("จบคอร์ส")).length,
      in_progress: s.filter(x => x.status === "กำลังเรียน").length,
      customers: cust.length,
      line_linked: cust.filter(x => x.line_user_id).length,
      bookings: Array.isArray(bookings) ? bookings.length : 0,
      new_24h: since(24 * 60 * 60 * 1000),
      new_7d: since(7 * 24 * 60 * 60 * 1000),
    });
  }, []);

  useEffect(() => { if (authed) { fetchTab(tab); } }, [authed, tab, fetchTab]);
  useEffect(() => { if (authed) { fetchStats(); } }, [authed, fetchStats]);

  if (!authed) return <AdminLogin onAuth={() => setAuthed(true)}/>;
  if (printJob) return <PartnerCouponPrintSheet job={printJob} onClose={() => setPrintJob(null)}/>;

  const logout = () => {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    setAuthed(false);
  };

  const filtered = rows.filter(r => {
    if (q) {
      const s = q.toLowerCase();
      const hay = [r.name, r.phone, r.tel, r.email, r.coupon_code, r.code, r.line_id, r.source].filter(Boolean).join(" ").toLowerCase();
      if (!hay.includes(s)) return false;
    }
    if (statusFilter !== "all") {
      const st = r.status || r.payment_status || r.follow_status || "";
      if (statusFilter === "finished" && !st.startsWith("จบคอร์ส")) return false;
      if (statusFilter === "in_progress" && st !== "กำลังเรียน") return false;
      if (statusFilter === "pending_pay" && st !== "รอชำระ" && st !== "แจ้งชำระแล้ว") return false;
      if (statusFilter === "paid" && st !== "ชำระแล้ว") return false;
    }
    return true;
  });

  const exportCSV = () => {
    if (!filtered.length) return;
    const cols = currentTab.cols;
    const header = cols.join(",");
    const escape = (v) => {
      if (v == null) return "";
      const s = String(v).replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    };
    const body = filtered.map(r => cols.map(c => escape(r[c])).join(",")).join("\n");
    const csv = "﻿" + header + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jia_${tab}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // สลิปอยู่ใน bucket private แล้ว — ลิงก์ public เดิมเปิดไม่ได้ ต้องขอ signed URL ผ่าน admin-api
  const openSlip = async (url) => {
    try {
      const res = await fetch(FN_URL("admin-api"), {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "x-admin-key": _adminKey || "" },
        body: JSON.stringify({ sign_slip: { url } }),
      });
      const d = await res.json();
      if (d?.url) window.open(d.url, "_blank", "noopener"); else alert("เปิดสลิปไม่สำเร็จ: " + (d?.error || res.status));
    } catch (e) { alert("เปิดสลิปไม่สำเร็จ"); }
  };
  const fmt = (v) => {
    if (v == null || v === "") return "—";
    if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) return v.slice(0, 16).replace("T", " ");
    if (typeof v === "string" && v.includes("/slips/")) return <button onClick={() => openSlip(v)} style={{ background: "none", border: "none", padding: 0, color: B.red, textDecoration: "underline", cursor: "pointer", fontSize: "inherit" }}>ดูสลิป</button>;
    if (typeof v === "string" && v.startsWith("http")) return <a href={v} target="_blank" rel="noopener noreferrer" style={{ color: B.red, textDecoration: "underline" }}>ดูสลิป</a>;
    return String(v);
  };

  // นักเรียนใหม่ = แถวที่สมัครหลังจาก timestamp ที่เปิดดูครั้งก่อน (เก็บใน localStorage)
  const seenMs = studentsSeenAt ? new Date(studentsSeenAt).getTime() : null;
  const isNewStudent = (r) => tab === "online_students" && seenMs != null && r.registered_at && new Date(r.registered_at).getTime() > seenMs;
  const newSinceSeen = tab === "online_students" ? rows.filter(isNewStudent).length : 0;
  const markStudentsSeen = () => {
    const ts = new Date().toISOString();
    save("admin_students_seen_at", ts);
    setStudentsSeenAt(ts);
  };

  return (
    <div style={{ minHeight: "100vh", background: B.gray }}>
      <div style={{ background: B.black, color: B.white, padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <I name="lock" size={20} color={B.white}/>
          <div style={{ fontWeight: 700, fontSize: 16 }}>JIA Admin</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => { fetchTab(tab); fetchStats(); }} style={{ background: "transparent", color: B.white, border: `1px solid ${B.white}40`, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" }}>↻ รีเฟรช</button>
          <button onClick={logout} style={{ background: B.red, color: B.white, border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>ออกจากระบบ</button>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
          {[
            { label: "นักเรียนทั้งหมด", value: stats.total, color: B.red },
            { label: "🆕 ใหม่ 24 ชม.", value: stats.new_24h, color: B.gold },
            { label: "🆕 ใหม่ 7 วัน", value: stats.new_7d, color: B.gold },
            { label: "จบคอร์สแล้ว", value: stats.finished, color: B.green },
            { label: "กำลังเรียน", value: stats.in_progress, color: B.gold },
            { label: "ลูกค้าทั้งหมด", value: stats.customers, color: B.black },
            { label: "🟢 ผูก LINE แล้ว", value: stats.line_linked, color: "#06C755" },
            { label: "การจอง On-site", value: stats.bookings, color: B.dkGray },
          ].map(c => (
            <div key={c.label} style={{ background: B.white, borderRadius: 12, padding: 14, boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
              <div style={{ fontSize: 11, color: B.dkGray }}>{c.label}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: c.color, marginTop: 4 }}>{c.value}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, overflowX: "auto", marginBottom: 12, paddingBottom: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ background: tab === t.key ? B.red : B.white, color: tab === t.key ? B.white : B.dkGray, border: `1px solid ${tab === t.key ? B.red : B.ltGray}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{t.label}</button>
          ))}
        </div>

        {/* Custom tabs (Pipeline / Dashboard / Team / Voucher / Company report) */}
        {tab === "pipeline" && <Pipeline/>}
        {tab === "dashboard" && <Dashboard/>}
        {tab === "team" && <TeamManager/>}
        {tab === "voucher_issue" && <><VoucherIssuePanel/><StandingCodePanel/></>}
        {tab === "partner_coupons" && <PartnerCouponPanel onPrint={setPrintJob}/>}
        {tab === "company_report" && <CompanyReport/>}
        {tab === "game_chars" && <GameCharacterImages/>}
        {tab === "referrals" && <ReferralReport/>}

        {/* Search & filter (for table tabs only) */}
        {!isCustomTab && (
        <>
        <div style={{ background: B.white, borderRadius: 12, padding: 12, marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ค้นหา ชื่อ / เบอร์ / อีเมล / คูปอง" style={{ flex: "1 1 220px", padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13 }}/>
          {tab === "online_students" && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
              <option value="all">ทุกสถานะ</option>
              <option value="finished">จบคอร์สแล้ว</option>
              <option value="in_progress">กำลังเรียน</option>
            </select>
          )}
          {(tab === "bookings" || tab === "online_purchases") && (
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: "10px 12px", border: `1px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, background: B.white }}>
              <option value="all">ทุกสถานะการชำระ</option>
              <option value="pending_pay">รอชำระ / แจ้งชำระ</option>
              <option value="paid">ชำระแล้ว</option>
            </select>
          )}
          <button onClick={exportCSV} disabled={!filtered.length} style={{ background: B.green, color: B.white, border: "none", borderRadius: 8, padding: "10px 16px", fontSize: 13, fontWeight: 600, cursor: filtered.length ? "pointer" : "not-allowed", opacity: filtered.length ? 1 : 0.5 }}>⬇ Export CSV</button>
          <div style={{ fontSize: 12, color: B.dkGray, marginLeft: "auto" }}>{filtered.length} / {rows.length} แถว</div>
        </div>

        {/* แบนเนอร์นักเรียนใหม่ตั้งแต่ครั้งก่อน */}
        {tab === "online_students" && newSinceSeen > 0 && (
          <div style={{ background: `${B.green}12`, border: `1px solid ${B.green}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: B.black }}>🆕 มีนักเรียนใหม่ {newSinceSeen} คน ตั้งแต่ครั้งก่อน</span>
            <button onClick={markStudentsSeen} style={{ marginLeft: "auto", background: B.green, color: B.white, border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>ทำเครื่องหมายว่าดูแล้ว</button>
          </div>
        )}

        {/* Table */}
        <div style={{ background: B.white, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,.04)" }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>ไม่พบข้อมูล</div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: B.gray }}>
                    {currentTab.cols.map(c => (
                      <th key={c} style={{ padding: "10px 12px", textAlign: "left", fontWeight: 700, color: B.dkGray, fontSize: 12, borderBottom: `1px solid ${B.ltGray}`, whiteSpace: "nowrap" }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, i) => {
                    const isNew = isNewStudent(r);
                    return (
                    <tr key={r.id || i} style={{ borderBottom: `1px solid ${B.ltGray}`, background: isNew ? `${B.green}10` : "transparent" }}>
                      {currentTab.cols.map((c, ci) => (
                        <td key={c} style={{ padding: "10px 12px", verticalAlign: "top" }}>
                          {ci === 0 && isNew && <span style={{ display: "inline-block", background: B.green, color: B.white, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 4, marginRight: 6 }}>ใหม่</span>}
                          {fmt(r[c])}
                        </td>
                      ))}
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: B.dkGray }}>
          JIA Admin • แสดงสูงสุด 1000 แถวล่าสุดต่อตาราง
        </div>
        </>
        )}
      </div>
    </div>
  );
}


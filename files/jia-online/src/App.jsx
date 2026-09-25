import { Analytics } from "@vercel/analytics/react";
import { track } from "@vercel/analytics";
import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import GamePage from "./game/GamePage";
import { shuffled } from "./game/storyEngine";
import {
  B, SERIF, FREE_LAUNCH, LINE_URL, LINE_QR_URL, safeTrack, genLinkCode, randToken, getLinkCode, lineLinkDeepLink, markLineAdded, SUPABASE_URL, SUPABASE_KEY, AUTH_GATE_ENABLED, FN_URL, PRICING, PROMO_ENABLED, PROMO_FREE_MODULES, PROMO_EXPIRY_DAYS, LEAD_SOURCES, PARTNER_SOURCE, partnerLineUrl, getPartnerSponsor, supaRest, supaRpc, genCoupon, issueOnlineCoupon, activeGameVoucherCampaign, todayISOTH, thaiShortDate, genLeadCode, normalizePhone, normalizeEmail, daysUntil, genIdempotencyKey, save, load, QUIZ_DRAW_N, drawQuiz, loadLiff, getSupabase, getPosthog, phCapture, getGateVariant, isSignedUp, isPreCourseStudent, captureUTM, getUTM, FN_HEADERS, syncProgressRemote, syncHubIdentity, signInWithLine, requestEmailIdentityOtp, verifyEmailIdentityOtp, logoutAccount, startOverLearner, sanitizeFileName, captureNodeToPng, deliverBlob, dataUrlToBlob, CERT_DECO, getPurchased, savePurchased, getPendingSlips, savePendingSlips, syncPendingSlips, isModuleAccessible, calcPrice, TEASER_QUIZ, COURSE, I, Logo, css,
  REFERRAL_DISCOUNT_PCT, REFERRAL_REWARD_TEXT, captureReferral, getRefCode, referralLink, setCustomerLineLink,
} from "./lib/core";
// หน้าแอดมินแยกเป็น chunk ของตัวเอง — ผู้เรียนทั่วไปไม่ต้องดาวน์โหลดโค้ดแอดมิน
const Admin = lazy(() => import("./admin/Admin"));
// พอร์ทัล HR (/org/<token>) — chunk แยก โหลดเฉพาะคนเปิดลิงก์ของบริษัท
const CompanyPortal = lazy(() => import("./portal/CompanyPortal"));
const PORTAL_TOKEN = typeof window !== "undefined" ? (window.location.pathname.match(/^\/org\/([A-Za-z0-9_-]{24,64})\/?$/) || [])[1] || null : null;
// ==================== MORROO NETWORK ADS ====================
const MORROO_ADS = [
  { id: "advice", brand: "Morroo Advice", emoji: "🩺", tag: "AI ปรึกษาสุขภาพ", headline: "ไม่สบายใจ? ถาม AI หมอก่อน", desc: "ปรึกษาอาการกับ AI ภาษาไทย ตอบใน 5 วินาที — ฟรี 3 ครั้ง/วัน", cta: "เริ่มปรึกษาฟรี", url: "https://advice.morroo.com", bg: "#3B82F6", bgLight: "#3B82F612" },
  { id: "lab", brand: "Lab.morroo", emoji: "🔬", tag: "AI อ่านผล Lab", headline: "อ่านผล Lab ไม่เข้าใจ?", desc: "ถ่ายรูปใบผลตรวจ → AI อ่านให้ใน 30 วิ พร้อม flag ค่าผิดปกติเป็นภาษาไทย", cta: "ลองอ่านผลฟรี", url: "https://lab.morroo.com", bg: "#0EA5E9", bgLight: "#0EA5E912" },
  { id: "roodee", brand: "RooDee (รู้ดี)", emoji: "📚", tag: "ติวสอบด้วย AI", headline: "เตรียมลูกสอบ ป.1 / TCAS?", desc: "ข้อสอบ 5,000+ ข้อ · AI วิเคราะห์จุดอ่อน · Mock Exam จำลองสนามจริง", cta: "เริ่มเรียนฟรี", url: "https://pocket.morroo.com", bg: "#8B5CF6", bgLight: "#8B5CF612" },
  { id: "roodeeme", brand: "คู่มือข้างตัว", emoji: "⚕️", tag: "AI ผู้ช่วยแพทย์", headline: "หมอ/นศพ. พกคู่มือไว้ในมือถือ", desc: "ICD-10 ไทย · ตรวจยาตีกัน · คำนวณ Drug Dose · ฝึก Long Case กับ AI-คนไข้", cta: "ใช้ฟรี 20 ครั้ง/เดือน", url: "https://roodee.me", bg: "#DC2626", bgLight: "#DC262612" },
];

function MorrooAdBanner() {
  const [ad] = useState(() => MORROO_ADS[Math.floor(Math.random() * MORROO_ADS.length)]);
  const trackedUrl = `${ad.url}${ad.url.includes("?") ? "&" : "?"}utm_source=cpr.morroo.com&utm_medium=banner&utm_campaign=morroo_network&utm_content=${ad.id}`;
  return (
    <a href={trackedUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", color: "inherit", marginBottom: 16 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 18, border: `1px solid ${ad.bg}30`, position: "relative", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.04)" }}>
        <div style={{ position: "absolute", top: 10, right: 12, fontSize: 9, color: B.dkGray, letterSpacing: 1, textTransform: "uppercase", opacity: 0.55 }}>โฆษณา</div>
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ minWidth: 52, height: 52, borderRadius: 14, background: ad.bgLight, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>{ad.emoji}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: ad.bg, letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 2 }}>{ad.tag}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 4, lineHeight: 1.3 }}>{ad.headline}</div>
            <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5, marginBottom: 10 }}>{ad.desc}</div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: ad.bg, color: B.white, fontSize: 12, fontWeight: 700, padding: "7px 14px", borderRadius: 8 }}>{ad.cta} →</div>
          </div>
        </div>
        <div style={{ marginTop: 12, paddingTop: 8, borderTop: `1px solid ${B.gray}`, fontSize: 10, color: B.dkGray, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>by <strong style={{ color: ad.bg }}>{ad.brand}</strong></span>
          <span style={{ opacity: 0.6 }}>morroo network</span>
        </div>
      </div>
    </a>
  );
}

// ==================== PARTNER CONTACT CARD ====================
// การ์ดแสดง LINE + เบอร์โทรของ "พาร์ทเนอร์" ผู้มอบคูปองเรียนฟรี (ไม่ใช่ของ JIA)
// ใช้ 3 จุด: หลัง redeem คูปองพาร์ทเนอร์ / แบนเนอร์ในหน้าคอร์ส / หน้าใบประกาศหลังเรียนจบ
function PartnerContactCard({ sponsor, where, title, compact }) {
  if (!sponsor) return null;
  const lineHref = partnerLineUrl(sponsor.line);
  const telHref = sponsor.phone ? `tel:${sponsor.phone.replace(/[^0-9+]/g, "")}` : null;
  const track = (channel) => { safeTrack("partner_contact_click", { company: sponsor.company, channel, where }); phCapture("partner_contact_click", { company: sponsor.company, channel, where }); };
  if (!lineHref && !telHref) return null;
  return (
    <div style={{ background: `${B.gold}0F`, border: `1.5px dashed ${B.gold}`, borderRadius: 14, padding: compact ? "12px 14px" : 18, textAlign: "center" }}>
      <div style={{ fontSize: compact ? 13 : 15, fontWeight: 800, color: B.black, marginBottom: compact ? 8 : 10 }}>
        {title || `🎁 คอร์สนี้มอบให้ฟรีโดย ${sponsor.company}`}
      </div>
      <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
        {lineHref && <a href={lineHref} target="_blank" rel="noopener noreferrer" onClick={() => track("line")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#06C755", color: B.white, borderRadius: 10, padding: compact ? "9px 16px" : "12px 20px", textDecoration: "none", fontWeight: 700, fontSize: compact ? 13 : 14 }}>
          <I name="line" size={18} color={B.white}/> ทัก LINE {sponsor.company}
        </a>}
        {telHref && <a href={telHref} onClick={() => track("phone")}
          style={{ display: "inline-flex", alignItems: "center", gap: 8, background: B.white, color: B.black, border: `1px solid ${B.ltGray}`, borderRadius: 10, padding: compact ? "9px 16px" : "12px 20px", textDecoration: "none", fontWeight: 700, fontSize: compact ? 13 : 14 }}>
          <I name="phone" size={16} color={B.black}/> โทร {sponsor.phone}
        </a>}
      </div>
    </div>
  );
}

// ==================== NEWS / BLOG ====================
const NEWS_SITE_SLUG = "jiacpr";

function useNewsList(limit = 6) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cols = "id,url_slug,title,meta_description,cover_image_url,category,published_at,keywords";
      const data = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&select=${cols}&order=published_at.desc.nullslast&limit=${limit}`);
      if (!cancelled) { setPosts(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [limit]);
  return { posts, loading };
}

const fmtBlogDate = (d, long = false) => {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("th-TH", long ? { day: "numeric", month: "long", year: "numeric" } : { day: "numeric", month: "short" }); }
  catch (e) { return ""; }
};

const CPR_KEYWORDS = /(CPR|AED|ช่วยชีวิต|หัวใจหยุด|Heimlich|สำลัก|กดหน้าอก|ฟื้นคืนชีพ|ปั๊มหัวใจ|ช็อกหัวใจ)/i;
const isCprPost = (p) => CPR_KEYWORDS.test(p.title || "") || CPR_KEYWORDS.test(p.category || "") || CPR_KEYWORDS.test(p.meta_description || "") || CPR_KEYWORDS.test(p.keywords || "");

function NewsCarousel({ posts, openBlog, goAll, title, subtitle, accent }) {
  if (!posts || posts.length === 0) return null;
  const ac = accent || B.red;
  return (
    <div style={{ ...css.wrap, paddingTop: 8, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h3>
        <button onClick={goAll} style={{ background: "none", border: "none", color: ac, fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 4 }}>ดูทั้งหมด →</button>
      </div>
      {subtitle && <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>{subtitle}</div>}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8, scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch", marginRight: -20, paddingRight: 20 }}>
        {posts.map(p => (
          <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ flex: "0 0 230px", scrollSnapAlign: "start", background: B.white, border: "none", borderRadius: 14, overflow: "hidden", textAlign: "left", cursor: "pointer", padding: 0, boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
            {p.cover_image_url
              ? <div style={{ width: "100%", aspectRatio: "16/10", background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
              : <div style={{ width: "100%", aspectRatio: "16/10", background: `linear-gradient(135deg, ${ac}, ${B.dkRed})`, display: "flex", alignItems: "center", justifyContent: "center", color: B.white, fontSize: 13, fontWeight: 700, padding: 12, textAlign: "center" }}>{p.category || "บทความ"}</div>}
            <div style={{ padding: 12 }}>
              {p.category && <div style={{ fontSize: 10, color: ac, fontWeight: 700, marginBottom: 4, letterSpacing: .5 }}>{p.category}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
              {p.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6 }}>{fmtBlogDate(p.published_at)}</div>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function NewsSection({ openBlog, goAll, title = "ข่าวสาร & บทความ", subtitle = "", cprOnly = false, max = 6 }) {
  const { posts, loading } = useNewsList(cprOnly ? 24 : 24);
  if (loading || posts.length === 0) return null;
  const cpr = posts.filter(isCprPost).slice(0, max);
  if (cprOnly) {
    if (cpr.length === 0) return null;
    return <NewsCarousel posts={cpr} openBlog={openBlog} goAll={goAll} title={title || "บทความ CPR & การช่วยชีวิต"} subtitle={subtitle || "ทบทวนความรู้เพิ่มเติม"} accent={B.red}/>;
  }
  const general = posts.filter(p => !isCprPost(p)).slice(0, max);
  return (
    <>
      {cpr.length > 0 && <NewsCarousel posts={cpr} openBlog={openBlog} goAll={goAll} title="บทความ CPR & การช่วยชีวิต" subtitle="เนื้อหาเข้มข้นจาก JIA Trainer Center" accent={B.red}/>}
      {general.length > 0 && <NewsCarousel posts={general} openBlog={openBlog} goAll={goAll} title={title} subtitle={subtitle}/>}
    </>
  );
}

// ข่าวช่วยชีวิต/AED จากฟีดสาธารณะของ jiaaed.com — ทุกการ์ดลิงก์ออกไปข่าวต้นฉบับ
// (ลิขสิทธิ์เป็นของสำนักข่าวเดิม) ถ้าฟีดล่ม/ออฟไลน์จะซ่อนทั้ง section
function JiaAedNewsSection({ max = 5 }) {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`https://jiaaed.com/api/news/public?limit=${max}`);
        const data = res.ok ? await res.json() : null;
        if (!cancelled) setItems(Array.isArray(data?.items) ? data.items : []);
      } catch (e) { if (!cancelled) setItems([]); }
    })();
    return () => { cancelled = true; };
  }, [max]);
  if (!items || items.length === 0) return null;
  return (
    <div style={{ ...css.wrap, paddingTop: 8, paddingBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>ข่าวช่วยชีวิต & AED</h3>
        <a href="https://jiaaed.com" target="_blank" rel="noopener noreferrer" style={{ color: B.red, fontSize: 13, fontWeight: 600, textDecoration: "none", padding: 4 }}>jiaaed.com →</a>
      </div>
      <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>อัปเดตจาก JiaAED — แตะข่าวเพื่ออ่านต้นฉบับ</div>
      {items.map((n, i) => (
        <a key={n.source_url || i} href={n.source_url} target="_blank" rel="noopener noreferrer" style={{ display: "block", padding: "12px 14px", marginBottom: 8, background: B.white, borderRadius: 14, textDecoration: "none", boxShadow: "0 2px 8px rgba(0,0,0,.06)" }}>
          <div style={{ fontSize: 10, color: B.red, fontWeight: 700, marginBottom: 3, letterSpacing: .5 }}>{[n.topic, n.source_name].filter(Boolean).join(" · ")}</div>
          <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.45 }}>{n.source_title}</div>
          {n.our_blurb && <div style={{ fontSize: 12, color: B.dkGray, marginTop: 4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.our_blurb}</div>}
          {n.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 5 }}>{fmtBlogDate(n.published_at, true)}</div>}
        </a>
      ))}
    </div>
  );
}

function BlogList({ goBack, openBlog }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const cols = "id,url_slug,title,meta_description,cover_image_url,category,published_at";
      const data = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&select=${cols}&order=published_at.desc.nullslast&limit=60`);
      if (!cancelled) { setPosts(Array.isArray(data) ? data : []); setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, []);
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>ข่าวสาร & บทความ</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        {loading ? <div style={{ textAlign: "center", color: B.dkGray, padding: 40 }}>กำลังโหลด...</div>
          : posts.length === 0 ? <div style={{ textAlign: "center", color: B.dkGray, padding: 40 }}>ยังไม่มีบทความ</div>
          : posts.map(p => (
            <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ display: "flex", gap: 12, width: "100%", padding: 12, marginBottom: 10, background: B.white, border: "none", borderRadius: 14, cursor: "pointer", textAlign: "left", alignItems: "flex-start" }}>
              {p.cover_image_url
                ? <div style={{ width: 96, height: 72, flexShrink: 0, borderRadius: 10, background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
                : <div style={{ width: 96, height: 72, flexShrink: 0, borderRadius: 10, background: `linear-gradient(135deg, ${B.red}, ${B.dkRed})` }}/>}
              <div style={{ flex: 1, minWidth: 0 }}>
                {p.category && <div style={{ fontSize: 10, color: B.red, fontWeight: 700, marginBottom: 2 }}>{p.category}</div>}
                <div style={{ fontSize: 13, fontWeight: 700, color: B.black, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
                {p.published_at && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 4 }}>{fmtBlogDate(p.published_at, true)}</div>}
              </div>
            </button>
          ))}
      </div>
    </div>
  );
}

function BlogDetail({ slug, goBack, openBlog }) {
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [related, setRelated] = useState([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await supaRest("blog_posts", "GET", null, `?url_slug=eq.${encodeURIComponent(slug)}&select=*&limit=1`);
      const p = Array.isArray(data) && data[0] ? data[0] : null;
      if (!cancelled) { setPost(p); setLoading(false); }
      if (p) {
        const cols = "id,url_slug,title,cover_image_url,category,published_at";
        const rel = await supaRest("blog_posts", "GET", null, `?site_slug=eq.${NEWS_SITE_SLUG}&url_slug=neq.${encodeURIComponent(slug)}&select=${cols}&order=published_at.desc.nullslast&limit=4`);
        if (!cancelled) setRelated(Array.isArray(rel) ? rel : []);
      }
    })();
    return () => { cancelled = true; };
  }, [slug]);
  if (loading) return (<div style={css.page}><div style={css.header(B.red)}><button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>กำลังโหลด...</div></div></div>);
  if (!post) return (<div style={css.page}><div style={css.header(B.red)}><button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ไม่พบบทความ</div></div><div style={{ ...css.wrap, paddingTop: 40, textAlign: "center", color: B.dkGray }}>บทความนี้อาจถูกลบหรือยังไม่เผยแพร่</div></div>);
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={goBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 14, fontWeight: 700, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 16, paddingBottom: 60 }}>
        {post.cover_image_url && <img src={post.cover_image_url} alt={post.title} style={{ width: "100%", borderRadius: 14, marginBottom: 14, display: "block" }}/>}
        {post.category && <div style={{ fontSize: 11, color: B.red, fontWeight: 700, marginBottom: 6, letterSpacing: .5 }}>{post.category.toUpperCase()}</div>}
        <h1 style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.3, margin: "0 0 10px" }}>{post.title}</h1>
        {post.published_at && <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 18 }}>{fmtBlogDate(post.published_at, true)}</div>}
        {post.meta_description && <div style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6, marginBottom: 16, padding: "12px 14px", background: `${B.gold}10`, borderLeft: `3px solid ${B.gold}`, borderRadius: 6 }}>{post.meta_description}</div>}
        {post.content_html && <div className="jia-blog-content" style={{ fontSize: 15, lineHeight: 1.8, color: B.black, wordBreak: "break-word" }} dangerouslySetInnerHTML={{ __html: post.content_html }}/>}
        {related.length > 0 && <>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 32, marginBottom: 12 }}>บทความอื่นที่น่าสนใจ</h3>
          {related.map(p => (
            <button key={p.id} onClick={() => openBlog(p.url_slug)} style={{ display: "flex", gap: 12, width: "100%", padding: 10, marginBottom: 8, background: B.white, border: "none", borderRadius: 12, cursor: "pointer", textAlign: "left", alignItems: "center" }}>
              {p.cover_image_url
                ? <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, background: `${B.gray} url(${p.cover_image_url}) center/cover no-repeat` }}/>
                : <div style={{ width: 64, height: 64, flexShrink: 0, borderRadius: 10, background: `linear-gradient(135deg, ${B.red}, ${B.dkRed})` }}/>}
              <div style={{ flex: 1, minWidth: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{p.title}</div>
            </button>
          ))}
        </>}
      </div>
    </div>
  );
}

// ==================== LANDING ====================
// ==================== ขอใบกำกับภาษีเต็มรูป ====================
// ผู้ซื้อ/บริษัทกรอกข้อมูลผู้เสียภาษี → RPC request_tax_invoice (ตรวจเลข 13 หลัก + ผูกการซื้อล่าสุดถ้าเบอร์ตรงและชำระแล้ว)
// แอดมินออกใบใน FlowAccount แล้วบันทึกเลขที่ในแท็บ "ใบกำกับภาษี" ส่งให้ทางอีเมล/LINE
const taxIdValid = (v) => { const d = (v || "").replace(/\D/g, ""); if (d.length !== 13) return false; let s = 0; for (let i = 0; i < 12; i++) s += Number(d[i]) * (13 - i); return (11 - (s % 11)) % 10 === Number(d[12]); };
function TaxInvoicePage({ go, user }) {
  const lp = load("last_purchase", null);
  const [f, setF] = useState({ buyerType: "company", name: "", taxId: "", branch: "สำนักงานใหญ่", address: "", email: "", phone: user?.phone || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const set = (k) => (e) => { setF({ ...f, [k]: e.target.value }); setErr(""); };
  const submit = async () => {
    if (!taxIdValid(f.taxId)) { setErr("เลขประจำตัวผู้เสียภาษีไม่ถูกต้อง (13 หลัก)"); return; }
    setBusy(true);
    const r = await supaRpc("request_tax_invoice", { p: { ...f, purchaseId: lp?.purchase_id || null, stripeSessionId: lp?.session_id || null } });
    setBusy(false);
    if (!r) { setErr("ส่งคำขอไม่สำเร็จ กรุณาลองใหม่ หรือติดต่อ LINE @jiacpr"); return; }
    if (r.error) { setErr(r.error); return; }
    setDone(r); safeTrack("tax_invoice_request", { linked: !!r.linked }); phCapture("tax_invoice_request", { linked: !!r.linked });
  };
  const inp = { width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "inherit" };
  const field = (k, label, ph, extra = {}) => <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label>{extra.area ? <textarea rows={3} value={f[k]} onChange={set(k)} placeholder={ph} style={{ ...inp, resize: "vertical" }}/> : <input value={f[k]} onChange={set(k)} placeholder={ph} inputMode={extra.inputMode} style={inp}/>}</div>;
  return (<div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ขอใบกำกับภาษีเต็มรูป</div></div>
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
      {done ? <div style={{ ...css.card, textAlign: "center" }} data-testid="tax-invoice-done">
        <div style={{ fontSize: 40 }}>✅</div>
        <div style={{ fontSize: 17, fontWeight: 800, margin: "8px 0" }}>ได้รับคำขอแล้ว</div>
        <div style={{ fontSize: 13.5, color: B.dkGray, lineHeight: 1.6 }}>ทีมงานจะออกใบกำกับภาษีและส่งให้{f.email ? `ทางอีเมล ${f.email}` : "ทาง LINE/เบอร์โทรที่ให้ไว้"} ภายใน 3 วันทำการ{done.linked ? "" : " (ไม่พบรายการซื้อที่ชำระแล้วของเบอร์นี้ในเครื่อง — ทีมงานจะตรวจสอบยอดให้)"}</div>
        <button onClick={() => go("course")} style={{ ...css.btn(B.black, B.white, true), marginTop: 16 }}>กลับหน้าบทเรียน</button>
      </div> : <>
        <div style={{ ...css.card, marginBottom: 14 }}>
          <div style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.6, marginBottom: 14 }}>สำหรับบริษัท/ผู้ที่ต้องการใบกำกับภาษีเต็มรูปของคอร์สออนไลน์ที่ชำระแล้ว{lp ? " — ระบบจะแนบรายการซื้อล่าสุดบนเครื่องนี้ให้อัตโนมัติ" : ""}</div>
          <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
            {[["company", "นิติบุคคล"], ["person", "บุคคลธรรมดา"]].map(([v, l]) => <button key={v} onClick={() => setF({ ...f, buyerType: v, branch: v === "company" ? (f.branch || "สำนักงานใหญ่") : "" })} style={{ flex: 1, padding: "10px", borderRadius: 10, border: `2px solid ${f.buyerType === v ? B.red : B.ltGray}`, background: f.buyerType === v ? `${B.red}08` : B.white, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}
          </div>
          {field("name", f.buyerType === "company" ? "ชื่อบริษัท *" : "ชื่อ-นามสกุล *", f.buyerType === "company" ? "เช่น บริษัท ตัวอย่าง จำกัด" : "")}
          {field("taxId", "เลขประจำตัวผู้เสียภาษี 13 หลัก *", "", { inputMode: "numeric" })}
          {f.buyerType === "company" && field("branch", "สาขา", "สำนักงานใหญ่ / สาขาที่ 00001")}
          {field("address", "ที่อยู่ตามทะเบียน *", "เลขที่ ถนน แขวง/ตำบล เขต/อำเภอ จังหวัด รหัสไปรษณีย์", { area: true })}
          {field("email", "อีเมลรับใบกำกับภาษี", "เช่น account@company.com")}
          {field("phone", "เบอร์โทรที่ใช้ตอนซื้อ *", "", { inputMode: "tel" })}
          {err && <div style={{ color: B.red, fontSize: 13, marginBottom: 8 }}>{err}</div>}
        </div>
        <button onClick={submit} disabled={busy} style={{ ...css.btn(B.red, B.white, true), opacity: busy ? .6 : 1 }}>{busy ? "กำลังส่ง..." : "ส่งคำขอใบกำกับภาษี"}</button>
      </>}
    </div></div>);
}

// ==================== รีวิวคอร์ส ====================
// ฟอร์มรีวิว (หน้าใบประกาศ) — ต้องสมัครครบ (customer_id + phone) และเรียนจบ; server ตรวจซ้ำทั้งหมด
function ReviewForm({ user }) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [state, setState] = useState(() => (load("review_sent", false) ? "sent" : "idle")); // idle | busy | sent
  const [err, setErr] = useState("");
  if (!user?.customer_id || !user?.phone) return null;
  if (state === "sent") return <div style={{ ...css.card, marginTop: 14, textAlign: "center", fontSize: 13.5, color: B.dkGray }}>ขอบคุณสำหรับรีวิว 🙏 รีวิวจะแสดงบนหน้าเว็บหลังทีมงานตรวจสอบ</div>;
  const submit = async () => {
    if (!rating) { setErr("กรุณาให้คะแนนดาว"); return; }
    setState("busy");
    const r = await supaRpc("submit_course_review", { p_customer_id: user.customer_id, p_phone: user.phone, p_rating: rating, p_comment: comment });
    if (r?.ok) { save("review_sent", true); setState("sent"); safeTrack("review_submit", { rating }); phCapture("review_submit", { rating }); }
    else { setErr(r?.error || "ส่งรีวิวไม่สำเร็จ กรุณาลองใหม่"); setState("idle"); }
  };
  return <div data-testid="review-form" style={{ ...css.card, marginTop: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>รีวิวคอร์สนี้</div>
    <div style={{ fontSize: 12.5, color: B.dkGray, marginBottom: 10 }}>ความเห็นของคุณช่วยให้คนอื่นตัดสินใจเรียน CPR ได้ง่ายขึ้น</div>
    <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} aria-label={`${n} ดาว`} onClick={() => { setRating(n); setErr(""); }} style={{ background: "none", border: "none", padding: 2, cursor: "pointer", fontSize: 30, lineHeight: 1, color: n <= rating ? B.gold : B.ltGray }}>★</button>)}</div>
    <textarea value={comment} onChange={(e) => setComment(e.target.value.slice(0, 600))} rows={3} placeholder="เล่าสั้น ๆ ว่าได้อะไรจากคอร์สนี้ (ไม่บังคับ)" style={{ width: "100%", padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }}/>
    {err && <div style={{ color: B.red, fontSize: 12.5, marginTop: 6 }}>{err}</div>}
    <button onClick={submit} disabled={state === "busy"} style={{ ...css.btn(B.black, B.white, true), marginTop: 10, padding: "12px 20px", fontSize: 14 }}>{state === "busy" ? "กำลังส่ง..." : "ส่งรีวิว"}</button>
  </div>;
}
// รีวิวที่อนุมัติแล้วบนหน้าแรก — ยังไม่มีรีวิวเลยก็ซ่อนทั้งส่วน
function ReviewsSection() {
  const [d, setD] = useState(null);
  useEffect(() => { supaRpc("public_course_reviews", { p_limit: 12 }).then((r) => { if (r?.reviews?.length) setD(r); }); }, []);
  if (!d) return null;
  return <div style={{ ...css.wrap, paddingTop: 28 }} data-testid="reviews-section">
    <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
      <h3 style={{ fontSize: 18, fontWeight: 800 }}>ผู้เรียนว่าอย่างไร</h3>
      <span style={{ fontSize: 13, color: B.dkGray }}><span style={{ color: B.gold }}>★</span> {d.avg} จาก {d.count} รีวิว</span>
    </div>
    <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 6, scrollSnapType: "x mandatory" }}>
      {d.reviews.map((r, i) => <div key={i} style={{ ...css.card, padding: 16, flex: "0 0 78%", maxWidth: 320, scrollSnapAlign: "start" }}>
        <div style={{ color: B.gold, fontSize: 15, letterSpacing: 1 }}>{"★".repeat(r.rating)}<span style={{ color: B.ltGray }}>{"★".repeat(5 - r.rating)}</span></div>
        <div style={{ fontSize: 13.5, lineHeight: 1.6, margin: "6px 0 8px" }}>“{r.comment}”</div>
        <div style={{ fontSize: 12, color: B.dkGray, fontWeight: 600 }}>— {r.name}</div>
      </div>)}
    </div>
  </div>;
}

// ==================== คู่มือฉุกเฉิน + ติดตั้งแอป (PWA) ====================
// ปุ่มติดตั้งโผล่เฉพาะเบราว์เซอร์ที่ยิง beforeinstallprompt (Chrome/Android) — iOS ใช้ "เพิ่มไปยังหน้าจอโฮม" เอง
let _installEvt = null;
const _installListeners = new Set();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); _installEvt = e; _installListeners.forEach((f) => f(true)); });
  window.addEventListener("appinstalled", () => { _installEvt = null; _installListeners.forEach((f) => f(false)); safeTrack("pwa_installed"); phCapture("pwa_installed", {}); });
}
function EmergencyGuideCard({ compact = false }) {
  const [canInstall, setCanInstall] = useState(!!_installEvt);
  useEffect(() => { _installListeners.add(setCanInstall); return () => { _installListeners.delete(setCanInstall); }; }, []);
  const install = async () => {
    if (!_installEvt) return;
    _installEvt.prompt();
    try { const r = await _installEvt.userChoice; safeTrack("pwa_install_prompt", { outcome: r?.outcome }); } catch (e) {}
    _installEvt = null; setCanInstall(false);
  };
  return <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: compact ? 12 : 14 }}>
    <a href="/emergency.html" onClick={() => { safeTrack("emergency_guide_open"); phCapture("emergency_guide_open", {}); }} style={{ flex: "1 1 200px", display: "flex", alignItems: "center", gap: 10, background: B.white, border: `1px solid ${B.red}33`, borderRadius: 14, padding: "12px 14px", color: B.black, textDecoration: "none" }}>
      <span style={{ fontSize: 22 }}>🚨</span>
      <span style={{ flex: 1 }}><span style={{ display: "block", fontSize: 14, fontWeight: 800 }}>คู่มือ CPR ฉุกเฉิน</span><span style={{ display: "block", fontSize: 11.5, color: B.dkGray }}>ขั้นตอน + จังหวะกด 110/นาที · ใช้ได้แม้ออฟไลน์</span></span>
      <I name="arrow" size={14} color={B.dkGray}/>
    </a>
    {canInstall && <button onClick={install} style={{ ...css.btn(B.black, B.white), flex: "0 0 auto", padding: "12px 16px", fontSize: 13 }}>📲 ติดตั้งแอป</button>}
  </div>;
}

function Landing({ go, enterCourse, openBlog, goGameRandom }) {
  const [a, setA] = useState(false); useEffect(() => { setTimeout(() => setA(true), 100); }, []);
  return (<div style={css.page}>
    <div style={{ background: `linear-gradient(135deg, ${B.red} 0%, ${B.dkRed} 100%)`, color: B.white, padding: "52px 24px 56px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -60, right: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,.06)" }}/>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 480, margin: "0 auto", opacity: a ? 1 : 0, transform: a ? "translateY(0)" : "translateY(20px)", transition: "all .6s ease" }}>
        <div style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: .85, marginBottom: 8, fontWeight: 600 }}>JIA TRAINER CENTER</div>
        <h1 style={{ fontSize: 34, fontWeight: 800, margin: "0 0 4px", lineHeight: 1.2 }}>คอร์ส CPR & AED</h1>
        <h2 style={{ fontSize: 24, fontWeight: 300, margin: "0 0 16px", opacity: .95 }}>ออนไลน์</h2>
        {FREE_LAUNCH && <div style={{ display: "inline-block", background: B.gold, color: B.black, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>เรียนฟรี! เดือนแรกเท่านั้น</div>}
        {!FREE_LAUNCH && <div style={{ display: "inline-block", background: B.gold, color: B.black, borderRadius: 8, padding: "6px 16px", fontSize: 13, fontWeight: 800, marginBottom: 12 }}>บทที่ 1 เรียนฟรี!</div>}
        <p style={{ fontSize: 14, opacity: .9, lineHeight: 1.7, marginBottom: 28 }}>เรียนรู้การช่วยชีวิตขั้นพื้นฐาน มาตรฐาน 2025<br/>ดูวิดีโอ • ทำแบบทดสอบ • รับใบประกาศนียบัตร</p>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 14, background: "rgba(255,255,255,.15)", borderRadius: 16, padding: "14px 28px", marginBottom: 28 }}>
          {FREE_LAUNCH ? (<><span style={{ fontSize: 44, fontWeight: 800 }}>ฟรี!</span><div style={{ textAlign: "left", fontSize: 12 }}><div style={{ textDecoration: "line-through", opacity: .7 }}>ปกติ ฿100</div><div style={{ opacity: .85 }}>+ คูปองส่วนลด ฿100</div></div></>) : (<><span style={{ fontSize: 44, fontWeight: 800 }}>฿35</span><div style={{ textAlign: "left", fontSize: 12 }}><div style={{ opacity: .85 }}>ต่อหัวข้อ</div><div style={{ opacity: .7 }}>Full Course ฿149</div></div></>)}
        </div>
        <div><button onClick={enterCourse} style={{ ...css.btn(B.white, B.red), padding: "16px 52px", fontSize: 16 }}>{FREE_LAUNCH ? "เรียนฟรีเลย →" : "เรียนเลย →"}</button></div>
        {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_redeemed", false) && <div style={{ marginTop: 14 }}>
          <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ width: "100%", maxWidth: 360, background: B.gold, border: "none", borderRadius: 14, color: B.black, fontSize: 16, fontWeight: 800, padding: "15px 24px", cursor: "pointer", boxShadow: "0 6px 20px rgba(0,0,0,.28)", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>🎟️ มีโค้ดแล้ว? กดใส่โค้ดเลย →</button>
          <div style={{ fontSize: 12, opacity: .9, marginTop: 8, fontWeight: 600 }}>ได้รับโค้ดจากเจ้าหน้าที่? ใส่ที่นี่เพื่อเรียนฟรี</div>
        </div>}
      </div>
    </div>

    <ReviewsSection/>
    {/* CPR HERO — เกมภารกิจพลเมืองดี (เล่นฟรีทุกเคส) */}
    <div style={{ ...css.wrap, paddingTop: 24 }}>
      <EmergencyGuideCard/>
      <button onClick={() => { safeTrack("game_banner_click", { from: "landing" }); phCapture("game_banner_click", { from: "landing" }); (goGameRandom || (() => go("game")))(); }} style={{ width: "100%", background: "linear-gradient(135deg, #10182F 0%, #2B3D77 100%)", color: B.white, border: "none", borderRadius: 16, padding: 18, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 16px rgba(16,24,47,.35)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 26 }}>🚨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#F2C14E", textTransform: "uppercase", letterSpacing: 1 }}>เกมใหม่ • เล่นฟรี</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>CPR HERO — ภารกิจพลเมืองดี</div>
          <div style={{ fontSize: 12, opacity: .85, marginTop: 2 }}>จำลองเหตุจริง 6 สถานการณ์ • ตัดสินใจผิด ผู้ป่วยแย่ลงจริง</div>
        </div>
        <I name="arrow" size={18} color={B.white}/>
      </button>
    </div>

    {/* Lead Capture CTA — แสดงเมื่อ promo เปิด หลังจบ free launch และยังไม่เคย claim โค้ด */}
    {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_code", null) && <div style={{ ...css.wrap, paddingTop: 24 }}>
      <button onClick={() => { save("claim_start_redeem", false); go("claim"); }} style={{ width: "100%", background: `linear-gradient(135deg, ${B.gold} 0%, #E08800 100%)`, color: B.white, border: "none", borderRadius: 16, padding: 18, cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 4px 16px rgba(245,158,11,.25)" }}>
        <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I name="star" size={26} color={B.white}/></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .9, textTransform: "uppercase", letterSpacing: 1 }}>โปรพิเศษ</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 2 }}>รับโค้ดเรียนฟรี 3 บทหลัก</div>
          <div style={{ fontSize: 12, opacity: .95, marginTop: 2 }}>แค่กรอกข้อมูล • มูลค่า ฿{PRICING.bundle3}</div>
        </div>
        <I name="arrow" size={18} color={B.white}/>
      </button>
    </div>}

    {/* Pricing Section */}
    {!FREE_LAUNCH && <div style={{ ...css.wrap, paddingTop: 36, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เลือกแพ็กเกจ</h3>
      {[
        { label: "1 หัวข้อ", price: "฿35", desc: "เลือกหัวข้อที่สนใจ", bg: B.white, border: B.ltGray, badge: null },
        { label: "3 หัวข้อ", price: "฿100", desc: "เฉลี่ย ฿33/หัวข้อ", bg: B.white, border: B.ltGray, badge: "ประหยัด 5%" },
        { label: "Full Course", price: "฿149", desc: "6 หัวข้อ + Final Exam + Certificate + คูปอง On-site ฿100", bg: `${B.red}06`, border: B.red, badge: "แนะนำ" },
      ].map((p, i) => (
        <div key={i} style={{ background: p.bg, borderRadius: 14, padding: 16, marginBottom: 12, border: `2px solid ${p.border}`, position: "relative" }}>
          {p.badge && <div style={{ position: "absolute", top: -10, right: 12, background: p.badge === "แนะนำ" ? B.red : B.gold, color: B.white, fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 8 }}>{p.badge}</div>}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div><div style={{ fontWeight: 700, fontSize: 15 }}>{p.label}</div><div style={{ fontSize: 12, color: B.dkGray, marginTop: 2 }}>{p.desc}</div></div>
            <div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{p.price}</div>
          </div>
        </div>
      ))}
      <button onClick={() => go("store")} style={{ ...css.btn(B.red, B.white, true), marginTop: 4 }}>เลือกซื้อหัวข้อ →</button>
    </div>}

    <div style={{ ...css.wrap, paddingTop: FREE_LAUNCH ? 36 : 0, paddingBottom: 24 }}>
      <h3 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, textAlign: "center" }}>เรียนอะไรบ้าง?</h3>
      {COURSE.modules.slice(0, 6).map((m, i) => (<div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 12, background: B.white, borderRadius: 14, padding: "14px 16px" }}><div style={{ minWidth: 38, height: 38, borderRadius: 10, background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", color: B.red, fontWeight: 800, fontSize: 15 }}>{String(i + 1).padStart(2, "0")}</div><div><div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{m.short} {i === 0 && !FREE_LAUNCH ? <span style={{ background: B.green, color: B.white, fontSize: 10, padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>ฟรี</span> : null}</div><div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>{m.desc}</div></div></div>))}
      <div style={{ background: `${B.gold}18`, borderRadius: 14, padding: 16, textAlign: "center", marginTop: 4 }}><I name="cert" size={26} color={B.gold}/><div style={{ fontWeight: 600, fontSize: 14, marginTop: 6 }}>+ แบบทดสอบสุดท้าย & ใบประกาศนียบัตร</div></div>
    </div>
    <NewsSection openBlog={openBlog} goAll={() => go("blog")} title="ข่าวสาร & บทความ" subtitle="อัปเดตใหม่ทุกวัน — เคสจริง บทความ และทิปส์ช่วยชีวิต"/>
    <JiaAedNewsSection/>
    <div style={{ ...css.wrap, paddingBottom: 24 }}>
      <div style={{ background: B.white, borderRadius: 16, padding: 24, border: `1px solid ${B.red}12` }}>
        <div style={{ textAlign: "center", marginBottom: 16 }}><h3 style={{ fontSize: 17, fontWeight: 700, margin: 0 }}>ทำไมต้องเรียน CPR?</h3><p style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ข้อมูลจากงานวิจัย</p></div>
        {[{ n: "10%", c: B.red, t: "ทุก 1 นาทีที่ไม่ได้ทำ CPR\nโอกาสรอดชีวิตลดลง 10%" }, { n: "3-6 เดือน", c: B.gold, t: "ทักษะ CPR เสื่อมลง\nภายใน 3-6 เดือนหลังอบรม" }, { n: "58%", c: B.green, t: "ผู้ทบทวนทุกเดือนทำได้ \"ดีเยี่ยม\"\nเทียบกับ 15% ที่ทบทวนปีละครั้ง" }].map((r, i) => (<div key={i} style={{ background: `${r.c}08`, borderRadius: 12, padding: 14, marginBottom: 14, borderLeft: `4px solid ${r.c}` }}><div style={{ fontSize: 28, fontWeight: 800, color: r.c }}>{r.n}</div><div style={{ fontSize: 13, marginTop: 4, lineHeight: 1.5, whiteSpace: "pre-line" }}>{r.t}</div></div>))}
      </div>
    </div>
    <div style={{ ...css.wrap, paddingBottom: 16 }}><MorrooAdBanner/></div>
    <div style={{ ...css.wrap, paddingBottom: 100 }}><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>{[{ icon: "play", l: "6 วิดีโอ", s: "เรียนได้ทุกที่" },{ icon: "book", l: "Quiz ทุกบท", s: "ทดสอบความเข้าใจ" },{ icon: "cert", l: "ใบประกาศฯ", s: "มาตรฐาน 2025" },{ icon: "heart", l: "คูปอง ฿100", s: "ใช้ตอนเรียน on-site" }].map((f, i) => (<div key={i} style={{ background: B.white, borderRadius: 14, padding: 16, textAlign: "center" }}><I name={f.icon} size={22} color={B.red}/><div style={{ fontWeight: 600, fontSize: 13, marginTop: 6 }}>{f.l}</div><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{f.s}</div></div>))}</div></div>
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.08)", zIndex: 100 }}><div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><div><div style={{ fontSize: 11, color: B.dkGray }}>{FREE_LAUNCH ? "ช่วง Launch พิเศษ" : "เริ่มต้น"}</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>{FREE_LAUNCH ? "ฟรี!" : "฿35/หัวข้อ"}</div></div><div style={{ display: "flex", gap: 8 }}><button onClick={() => { const txt = "เรียน CPR & AED ออนไลน์! ได้ใบ Certificate + คูปองส่วนลด"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://cpr.morroo.com" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://cpr.morroo.com") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn(B.white, B.red), padding: "10px 14px", border: `1px solid ${B.red}30`, fontSize: 13 }}>แชร์</button><button onClick={enterCourse} style={css.btn(B.red, B.white)}>{FREE_LAUNCH ? "เรียนฟรี" : "เรียนเลย"}</button></div></div></div>
  </div>);
}

// ==================== STORE (เลือกซื้อหัวข้อ) ====================
function Store({ go, setUser }) {
  const [selected, setSelected] = useState([]);
  const [step, setStep] = useState("select"); // select → payment → done
  const [uploading, setUploading] = useState(false);
  const [slipDone, setSlipDone] = useState(false);
  const purchased = getPurchased();
  // snapshot ครั้งเดียวตอน mount (ไม่ใช้ค่าที่คำนวณใหม่ทุก render) — การ์ดกรอกชื่อ-เบอร์
  // ด้านล่างผูกกับตัวนี้ ไม่ใช่ buyerReady ที่เปลี่ยนตามการพิมพ์ กัน input หายจาก DOM
  // กลางคันตอนผู้ใช้ยังพิมพ์ไม่เสร็จ (เคยทำให้ปุ่ม Stripe ดูเหมือนกดไม่ได้บนมือถือ)
  const [user] = useState(() => load("user", null));
  const buyable = COURSE.modules.filter(m => m.id <= 6 && !purchased.includes(m.id));
  // เข้าหน้านี้ได้ตรงจาก Landing โดยไม่ผ่านสมัคร (go("store") ที่ปุ่ม "เลือกซื้อหัวข้อ")
  // จึงอาจยังไม่มี user เลย — ต้องเก็บชื่อ+เบอร์ก่อนเข้าสู่ขั้นตอนจ่ายเงินจริง (server
  // ปฏิเสธคำขอที่ไม่มีเบอร์แล้ว กันแถว online_purchases ที่ไม่มีเบอร์ผูกไว้)
  const [buyerName, setBuyerName] = useState(user?.name || "");
  const [buyerPhone, setBuyerPhone] = useState(user?.phone || "");
  const buyerReady = buyerName.trim() && normalizePhone(buyerPhone).length >= 9;
  const ensureBuyer = () => {
    if (!buyerReady) { alert("กรุณากรอกชื่อ-นามสกุลและเบอร์โทรที่ถูกต้องก่อนชำระเงิน"); return null; }
    // รวมกับ user เดิม — เดิมเขียนทับเหลือแค่ชื่อ+เบอร์ ทำให้ customer_id/auth_user_id (ล็อกอิน LINE) หายหลังกดชำระเงิน
    const u = { ...(load("user", null) || {}), name: buyerName.trim(), phone: normalizePhone(buyerPhone) };
    setUser(u);
    return u;
  };

  const toggle = (id) => setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const selectAll = () => setSelected(buyable.map(m => m.id));
  const total = calcPrice(selected.length);
  const isFull = selected.length + purchased.filter(x => x <= 6).length >= 6;

  // มาจากลิงก์ชวนเพื่อน → โชว์ส่วนลดเมื่อจ่ายผ่าน Stripe (ราคาจริงคำนวณใหม่ใน stripe-checkout; โอน+สลิปไม่มีส่วนลดนี้)
  const [refCode, setRefCode] = useState(null);
  useEffect(() => { const c = getRefCode(); if (c) supaRpc("referral_code_valid", { p_code: c }).then((ok) => { if (ok === true) setRefCode(c); }); }, []);
  const refDiscount = refCode ? Math.floor(total * REFERRAL_DISCOUNT_PCT / 100) : 0;
  const [stripePaying, setStripePaying] = useState(false);
  const payWithStripe = async () => {
    const buyer = ensureBuyer();
    if (!buyer) return;
    setStripePaying(true);
    try {
      // ราคา/รายการที่ส่งไปนี้เป็นแค่ค่าที่ใช้แสดงผล — stripe-checkout คำนวณราคาจริงใหม่
      // ฝั่ง server จาก metadata.modules เอง (ไม่เชื่อ amount/items จาก client แล้ว) และ
      // เป็นคนสร้างระเบียน "รอชำระ" ให้เองด้วย (client ไม่ต้อง insert online_purchases เอง)
      const moduleNames = selected.map(id => COURSE.modules.find(x => x.id === id)?.short).filter(Boolean);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/stripe-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
        body: JSON.stringify({
          type: "online_purchase",
          items: [{ name: `JIA Online: ${moduleNames.join(", ")}`, amount: total }],
          metadata: { phone: buyer.phone, modules: selected.join(","), name: buyer.name, ...(refCode ? { ref_code: refCode } : {}) },
          successUrl: window.location.origin + window.location.pathname + "?stripe=success",
          cancelUrl: window.location.origin + window.location.pathname + "?stripe=cancel",
        }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else alert("เกิดข้อผิดพลาด: " + (data.error || "ไม่สามารถสร้างลิงก์ชำระเงินได้"));
    } catch(err) { alert("เกิดข้อผิดพลาด กรุณาลองใหม่"); console.error(err); }
    setStripePaying(false);
  };

  const handleSlip = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const buyer = ensureBuyer();
    if (!buyer) { e.target.value = ""; return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileName = buyer.name + "_course_" + Date.now() + "_" + randToken() + ".jpg";
        const byteChars = atob(reader.result.split(",").pop());
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: "image/jpeg" });
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
          body: blob
        });
        if (uploadRes.ok) {
          const data = { url: `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}` };
          // ต้องบันทึกรายการแจ้งชำระให้สำเร็จก่อน จึงปลดล็อก — กันเคสจ่ายแล้วแต่ไม่มี record ให้แอดมินตรวจ
          const rec = await supaRest("online_purchases", "POST", { phone: buyer.phone, modules: selected.join(","), amount: total, slip_url: data.url, payment_status: "แจ้งชำระแล้ว" });
          if (Array.isArray(rec) && rec.length) {
            // ไม่ปลดล็อกทันที — เข้าคิวรอแอดมินตรวจสลิป (Course จะ sync สถานะให้อัตโนมัติ)
            savePendingSlips([...getPendingSlips(), { id: rec[0].id, modules: selected, at: Date.now() }]);
            save("last_purchase", { purchase_id: rec[0].id, modules: selected.join(","), at: Date.now() }); // อ้างอิงตอนขอใบกำกับภาษี
            setSlipDone(true);
          } else {
            alert("บันทึกการแจ้งชำระไม่สำเร็จ กรุณาส่งสลิปทาง LINE แทน");
          }
        } else { alert("อัพโหลดไม่สำเร็จ กรุณาส่งสลิปทาง LINE แทน"); }
      } catch(err) { alert("เกิดข้อผิดพลาด กรุณาส่งสลิปทาง LINE"); }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (slipDone) return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>ได้รับสลิปแล้ว!</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>เจ้าหน้าที่กำลังตรวจสอบการชำระเงิน {selected.length} หัวข้อ<br/>ตรวจเสร็จระบบจะปลดล็อกบทเรียนให้อัตโนมัติ (โดยปกติภายในไม่กี่ชั่วโมง)<br/>หากเร่งด่วน ทักแจ้งได้ทาง LINE @jiacpr</p>
      <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 20, padding: "14px 40px", fontSize: 16 }}>กลับหน้าบทเรียน →</button>
    </div></div>
  );

  if (step === "payment") return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => setStep("select")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ชำระเงิน ฿{total}</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ ...css.card, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>สรุปรายการ</div>
        {selected.map(id => { const m = COURSE.modules.find(x => x.id === id); return <div key={id} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px solid ${B.gray}` }}>{m.short}</div>; })}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, paddingTop: 8, borderTop: `1px solid ${B.ltGray}` }}>
          <span style={{ fontWeight: 600 }}>รวม {selected.length} หัวข้อ</span>
          <span style={{ fontSize: 22, fontWeight: 800, color: B.red }}>฿{total}</span>
        </div>
        {isFull && <div style={{ fontSize: 12, color: B.green, marginTop: 6 }}>ครบ 6 หัวข้อ! ได้ Final Exam + Full Certificate + คูปอง ฿100 ฟรี</div>}
      </div>
      {!user && <div style={{ ...css.card, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>กรอกข้อมูลก่อนชำระเงิน</div>
        <div style={{ marginBottom: 12, textAlign: "left" }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่อ-นามสกุล *</label>
          <input type="text" placeholder="เช่น สมชาย ใจดี" value={buyerName} onChange={e => setBuyerName(e.target.value)} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
        </div>
        <div style={{ textAlign: "left" }}>
          <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทรศัพท์ *</label>
          <input type="tel" placeholder="เช่น 081-234-5678" value={buyerPhone} onChange={e => setBuyerPhone(e.target.value)} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
        </div>
      </div>}
      <div style={{ ...css.card, textAlign: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>ชำระออนไลน์ (บัตรเครดิต / PromptPay)</div>
        <button onClick={payWithStripe} disabled={stripePaying || !buyerReady} style={{ ...css.btn("#635BFF", B.white), padding: "14px 32px", fontSize: 15, width: "100%", opacity: (stripePaying || !buyerReady) ? 0.6 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/></svg>
          {stripePaying ? "กำลังเปิดหน้าชำระเงิน..." : refDiscount ? `ชำระผ่าน Stripe ฿${total - refDiscount}` : "ชำระผ่าน Stripe"}
        </button>
        {refDiscount > 0 && <div data-testid="referral-discount" style={{ fontSize: 12.5, color: B.green, fontWeight: 700, marginTop: 8 }}>🎁 ส่วนลดเพื่อนแนะนำ {REFERRAL_DISCOUNT_PCT}% (−฿{refDiscount}) เมื่อชำระผ่าน Stripe</div>}
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 8 }}>รองรับ Visa / Mastercard / PromptPay — ปลดล็อคทันที</div>
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 4 }}>ต้องการใบกำกับภาษีในนามบริษัท? ขอได้หลังชำระเงินที่หน้าบทเรียน</div>
      </div>
      <div style={{ ...css.card, textAlign: "center", marginBottom: 14, position: "relative" }}>
        <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: B.white, padding: "0 12px", fontSize: 12, color: B.dkGray }}>หรือ</div>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>โอนเงินเข้าบัญชี</div>
        <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: B.dkGray }}>ธนาคารกสิกรไทย</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, margin: "6px 0" }}>134-3-11564-0</div>
          <div style={{ fontSize: 13, color: B.dkGray }}>บริษัท โรจน์รุ่งธุรกิจ จำกัด</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText("1343115640"); alert("คัดลอกเลขบัญชีแล้ว!"); }} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>คัดลอกเลขบัญชี</button>
      </div>
      <div style={{ ...css.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>อัพโหลดสลิป</div>
        <label style={{ ...css.btn(B.red, B.white), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: (uploading || !buyerReady) ? 0.6 : 1 }}>
          <I name="save" size={18} color={B.white}/> {uploading ? "กำลังอัพโหลด..." : "เลือกรูปสลิป"}
          <input type="file" accept="image/*" capture="environment" onChange={handleSlip} disabled={uploading || !buyerReady} style={{ display: "none" }}/>
        </label>
      </div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> หรือส่งสลิปทาง LINE @jiacpr</a>
    </div></div>
  );

  return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>เลือกซื้อหัวข้อ</div></div>
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 120 }}>
      {/* Already purchased */}
      {purchased.filter(x => x <= 6).length > 0 && <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 8 }}>หัวข้อที่ซื้อแล้ว ({purchased.filter(x => x <= 6).length})</div>
        {purchased.filter(x => x <= 6).map(id => { const m = COURSE.modules.find(x => x.id === id); return (
          <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", marginBottom: 6, background: `${B.green}08`, borderRadius: 10, border: `1px solid ${B.green}30` }}>
            <I name="check" size={16} color={B.green}/><span style={{ fontSize: 13, fontWeight: 600 }}>{m.short}</span>
            {id === PRICING.freeModule && <span style={{ fontSize: 10, background: B.green, color: B.white, padding: "2px 6px", borderRadius: 4, marginLeft: "auto" }}>ฟรี</span>}
          </div>
        ); })}
      </div>}

      {/* Buyable modules */}
      {buyable.length > 0 ? (<>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>เลือกหัวข้อที่ต้องการ</div>
          <button onClick={selectAll} style={{ fontSize: 12, color: B.red, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>เลือกทั้งหมด</button>
        </div>
        {buyable.map(m => { const sel = selected.includes(m.id); return (
          <button key={m.id} onClick={() => toggle(m.id)} style={{ display: "flex", width: "100%", alignItems: "center", gap: 12, padding: "12px 14px", marginBottom: 8, background: sel ? `${B.red}06` : B.white, border: sel ? `2px solid ${B.red}` : `1px solid ${B.ltGray}`, borderRadius: 12, cursor: "pointer", textAlign: "left" }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, border: sel ? `2px solid ${B.red}` : `2px solid ${B.ltGray}`, background: sel ? B.red : B.white, display: "flex", alignItems: "center", justifyContent: "center" }}>{sel && <I name="check" size={14} color={B.white}/>}</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{m.short}</div><div style={{ fontSize: 12, color: B.dkGray }}>{m.desc}</div></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: B.red }}>฿{PRICING.single}</div>
          </button>
        ); })}

        {/* Promo code redeem — gateway to Claim component (ซ่อนระหว่าง FREE_LAUNCH เพราะทุกบทฟรีอยู่แล้ว) */}
        {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_redeemed", false) && <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ width: "100%", marginTop: 12, padding: "12px 14px", background: B.white, border: `2px dashed ${B.gold}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, textAlign: "left" }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><I name="star" size={18} color={B.gold}/></div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: B.black }}>มีโค้ดส่วนลด 100%?</div>
            <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>ปลดล็อก {PROMO_FREE_MODULES.length} บทฟรี — ใช้โค้ดที่นี่</div>
          </div>
          <I name="arrow" size={14} color={B.gold}/>
        </button>}

        {/* Price tiers */}
        <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: 14, marginTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>ยิ่งซื้อเยอะยิ่งถูก!</div>
          <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.8 }}>
            1 หัวข้อ = ฿{PRICING.single}<br/>
            3 หัวข้อ = ฿{PRICING.bundle3} <span style={{ color: B.green }}>(ประหยัด ฿{PRICING.single * 3 - PRICING.bundle3})</span><br/>
            Full 6 หัวข้อ + Final = ฿{PRICING.full} <span style={{ color: B.green }}>(ประหยัด ฿{PRICING.single * 6 - PRICING.full})</span>
          </div>
        </div>
      </>) : (
        <div style={{ textAlign: "center", padding: 20 }}>
          <I name="check" size={40} color={B.green}/>
          <div style={{ fontSize: 16, fontWeight: 700, marginTop: 10 }}>ซื้อครบทุกหัวข้อแล้ว!</div>
          <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 16 }}>เข้าเรียนเลย →</button>
        </div>
      )}
    </div>

    {/* Bottom bar */}
    {selected.length > 0 && <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: B.white, padding: "14px 20px", boxShadow: "0 -4px 24px rgba(0,0,0,.1)", zIndex: 100 }}>
      <div style={{ maxWidth: 480, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div><div style={{ fontSize: 12, color: B.dkGray }}>{selected.length} หัวข้อ</div><div style={{ fontSize: 22, fontWeight: 800, color: B.red }}>฿{total}</div></div>
        <button onClick={() => setStep("payment")} style={css.btn(B.red, B.white)}>ชำระเงิน →</button>
      </div>
    </div>}
  </div>);
}

// เข้าสู่ระบบด้วย LINE จริง (ไม่ใช่แค่แอด OA เป็นเพื่อน) — ผูกบัญชีชื่อ-เบอร์ที่มีอยู่แล้ว (ถ้ามี) เข้ากับ
// บัญชี Hub จริง ใช้ซ้ำได้ทั้งที่ LineAddPrompt (หลังสมัคร) และด่านก่อนสอบปลายภาค (Course)
function LineLoginButton({ user, setUser, label = "เข้าสู่ระบบด้วย LINE" }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (user?.auth_user_id) return null; // hooks above this line already ran — safe to bail out here
  const doLogin = async () => {
    setErr(""); setBusy(true);
    try {
      const u = user || load("user", null);
      const result = await signInWithLine({ phone: u?.phone || "", name: u?.name || "" });
      if (result) setUser && setUser(result.user);
      else setErr("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่");
    } catch (e) { setErr("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่"); }
    setBusy(false);
  };
  return (
    <div>
      <button type="button" onClick={doLogin} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#06C755", borderRadius: 12, padding: "12px 20px", color: B.white, border: "none", fontWeight: 700, fontSize: 14, cursor: "pointer", marginTop: 10, opacity: busy ? .6 : 1 }}>
        <I name="line" size={20} color={B.white}/> {busy ? "กำลังเชื่อมต่อ..." : label}
      </button>
      {err && <div style={{ color: B.red, fontSize: 12, marginTop: 6 }}>{err}</div>}
    </div>
  );
}

// ยืนยันตัวตนด้วยอีเมล — ทางเลือกสำรอง (LINE เป็นหลัก) ให้คนที่ไม่ใช้ LINE ยังมีบัญชีจริงที่รู้ได้ว่าเป็น
// ใคร ใช้เรียนต่อข้ามเครื่องได้ และมีบัตรนักเรียน/ชื่อชุดเดียวกับ Hub — ไม่บังคับ ข้ามได้เสมอ
function EmailIdentityCard({ user, setUser }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  if (user?.auth_user_id || done) return done ? (
    <div style={{ background: `${B.green}14`, border: `1px solid ${B.green}66`, borderRadius: 12, padding: "12px 14px", marginTop: 12, textAlign: "center", fontSize: 13, fontWeight: 700, color: B.black }}>
      ✓ ยืนยันตัวตนด้วยอีเมลเรียบร้อย
    </div>
  ) : null;
  const submit = async (e) => {
    e.preventDefault(); setErr(""); setBusy(true);
    try {
      if (!sent) {
        if (!/^\S+@\S+\.\S+$/.test(email)) throw Error("กรุณากรอกอีเมลให้ถูกต้อง");
        await requestEmailIdentityOtp(email.trim());
        setSent(true);
      } else {
        const result = await verifyEmailIdentityOtp({ email: email.trim(), token: code.trim() });
        setUser && setUser(result.user);
        setDone(true);
      }
    } catch (e2) { setErr(e2.message || "ดำเนินการไม่สำเร็จ กรุณาลองใหม่"); }
    setBusy(false);
  };
  return (
    <div style={{ background: B.gray, borderRadius: 12, padding: 14, marginTop: 12, textAlign: "left" }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 6 }}>ไม่ใช้ LINE? ยืนยันตัวตนด้วยอีเมลแทน (ไม่บังคับ)</div>
      <div style={{ fontSize: 11, color: B.dkGray, marginBottom: 10, lineHeight: 1.5 }}>เผื่อเปลี่ยนเครื่อง/ไม่มี LINE — บัญชีเดียวกับ class.jiacpr.com เหมือนล็อกอิน LINE</div>
      <form onSubmit={submit}>
        {!sent ? (
          <input required type="email" placeholder="อีเมลของคุณ" value={email} onChange={e => setEmail(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }}/>
        ) : (
          <input required inputMode="numeric" pattern="[0-9]{6,10}" placeholder="รหัส OTP จากอีเมล" value={code} onChange={e => setCode(e.target.value)} style={{ width: "100%", padding: "10px 12px", border: `2px solid ${B.ltGray}`, borderRadius: 8, fontSize: 13, outline: "none", boxSizing: "border-box", marginBottom: 8 }}/>
        )}
        {err && <div style={{ color: B.red, fontSize: 12, marginBottom: 8 }}>{err}</div>}
        <button type="submit" disabled={busy} style={{ ...css.btn(B.black, B.white, true), padding: "10px 16px", fontSize: 13, width: "auto" }}>{busy ? "กำลังดำเนินการ..." : sent ? "ยืนยันรหัส OTP" : "ส่งรหัส OTP"}</button>
      </form>
    </div>
  );
}

// กล่องบัญชี JIA — login แล้ว: ชื่อ + บัตรนักเรียน + "ออกจากระบบ" (logoutAccount: ออกทั้งเว็บนี้และ class.jiacpr.com)
// เพิ่งออกจากระบบ: บอกว่าข้อมูลการเรียนยังอยู่ในเครื่อง + ปุ่มเข้าสู่ระบบอีกครั้ง; ยังไม่เคย login: ไม่แสดง (มีปุ่มเข้าสู่ระบบ
// ตามจุดสมัครและก่อนสอบปลายภาคอยู่แล้ว)
function AccountCard({ user, setUser }) {
  const [busy, setBusy] = useState(false);
  if (user?.auth_user_id) {
    const name = (user.hub?.nameTh || user.name || "").trim() || "บัญชี JIA";
    return (
      <div data-testid="account-card" data-state="signed-in" style={{ display: "flex", alignItems: "center", gap: 12, background: B.white, border: `1px solid ${B.green}55`, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
        <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center" }}><I name="check" size={18} color={B.green}/></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: B.dkGray }}>เข้าสู่ระบบบัญชี JIA แล้ว</div>
          <div style={{ fontSize: 14, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          {user.hub?.cardNo && <div style={{ fontSize: 11, color: B.dkGray }}>บัตรนักเรียน {user.hub.cardNo}</div>}
        </div>
        <button type="button" disabled={busy} onClick={() => { setBusy(true); logoutAccount().catch(() => setBusy(false)); }} style={{ background: B.gray, color: B.black, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>{busy ? "กำลังออก…" : "ออกจากระบบ"}</button>
      </div>
    );
  }
  if (!load("signed_out_account", null)) return null;
  return (
    <div data-testid="account-card" data-state="signed-out" style={{ background: B.gray, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 700 }}>ออกจากระบบบัญชี JIA แล้ว</div>
      <div style={{ fontSize: 11.5, color: B.dkGray, marginTop: 4, lineHeight: 1.6 }}>ข้อมูลการเรียนยังอยู่ในเครื่องนี้ — เข้าสู่ระบบบัญชีเดิมเพื่อเรียนต่อ (ถ้ามีคนอื่นเข้าสู่ระบบบนเครื่องนี้ ข้อมูลเดิมจะถูกล้างก่อน)</div>
      <LineLoginButton user={user} setUser={setUser} label="เข้าสู่ระบบด้วย LINE อีกครั้ง"/>
    </div>
  );
}

// ==================== LINE ADD PROMPT ====================
function LineAddPrompt({ go, user, setUser, variant = "post-register" }) {
  const linkCode = getLinkCode();
  const deepLink = lineLinkDeepLink(linkCode);
  const preCourse = variant === "pre-course";
  // หลังสมัครเสร็จ: โชว์คูปอง ฿100 บนจอ — ปกติออกให้แล้วตอนสมัคร/จบคอร์ส (Register/submitQuiz) ที่นี่ดึงจาก
  // local storage เป็นหลัก แล้วเผื่อกรณียังไม่มี (เช่น ผู้เรียนเก่าที่ยังไม่เคยผ่าน flow ใหม่) ค่อยออกผ่าน RPC
  // ยกเว้นนักเรียน pre-course ที่จ่ายค่าคอร์ส on-site แล้ว — ไม่มีสิทธิ์คูปอง กันเข้าใจผิดเรื่องส่วนลด/เงินคืน
  const showCoupon = !preCourse && !isPreCourseStudent() && isSignedUp();
  const [coupon, setCoupon] = useState(() => (showCoupon ? load("coupon", null) : null));
  useEffect(() => {
    if (!showCoupon || coupon) return;
    const u = user || load("user", null);
    if (!u?.customer_id) return;
    issueOnlineCoupon(u.customer_id, u.phone).then(c => { if (c) { save("coupon", c); setCoupon(c); } });
  }, [showCoupon, coupon]);
  // gate ก่อนเรียน = ข้ามได้ (strong-soft) แต่จด line_skipped_at ไว้เพื่อไม่เด้งซ้ำ + ให้แบนเนอร์ในคอร์สตามต่อ
  useEffect(() => { safeTrack("line_gate_view", { variant }); phCapture("line_gate_view", { variant }); }, [variant]);
  const onAdded = () => { markLineAdded(user); safeTrack("line_oa_confirm_added", { variant }); phCapture("line_oa_confirm_added", { variant }); go("course"); };
  const onSkip = () => { safeTrack("line_oa_skipped", { variant }); phCapture("line_oa_skipped", { variant }); save("line_skipped_at", new Date().toISOString()); go("course"); };
  const onClickLink = () => { safeTrack("line_oa_clicked", { variant, has_link_code: true }); phCapture("line_oa_clicked", { variant, has_link_code: true }); };
  // เข้าเรียนเลย (post-register) — ไม่ขวางก่อนได้คุณค่า; จด line_skipped_at กันเด้งซ้ำ ปล่อยให้แบนเนอร์ในคอร์ส + หน้าใบประกาศตามต่อ
  const onEnterCourse = () => { safeTrack("post_register_enter_course", { variant }); phCapture("post_register_enter_course", { variant }); save("line_skipped_at", new Date().toISOString()); go("course"); };
  // เข้าสู่ระบบด้วย LINE จริง (ไม่ใช่แค่แอด OA เป็นเพื่อน — ดู LineLoginButton) แสดงที่นี่เพราะทุกทางสมัคร
  // (SignupGate/Register/Claim) ลงเอยที่หน้านี้ทั้งหมด รวมถึง gate variant "soft" (ค่า default) ที่
  // SignupGate ไม่ถูกเปิดใช้เลย — ที่นี่จึงเป็นจุดเดียวที่ทุกคนเจอปุ่มนี้แน่นอน

  // ── post-register: หลังสมัครเสร็จ ดัน "เริ่มเรียนเลย" เป็นปุ่มหลัก, LINE เป็นตัวเลือกเบา ๆ (โปรโมตการแอดหนักไปไว้หน้าใบประกาศแทน) ──
  if (variant === "post-register") {
    return (
      <div style={css.page}>
        <div style={css.header(B.red)}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>สมัครสำเร็จ 🎉</div>
        </div>
        <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
          {coupon && <div style={{ ...css.card, textAlign: "center", marginBottom: 14, border: `2px solid ${B.gold}`, background: `${B.gold}10` }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: B.black }}>🎉 สมัครสำเร็จ! รับคูปองส่วนลด ฿100</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", margin: "10px 0" }}>{coupon}</div>
            <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.6 }}>เก็บรหัสนี้ไว้ใช้เป็นส่วนลดคอร์สภาคปฏิบัติ (on-site) — แจ้งตอนจอง หรือกรอกตอนชำระเงิน</div>
          </div>}
          <div style={{ ...css.card, textAlign: "center" }}>
            <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <I name="check" size={34} color={B.green}/>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, margin: "0 0 8px" }}>พร้อมเริ่มเรียนแล้ว!</h2>
            <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7, margin: "0 0 18px" }}>{coupon ? "เริ่มบทเรียนได้เลย — เรียนจบรับใบประกาศ + คูปองส่วนลดภาคปฏิบัติ" : "เริ่มบทเรียนได้เลย — เรียนจบรับใบประกาศนียบัตร"}</p>
            <button onClick={onEnterCourse} style={{ ...css.btn(B.red, B.white, true), marginBottom: 14 }}>
              เริ่มเรียนเลย →
            </button>
            {/* LINE แบบเบา: ตัวเลือกเสริม ไม่บังคับ — กดได้ถ้าสนใจ ไม่กดก็ไปต่อได้ */}
            <a href={deepLink} onClick={() => { onClickLink(); markLineAdded(user); }} target="_blank" rel="noopener noreferrer"
               style={{ display: "flex", alignItems: "center", gap: 12, background: "#06C75510", border: "1px solid #06C75540", borderRadius: 12, padding: "12px 14px", textDecoration: "none", color: B.black, textAlign: "left" }}>
              <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: "#06C755", display: "flex", alignItems: "center", justifyContent: "center" }}><I name="line" size={22} color={B.white}/></div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>เพิ่ม LINE @jiacpr <span style={{ color: B.dkGray, fontWeight: 400 }}>(ไม่บังคับ)</span></div>
                <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>รับใบเซอร์ PDF + เตือนทบทวน + โปรพิเศษ — เพิ่มภายหลังจากในคอร์สก็ได้</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#06994A" }}>เพิ่ม →</span>
            </a>
            <LineLoginButton user={user} setUser={setUser} label="เข้าสู่ระบบด้วย LINE (ยืนยันตัวตนถาวร)"/>
            <EmailIdentityCard user={user} setUser={setUser}/>
          </div>
        </div>
      </div>
    );
  }

  const title = preCourse ? "เพิ่ม LINE ก่อนเริ่มเรียน 🎓" : "อย่าลืมเพิ่ม LINE!";
  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        {preCourse && <button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>}
        <div style={{ fontSize: 16, fontWeight: 700 }}>เพิ่ม LINE @jiacpr</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        {coupon && <div style={{ ...css.card, textAlign: "center", marginBottom: 14, border: `2px solid ${B.gold}`, background: `${B.gold}10` }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: B.black }}>🎉 สมัครสำเร็จ! รับคูปองส่วนลด ฿100</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", margin: "10px 0" }}>{coupon}</div>
          <div style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.6 }}>เก็บรหัสนี้ไว้ใช้เป็นส่วนลดคอร์สภาคปฏิบัติ (on-site) — แจ้งตอนจอง หรือกรอกตอนชำระเงิน</div>
        </div>}
        <div style={{ ...css.card, textAlign: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#06C75518", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <I name="line" size={36} color="#06C755"/>
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>{title}</h2>
          {preCourse && <p style={{ fontSize: 13, color: "#06994A", fontWeight: 600, lineHeight: 1.6, margin: "0 0 12px" }}>แอด LINE @jiacpr เพื่อปลดล็อกคอร์สเรียนฟรี + เก็บสิทธิ์ไว้เรียนต่อได้ทุกอุปกรณ์ — ใช้เวลาไม่ถึง 10 วินาที</p>}
          <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7, margin: "0 0 16px" }}>
            แอด LINE @jiacpr เพื่อ:<br/>
            <strong style={{ color: B.black }}>✓</strong> รับใบ Certificate แบบ PDF<br/>
            <strong style={{ color: B.black }}>✓</strong> แจ้งเตือนทบทวน CPR ทุก 3 เดือน<br/>
            <strong style={{ color: B.black }}>✓</strong> รับโปรต่ออายุ + คูปองพิเศษ<br/>
            <strong style={{ color: B.black }}>✓</strong> สอบถามได้ตลอด
          </p>
          <div style={{ background: B.white, border: `2px solid ${B.ltGray}`, borderRadius: 14, padding: 12, display: "inline-block", marginBottom: 14 }}>
            <img src={LINE_QR_URL} alt="LINE QR @jiacpr" width="180" height="180" style={{ display: "block" }} onError={(e) => { e.target.style.display = "none"; }}/>
            <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, color: "#06C755" }}>@jiacpr</div>
          </div>
          <a href={deepLink} onClick={onClickLink} target="_blank" rel="noopener noreferrer"
             style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
            <I name="line" size={22} color={B.white}/> เพิ่มเพื่อน + ผูกบัญชีอัตโนมัติ
          </a>
          <div style={{ fontSize: 11, color: B.dkGray, marginBottom: 12, lineHeight: 1.5 }}>
            (กดปุ่ม → LINE จะเด้งข้อความพร้อมโค้ด <strong style={{ fontFamily: "monospace", color: B.red }}>JIA-LINK-{linkCode}</strong> + ข้อความนัดเรียนภาคปฏิบัติ → กดส่ง = admin รับเรื่อง + ผูกบัญชีให้อัตโนมัติ)
          </div>
          <button onClick={onAdded} style={{ ...css.btn(B.red, B.white, true), marginBottom: 8 }}>
            <I name="check" size={16} color={B.white}/> เพิ่มเพื่อนแล้ว → เข้าเรียนเลย
          </button>
          <button onClick={onSkip} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: "8px 12px", cursor: "pointer", textDecoration: "underline" }}>
            ข้ามไปก่อน (เพิ่มได้ทีหลัง)
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== TEASER QUIZ (ควิซเกริ่นนำหน้าแรก) ====================
// 5 ข้อ ทีละข้อ + รูป + feedback ทันที (ตอบผิดไปต่อได้) → จอสรุป → ปุ่มสมัคร (เก็บ LINE)
function TeaserQuizImg({ item }) {
  const [broken, setBroken] = useState(false);
  if (broken || !item.img) return (
    <div style={{ width: "100%", aspectRatio: "16/10", borderRadius: 14, background: `linear-gradient(135deg, ${B.red}10, ${B.gold}12)`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 16, border: `1px solid ${B.ltGray}` }}>
      <div style={{ fontSize: 56, lineHeight: 1 }}>{item.emoji || "❤️"}</div>
    </div>
  );
  return <img src={item.img} alt="" onError={() => setBroken(true)} style={{ width: "100%", aspectRatio: "16/10", objectFit: "cover", borderRadius: 14, marginBottom: 16, display: "block", background: B.gray }}/>;
}

function TeaserQuiz({ go }) {
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState(null);   // index ที่เลือกในข้อปัจจุบัน (null = ยังไม่เลือก)
  const [correct, setCorrect] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => { safeTrack("teaser_quiz_view", {}); phCapture("teaser_quiz_view", {}); }, []);
  const total = TEASER_QUIZ.length;
  const item = TEASER_QUIZ[idx];

  const choose = (ci) => { if (picked !== null) return; setPicked(ci); if (ci === item.a) setCorrect(c => c + 1); };
  const next = () => {
    if (idx + 1 < total) { setIdx(idx + 1); setPicked(null); }
    else { const score = correct; setFinished(true); safeTrack("teaser_quiz_complete", { score, total }); phCapture("teaser_quiz_complete", { score, total }); }
  };
  const startSignup = () => { save("teaser_done", true); go("signupgate"); };

  if (finished) {
    return (
      <div style={css.page}>
        <div style={{ ...css.wrap, paddingTop: 40, paddingBottom: 40 }}>
          <div style={{ ...css.card, textAlign: "center" }}>
            <div style={{ fontSize: 56, marginBottom: 8 }}>🎉</div>
            <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>เก่งมาก! ทำได้ {correct}/{total} ข้อ</h2>
            <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.7, margin: "0 0 20px" }}>นี่เป็นแค่น้ำจิ้ม 😉 คอร์สเต็มมีวิดีโอสอนละเอียด + ฝึกจริง + ใบประกาศนียบัตร<br/><strong style={{ color: B.black }}>สมัครฟรีเพื่อปลดคอร์สทั้งหมด + รับคูปองส่วนลด ฿100</strong></p>
            <button onClick={startSignup} style={{ ...css.btn(B.red, B.white, true), marginBottom: 10 }}>สมัครฟรี & เริ่มเรียน →</button>
            <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ ...css.btn(B.white, B.red, true), border: `1px solid ${B.red}`, marginBottom: 10 }}>🎟️ มีโค้ดแล้ว? ใส่โค้ดเลย →</button>
            <button onClick={() => { save("teaser_done", true); go("landing"); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 13, padding: "6px 12px", cursor: "pointer", textDecoration: "underline" }}>ดูรายละเอียดคอร์สก่อน</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>JIA TRAINER CENTER</div>
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: .9 }}>ทดสอบความรู้ CPR</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        {/* progress dots */}
        <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 16 }}>
          {TEASER_QUIZ.map((_, i) => <div key={i} style={{ width: i === idx ? 22 : 8, height: 8, borderRadius: 4, background: i < idx ? B.green : i === idx ? B.red : B.ltGray, transition: "all .3s" }}/>)}
        </div>
        <div style={css.card}>
          <TeaserQuizImg item={item}/>
          <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 4 }}>ข้อ {idx + 1} จาก {total}</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, margin: "0 0 16px", lineHeight: 1.5 }}>{item.q}</h3>
          {item.c.map((c, ci) => {
            let bg = B.gray, border = "transparent", color = B.black;
            if (picked !== null) {
              if (ci === item.a) { bg = `${B.green}18`; border = B.green; }
              else if (ci === picked) { bg = `${B.red}12`; border = B.red; }
            }
            return (
              <button key={ci} onClick={() => choose(ci)} disabled={picked !== null} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "13px 16px", marginBottom: 8, background: bg, border: `2px solid ${border}`, borderRadius: 10, fontSize: 14, color, cursor: picked === null ? "pointer" : "default" }}>
                <span style={{ flex: 1 }}>{c}</span>
                {picked !== null && ci === item.a && <I name="check" size={18} color={B.green}/>}
              </button>
            );
          })}
          {picked !== null && (
            <div style={{ background: `${B.gold}10`, borderRadius: 10, padding: "10px 14px", margin: "6px 0 12px", fontSize: 13, color: "#92600A", textAlign: "center" }}>
              {picked === item.a ? "✅ ถูกต้อง! " : "💡 "}{item.hint}
            </div>
          )}
          {picked !== null && <button onClick={next} style={css.btn(B.red, B.white, true)}>{idx + 1 < total ? "ข้อต่อไป →" : "ดูผลลัพธ์ →"}</button>}
        </div>
        <div style={{ textAlign: "center", marginTop: 14, display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ background: "none", border: `1px solid ${B.red}`, borderRadius: 10, color: B.red, fontSize: 13, fontWeight: 700, padding: "9px 12px", cursor: "pointer" }}>🎟️ มีโค้ดแล้ว? ใส่โค้ดเข้าเรียนเลย →</button>
          <button onClick={() => { save("teaser_done", true); go("signupgate"); }} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12, padding: 6, cursor: "pointer", textDecoration: "underline" }}>ข้ามไปสมัครเลย</button>
        </div>
      </div>
    </div>
  );
}

// ==================== SIGNUP GATE (บังคับสมัคร) ====================
// จอเดียว: เลือก LINE / Google / Email (OTP) + กรอกเบอร์ + ยินยอม PDPA → ปลดเนื้อหา
function SignupGate({ go, setUser }) {
  const [name, setName] = useState(() => load("user", {})?.name || "");
  const [phone, setPhone] = useState(() => load("user", {})?.phone || "");
  const [pdpa, setPdpa] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [fallback, setFallback] = useState(false); // "ไม่มี LINE?" — เผยฟอร์มชื่อ+เบอร์สำรอง (ไม่ล็อกอิน LINE)
  useEffect(() => { safeTrack("signup_gate_view", { variant: getGateVariant() }); phCapture("gate_shown", { variant: getGateVariant() }); }, []);

  const validate = () => {
    if (phone.replace(/\D/g, "").length < 9) { setErr("กรุณากรอกเบอร์โทรที่ถูกต้อง"); return false; }
    if (!pdpa) { setErr("กรุณายินยอม PDPA ก่อนสมัคร"); return false; }
    return true;
  };

  // เข้าสู่ระบบด้วย LINE — ทางหลัก บัญชีเดียวกับ class.jiacpr.com
  const submitLine = async () => {
    if (fallback && !name.trim()) { setErr("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (!validate()) return;
    setErr(""); setBusy(true);
    try {
      const result = await signInWithLine({ phone: phone.replace(/\D/g, ""), name: name.trim() });
      if (result) { setUser(result.user); go("lineprompt"); }
      // ไม่มี result: กำลังนำทางไปหน้า LINE login (ปกติ) หรือเชื่อมต่อไม่สำเร็จแบบเงียบ
      else setErr("เข้าสู่ระบบด้วย LINE ไม่สำเร็จ กรุณาลองใหม่ หรือใช้ชื่อ-เบอร์แทน");
    } catch (e) { setErr("เชื่อมต่อ LINE ไม่สำเร็จ กรุณาลองใหม่"); }
    setBusy(false);
  };

  // ไม่มี LINE — ทางสำรอง: กรอกชื่อ+เบอร์ ปลดคอร์สแบบไม่ผูกบัญชี (เชื่อม LINE ทีหลังได้จากหน้าคอร์ส)
  const submitFallback = () => {
    if (!name.trim()) { setErr("กรุณากรอกชื่อ-นามสกุล"); return; }
    if (!validate()) return;
    setErr(""); setBusy(true);
    const cleanPhone = phone.replace(/\D/g, "");
    // เก็บ customer_id ไว้ใน user ด้วย — ชวนเพื่อน/รีวิว/ผูก LINE ผ่าน RPC ยืนยันตัวด้วย customer_id + เบอร์
    const custId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    const userData = { name: name.trim(), phone: cleanPhone, customer_id: custId };
    setUser(userData);
    save("signed_up", true); save("enrolled", true);
    const linkCode = getLinkCode();
    supaRest("customers", "POST", { id: custId, name: userData.name, tel: cleanPhone, source: "online-course", line_link_code: linkCode, pdpa_consent_at: new Date().toISOString(), signup_at: new Date().toISOString(), gate_variant: getGateVariant(), landing_url: load("landing_url", null), ...getUTM() });
    supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, status: "กำลังเรียน" });
    safeTrack("signup_complete", { provider: "line_oa_only" });
    phCapture("signup_complete", { provider: "line_oa_only", variant: getGateVariant() });
    go("lineprompt");
  };

  return (
    <div style={css.page}>
      <div style={css.header(B.red)}>
        <button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button>
        <div style={{ fontSize: 16, fontWeight: 700 }}>สมัครฟรี</div>
      </div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <div style={{ ...css.card, textAlign: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "#06C75518", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}><I name="line" size={36} color="#06C755"/></div>
          <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 6px" }}>อีกขั้นเดียว! 🎉</h2>
          <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7, margin: "0 0 18px" }}>เข้าสู่ระบบด้วย LINE เพื่อ <strong style={{ color: B.black }}>ปลดคอร์สเต็ม + รับคูปองส่วนลด ฿100</strong> บัญชีเดียวกับที่ใช้จองคอร์ส on-site ได้เลย</p>
          {fallback && <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่อ-นามสกุล *</label>
            <input type="text" placeholder="เช่น สมชาย ใจดี" value={name} onChange={e => { setName(e.target.value); setErr(""); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
          </div>}
          <div style={{ marginBottom: 12, textAlign: "left" }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทรศัพท์ *</label>
            <input type="tel" placeholder="เช่น 081-234-5678" value={phone} onChange={e => { setPhone(e.target.value); setErr(""); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
          </div>
          <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer", marginBottom: 16, textAlign: "left" }}>
            <input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr(""); }} style={{ marginTop: 3, width: 18, height: 18 }}/>
            <span style={{ fontSize: 11, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บและใช้ข้อมูลส่วนบุคคล (ชื่อ, เบอร์โทร) เพื่อจัดการหลักสูตร ออกใบประกาศนียบัตร และแจ้งข้อมูลหลักสูตร</span>
          </label>
          {err && <div style={{ color: B.red, fontSize: 12, marginBottom: 12 }}>{err}</div>}
          {!fallback ? <>
            <button onClick={submitLine} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
              <I name="line" size={22} color={B.white}/> {busy ? "กำลังเชื่อมต่อ..." : "เข้าสู่ระบบด้วย LINE →"}
            </button>
            <button onClick={() => { setFallback(true); setErr(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: B.dkGray, fontSize: 13, padding: "8px 4px", cursor: "pointer", textDecoration: "underline" }}>ไม่มี LINE? กรอกชื่อ-เบอร์แทน</button>
          </> : <>
            <button onClick={submitFallback} disabled={busy} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, width: "100%", background: B.red, borderRadius: 12, padding: "14px 24px", color: B.white, border: "none", fontWeight: 700, fontSize: 15, cursor: "pointer", opacity: busy ? .6 : 1 }}>
              {busy ? "กำลังสมัคร..." : "สมัครด้วยชื่อ-เบอร์ →"}
            </button>
            <button onClick={() => { setFallback(false); setErr(""); }} style={{ width: "100%", marginTop: 10, background: "none", border: "none", color: B.dkGray, fontSize: 13, padding: "8px 4px", cursor: "pointer", textDecoration: "underline" }}>← กลับไปเข้าสู่ระบบด้วย LINE</button>
          </>}
          <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ width: "100%", marginTop: 10, background: "none", border: `1px solid ${B.red}`, borderRadius: 12, color: B.red, fontWeight: 700, fontSize: 14, padding: "11px 16px", cursor: "pointer" }}>🎟️ มีโค้ดแล้ว? ใส่โค้ดเข้าเรียนเลย →</button>
        </div>
      </div>
    </div>
  );
}

// ==================== REGISTER (+ PDPA) ====================
function Register({ go, setUser }) {
  const [f, setF] = useState({ name: "", phone: "", email: "" }); const [err, setErr] = useState({}); const [pdpa, setPdpa] = useState(false);
  const submit = async () => {
    const e = {}; if (!f.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล"; if (!f.phone.trim() || f.phone.replace(/\D/g, "").length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง"; if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนลงทะเบียน"; if (Object.keys(e).length) return setErr(e);
    const cleanPhone = f.phone.replace(/\D/g, "");
    // เผื่อยืนยันตัวตนไว้แล้วก่อนถึงหน้านี้ (เช่น ด่านก่อนสอบปลายภาคด้วยอีเมล — ดู Course/verifyEmailIdentityOtp)
    // ต้องไม่ทิ้ง auth_user_id/hub ที่มีอยู่แล้วไปเฉยๆ ไม่งั้นการยืนยันตัวตนที่ทำไว้จะสูญเปล่า
    const prior = load("user", null);
    const custId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
    // เก็บ customer_id ไว้ใน user ด้วย (ของเดิมไม่เก็บ) — จุดอื่นที่อ่าน load("user") ต่อ (จบคอร์สทีหลัง,
    // หน้าใบประกาศ) ต้องใช้ค่านี้เรียก issue_online_coupon
    const userData = { name: f.name.trim(), phone: cleanPhone, email: f.email, customer_id: custId, auth_user_id: prior?.auth_user_id, hub: prior?.hub };
    setUser(userData); save("user", userData);
    const linkCode = genLinkCode(); save("line_link_code", linkCode);
    const finalProgress = load("progress", { done: [], scores: {} });
    const finalModId = COURSE.modules[COURSE.modules.length - 1].id;
    const completed = finalProgress.done.includes(finalModId);
    const finalScore = finalProgress.scores[finalModId] || null;
    await supaRest("customers", "POST", { id: custId, name: userData.name, tel: cleanPhone, email: f.email || "", source: "online-course", line_link_code: linkCode });
    // ผูกลูกค้าที่สร้างใหม่นี้เข้ากับบัญชี Hub ที่ยืนยันตัวตนไว้แล้ว (ถ้ามี) ไม่งั้นจะได้ลูกค้าที่ไม่มีเจ้าของ
    // ทั้งที่ผู้เรียนคนนี้ล็อกอินจริงไปแล้วก่อนหน้านี้ — best-effort, พังไม่กระทบการลงทะเบียนหลัก
    if (prior?.auth_user_id) {
      try {
        const supa = await getSupabase();
        await supa.rpc("jia_online_account", { action: "attachLocal", payload: { customerId: custId, phone: cleanPhone } });
        await syncHubIdentity(supa, { nameTh: userData.name, phone: cleanPhone });
      } catch (e2) {}
    }
    let coupon = load("coupon", null);
    if (completed) {
      const renew = new Date(); renew.setMonth(renew.getMonth() + 6);
      // ต้องบันทึก completed_at ก่อน แล้วค่อยออกคูปอง — issue_online_coupon เช็กว่าเรียนจบแล้วจริงจากแถวนี้
      await supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, email: f.email || "", status: "จบคอร์ส ✅", completed_at: new Date().toISOString(), final_score: finalScore, renew_date: renew.toISOString().split("T")[0], pre_course: isPreCourseStudent() });
      if (!coupon && !isPreCourseStudent()) { coupon = await issueOnlineCoupon(custId, cleanPhone); if (coupon) save("coupon", coupon); }
      if (!isPreCourseStudent()) supaRest("sales_tracking", "POST", { name: userData.name, phone: cleanPhone, completed_date: new Date().toISOString(), score: finalScore, coupon_code: coupon, follow_status: "ยังไม่ติดต่อ" });
    } else {
      supaRest("online_students", "POST", { customer_id: custId, name: userData.name, phone: cleanPhone, email: f.email || "", status: "กำลังเรียน", pre_course: isPreCourseStudent() });
    }
    save("enrolled", true);
    safeTrack("register_complete", { has_email: !!f.email, completed });
    go("certificate");
  };
  const field = (key, label, ph, type = "text") => (<div style={{ marginBottom: 16 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}</label><input type={type} placeholder={ph} value={f[key]} onChange={e => { setF({...f, [key]: e.target.value}); setErr({...err, [key]: undefined}); }} style={{ width: "100%", padding: "12px 16px", border: `2px solid ${err[key] ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>{err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}</div>);
  return (<div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ลงทะเบียนรับใบเกียรติบัตร</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={css.card}><h3 style={{ fontSize: 17, fontWeight: 700, marginTop: 0, marginBottom: 6 }}>ยินดีด้วย! คุณผ่านข้อสอบแล้ว</h3><p style={{ fontSize: 13, color: B.dkGray, margin: "0 0 18px", lineHeight: 1.6 }}>กรอกข้อมูลด้านล่างเพื่อออกใบประกาศนียบัตรในชื่อของคุณ</p>{field("name", "ชื่อ-นามสกุล *", "เช่น สมชาย ใจดี")}{field("phone", "เบอร์โทรศัพท์ *", "เช่น 081-234-5678", "tel")}{field("email", "อีเมล (ไม่บังคับ)", "เช่น name@email.com", "email")}
        <div style={{ marginTop: 8 }}><label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}><input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr({...err, pdpa: undefined}); }} style={{ marginTop: 3, width: 18, height: 18 }}/><span style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บรวบรวมและใช้ข้อมูลส่วนบุคคล (ชื่อ, เบอร์โทร, อีเมล) เพื่อจัดการหลักสูตรออนไลน์ การออกใบประกาศนียบัตร และการแจ้งข้อมูลหลักสูตร ข้อมูลจะไม่ถูกเปิดเผยต่อบุคคลภายนอก</span></label>{err.pdpa && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.pdpa}</div>}</div>
      </div>
      <button onClick={submit} style={{ ...css.btn(B.red, B.white, true), marginTop: 20 }}>ลงทะเบียนรับใบประกาศนียบัตร →</button>
    </div></div>);
}

// ==================== CLAIM (Lead Capture + Promo Code) ====================
function Claim({ go, setUser, initialStep = "form", initialCode = "" }) {
  const [step, setStep] = useState(initialStep);
  const u0 = load("user", null);
  const [form, setForm] = useState({
    name: u0?.name || "",
    phone: u0?.phone || "",
    email: u0?.email || "",
    source: "",
    sourceOther: "",
    lineId: "",
  });
  const [err, setErr] = useState({});
  const [pdpa, setPdpa] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [claimed, setClaimed] = useState(() => {
    const code = load("promo_code", null);
    const exp = load("promo_expires", null);
    return code && exp ? { code, expires_at: exp, modules: load("promo_unlocked", []).length ? load("promo_unlocked", []) : PROMO_FREE_MODULES, name: u0?.name || "" } : null;
  });
  const [redeemCode, setRedeemCode] = useState(initialCode || load("partner_coupon_pending", ""));
  const [redeemErr, setRedeemErr] = useState("");
  const [copied, setCopied] = useState(false);
  // ต้องรู้ว่าใครใช้โค้ด (ชื่อ+เบอร์) ก่อน redeem เสมอ — ผูก online_students ให้ค้นหา/ดูคะแนนย้อนหลังได้
  // (ถ้าเคยกรอกไว้แล้ว เช่นจากฟอร์มขอโค้ดฟรี หรือเคยสมัครมาก่อน ใช้ค่าเดิมได้เลยไม่ต้องกรอกซ้ำ)
  const [redeemName, setRedeemName] = useState(u0?.name || "");
  const [redeemPhone, setRedeemPhone] = useState(u0?.phone || "");
  // ===== คูปองพาร์ทเนอร์ (QR ธุรกิจพันธมิตร) — เช็คก่อนว่าโค้ดนี้เป็นคูปองพาร์ทเนอร์ไหม เพื่อโชว์แบนเนอร์ "เรียนฟรีจาก..." =====
  const [partner, setPartner] = useState(null); // null | { status: valid|redeemed|expired, company, sponsor_line, sponsor_phone, sponsor_value, expires_at }
  useEffect(() => {
    const code = (initialCode || "").trim().toUpperCase();
    if (!code) return;
    // สแกนซ้ำจากเครื่องที่เคย redeem โค้ดนี้ไปแล้ว — เข้าเรียนต่อได้เลย ไม่ต้องกรอกซ้ำ
    if (load("promo_redeemed", false) && load("promo_code", null) === code) { go("course"); return; }
    (async () => {
      const r = await supaRpc("get_partner_coupon", { p_code: code });
      const row = Array.isArray(r) && r.length ? r[0] : null;
      if (!row) return; // ไม่ใช่คูปองพาร์ทเนอร์ (โค้ด LEAD-/VCH-/โค้ดกลางทั่วไป) — flow เดิมทำงานตามปกติ
      setPartner(row);
      if (row.status === "valid") { save("claim_start_redeem", true); save("partner_coupon_pending", code); }
      safeTrack("partner_coupon_open", { company: row.company, status: row.status }); phCapture("partner_coupon_open", { company: row.company, status: row.status });
      supaRest("lead_capture_events", "POST", { code, event_type: "partner_coupon_open", metadata: { status: row.status } });
    })();
  }, []);

  const F = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErr(e => ({ ...e, [k]: undefined })); };

  const checkDuplicate = async () => {
    const email = normalizeEmail(form.email);
    const phone = normalizePhone(form.phone);
    if (!email && !phone) return null;
    // อ่านผ่าน RPC (ปิด anon SELECT ตรงบนตารางแล้ว) — คืนเฉพาะแถวที่ email/phone ตรงเป๊ะ
    const res = await supaRpc("find_lead_promo_by_contact", { p_email: email || "", p_phone: phone || "" });
    if (!Array.isArray(res) || !res.length) return null;
    const r = res[0];
    return { ...r, expired: new Date(r.expires_at) < new Date() };
  };

  const submitForm = async () => {
    const e = {};
    if (!form.name.trim()) e.name = "กรุณากรอกชื่อ-นามสกุล";
    const phone = normalizePhone(form.phone);
    if (phone.length < 9) e.phone = "กรุณากรอกเบอร์โทรที่ถูกต้อง";
    const email = normalizeEmail(form.email);
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "กรุณากรอกอีเมลที่ถูกต้อง (สำหรับส่งโค้ดสำรอง)";
    if (!form.source) e.source = "กรุณาเลือกช่องทางที่รู้จัก JIA";
    if (form.source === "other" && !form.sourceOther.trim()) e.sourceOther = "กรุณาระบุช่องทาง";
    if (!pdpa) e.pdpa = "กรุณายินยอม PDPA ก่อนรับโค้ด";
    if (Object.keys(e).length) { setErr(e); return; }

    setSubmitting(true);
    setStep("checking");
    try {
      const dup = await checkDuplicate();
      if (dup && !dup.expired && !dup.redeemed_at) {
        const data = { code: dup.code, expires_at: dup.expires_at, name: form.name.trim(), modules: dup.unlock_modules || PROMO_FREE_MODULES };
        setClaimed(data);
        save("promo_code", dup.code);
        save("promo_expires", dup.expires_at);
        save("promo_email", email);
        supaRest("lead_capture_events", "POST", { code: dup.code, event_type: "duplicate_attempt", metadata: { source: form.source } });
        setStep("already");
        setSubmitting(false);
        return;
      }

      const code = genLeadCode();
      const now = new Date();
      const expires = new Date(now.getTime() + PROMO_EXPIRY_DAYS * 86400000);
      const custId = "cust_lead_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);

      supaRest("customers", "POST", {
        id: custId, name: form.name.trim(), tel: phone, email, source: "lead-promo-" + form.source,
      });

      // สร้างโค้ดผ่าน RPC — server บังคับ unlock_modules = {1,2,3} เอง (client ตั้งเองไม่ได้แล้ว)
      const created = await supaRpc("claim_lead_code", {
        p_code: code,
        p_email: email,
        p_phone: phone,
        p_name: form.name.trim(),
        p_line_id: form.lineId.trim() || null,
        p_source: form.source,
        p_source_other: form.source === "other" ? form.sourceOther.trim() : null,
        p_expires_at: expires.toISOString(),
        p_idempotency_key: genIdempotencyKey(email, phone),
        p_customer_id: custId,
      });

      if (!Array.isArray(created) || !created.length) {
        // race condition — re-fetch
        const dup2 = await checkDuplicate();
        if (dup2 && !dup2.expired && !dup2.redeemed_at) {
          setClaimed({ code: dup2.code, expires_at: dup2.expires_at, name: form.name.trim(), modules: dup2.unlock_modules || PROMO_FREE_MODULES });
          save("promo_code", dup2.code);
          save("promo_expires", dup2.expires_at);
          save("promo_email", email);
          setStep("already");
          setSubmitting(false);
          return;
        }
        throw new Error("สร้างโค้ดไม่สำเร็จ");
      }

      const row = created[0];
      const data = { code: row.code, expires_at: row.expires_at, name: form.name.trim(), modules: row.unlock_modules || PROMO_FREE_MODULES };
      setClaimed(data);
      save("promo_code", row.code);
      save("promo_expires", row.expires_at);
      save("promo_email", email);

      supaRest("lead_capture_events", "POST", {
        code: row.code, event_type: "claimed",
        metadata: { source: form.source, source_other: form.source === "other" ? form.sourceOther.trim() : null, has_line_id: !!form.lineId.trim(), ua: (navigator.userAgent || "").slice(0, 200) },
      });

      const userData = { name: form.name.trim(), phone, email };
      setUser(userData); save("user", userData);

      setStep("reveal");
    } catch (ex) {
      console.error(ex);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
      setStep("form");
    }
    setSubmitting(false);
  };

  const redeem = async () => {
    setRedeemErr("");
    const code = (redeemCode || "").trim().toUpperCase();
    // นอกจาก LEAD-/VCH- รายคนแล้ว ยังมีโค้ดกลาง (multi_use) ที่แอดมินตั้งชื่อเองได้ เช่น JIA-STUDENT
    if (!/^[A-Z0-9][A-Z0-9-]{3,19}$/.test(code)) { setRedeemErr("รหัสไม่ถูกต้อง (เช่น LEAD-XXXXXX, VCH-XXXXXX หรือโค้ดจากเจ้าหน้าที่)"); return; }
    const name = redeemName.trim();
    const phone = normalizePhone(redeemPhone);
    if (!name) { setRedeemErr("กรุณากรอกชื่อ-นามสกุลก่อนใช้โค้ด"); return; }
    if (phone.length < 9) { setRedeemErr("กรุณากรอกเบอร์โทรที่ถูกต้องก่อนใช้โค้ด"); return; }
    setValidating(true);
    try {
      // redeem ผ่าน RPC เดียว: server เช็ค expiry + atomic redeem + จัดการโค้ดกลาง (multi_use) ให้
      // (ปิด anon SELECT/UPDATE ตรงบนตารางแล้ว — กัน dump PII และ redeem โค้ดหมดอายุ/ทับกัน)
      const rpc = await supaRpc("redeem_lead_code", { p_code: code, p_name: name, p_phone: phone });
      if (!Array.isArray(rpc) || !rpc.length) { setRedeemErr("เกิดข้อผิดพลาด: กรุณาลองใหม่"); setValidating(false); return; }
      const row = rpc[0];
      if (row.status === "not_found") { setRedeemErr("ไม่พบรหัสนี้ในระบบ"); setValidating(false); return; }
      if (row.status === "expired") {
        setRedeemErr(`รหัสนี้หมดอายุแล้ว (หมดอายุ ${new Date(row.expires_at).toLocaleDateString("th-TH")})`);
        supaRest("lead_capture_events", "POST", { code, event_type: "expired_attempt" });
        setValidating(false); return;
      }
      if (row.status === "already") {
        setRedeemErr(`รหัสนี้ถูกใช้ไปแล้วเมื่อ ${new Date(row.redeemed_at).toLocaleDateString("th-TH")}`);
        setValidating(false); return;
      }
      if (row.status === "race") {
        setRedeemErr("รหัสถูกใช้พร้อมกันจากเครื่องอื่น กรุณาขอรหัสใหม่");
        setValidating(false); return;
      }
      // status === "ok"
      const unlock = row.unlock_modules && row.unlock_modules.length ? row.unlock_modules : PROMO_FREE_MODULES;
      // "เต็มคอร์ส" จริง (voucher) เท่านั้นถึง grandfather ให้ enrolled=true — โค้ด lead-capture 3 บทฟรี
      // ต้องยังถูกจำกัดแค่ unlock_modules ของมันเอง ไม่ใช่ได้ทุกบทไปฟรีๆ
      const isFullUnlock = [2, 3, 4, 5, 6].every(id => unlock.includes(id));
      save("promo_unlocked", unlock);
      save("promo_code", code);
      save("promo_redeemed", true);
      if (isFullUnlock) save("enrolled", true);
      // โค้ด pre_course = คนจ่ายค่าคอร์ส on-site แล้ว → จำไว้เพื่อไม่ออกคูปอง ฿100 ซ้ำ
      // (fallback ระหว่างที่ RPC เวอร์ชันเก่ายังไม่คืน source: โค้ดกลาง multi_use คือ pre-course เสมอ)
      const preCourseStudent = row.source != null ? row.source === "pre_course" : !!row.multi_use;
      save("pre_course_student", preCourseStudent);
      // คูปองพาร์ทเนอร์ (QR ธุรกิจพันธมิตร) — จำช่องทางติดต่อพาร์ทเนอร์ไว้โชว์หลัง redeem/ในหน้าคอร์ส/ใบประกาศ
      // (ยังได้คูปองส่วนลด ฿100 on-site ของ JIA ตามปกติ เพราะ preCourseStudent = false เสมอสำหรับ source นี้)
      if (row.source === PARTNER_SOURCE) {
        save("partner_sponsor", { company: row.company, line: row.sponsor_line, phone: row.sponsor_phone, value: row.sponsor_value || partner?.sponsor_value || PRICING.full, code });
        save("partner_coupon_pending", null);
        safeTrack("partner_coupon_redeemed", { company: row.company }); phCapture("partner_coupon_redeemed", { company: row.company });
      }

      // ผูกกับ online_students เสมอ (ไม่ว่าจะเคยสมัครมาก่อนหรือไม่) เพื่อให้พนักงานค้นหาคะแนนย้อนหลังได้
      const u = load("user", null);
      if (!u) {
        const custId = "cust_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
        setUser({ name, phone, customer_id: custId });
        save("signed_up", true);
        supaRest("customers", "POST", { id: custId, name, tel: phone, source: "online-course", line_link_code: getLinkCode(), pdpa_consent_at: new Date().toISOString(), signup_at: new Date().toISOString(), gate_variant: getGateVariant(), landing_url: load("landing_url", null), ...getUTM() });
        supaRest("online_students", "POST", { customer_id: custId, name, phone, status: "กำลังเรียน", company: row.company || null, pre_course: preCourseStudent });
      } else if (row.company || preCourseStudent) {
        supaRest("online_students", "PATCH", { ...(row.company ? { company: row.company } : {}), ...(preCourseStudent ? { pre_course: true } : {}) }, `?phone=ilike.*${phone.slice(-9)}&name=eq.${encodeURIComponent(name)}`);
      }

      // โค้ดกลางไม่ mark redeemed_at บนแถวโค้ด — เก็บชื่อ+เบอร์ของผู้ใช้แต่ละคนไว้ใน event แทน
      supaRest("lead_capture_events", "POST", { code, event_type: "redeemed", metadata: { modules: unlock, company: row.company || null, ...(row.multi_use ? { multi_use: true, name, phone } : {}) } });

      setClaimed({ code, modules: unlock, expires_at: row.expires_at, name });
      setStep("redeemed");
    } catch (ex) {
      console.error(ex);
      setRedeemErr("เกิดข้อผิดพลาด: กรุณาลองใหม่");
    }
    setValidating(false);
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const modulesText = (ids) => ids.map(id => COURSE.modules.find(m => m.id === id)?.short).filter(Boolean).join(" • ");

  const inp = (key, label, ph, type = "text", required = true) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>{label}{required ? " *" : ""}</label>
      <input type={type} placeholder={ph} value={form[key]} onChange={e => F(key, e.target.value)}
        style={{ width: "100%", padding: "12px 14px", border: `2px solid ${err[key] ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
      {err[key] && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err[key]}</div>}
    </div>
  );

  // ===== Step: form =====
  if (step === "form") return (
    <div style={css.page}>
      <div style={css.header(B.red)}><button onClick={() => go("landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>รับโค้ดเรียนฟรี</div></div>
      <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
        <div style={{ background: `linear-gradient(135deg, ${B.gold} 0%, #E08800 100%)`, color: B.white, borderRadius: 16, padding: 18, marginBottom: 16, textAlign: "center" }}>
          <div style={{ fontSize: 12, fontWeight: 700, opacity: .9, letterSpacing: 1, textTransform: "uppercase" }}>ส่วนลด 100%</div>
          <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>เรียนฟรี 3 บทหลัก</div>
          <div style={{ fontSize: 13, marginTop: 6, opacity: .95 }}>{modulesText(PROMO_FREE_MODULES)}</div>
          <div style={{ fontSize: 11, marginTop: 8, opacity: .85 }}>มูลค่า ฿{PRICING.bundle3} — รับฟรีเมื่อกรอกข้อมูล</div>
        </div>

        <div style={css.card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>กรอกข้อมูลเพื่อรับโค้ด</h3>
          <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 18 }}>โค้ดจะแสดงทันที + ส่งสำเนาทางอีเมล</p>

          {inp("name", "ชื่อ-นามสกุล", "เช่น สมชาย ใจดี")}
          {inp("phone", "เบอร์โทรศัพท์", "เช่น 081-234-5678", "tel")}
          {inp("email", "อีเมล", "เช่น name@email.com", "email")}

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>รู้จัก JIA จากช่องทางไหน? *</label>
            <select value={form.source} onChange={e => F("source", e.target.value)}
              style={{ width: "100%", padding: "12px 14px", border: `2px solid ${err.source ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box", background: B.white }}>
              <option value="">— เลือก —</option>
              {LEAD_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {err.source && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.source}</div>}
          </div>

          {form.source === "other" && inp("sourceOther", "โปรดระบุช่องทาง", "เช่น Twitter, Pantip")}

          {inp("lineId", "LINE ID (ไม่บังคับ)", "เช่น jiacpr", "text", false)}

          <div style={{ marginTop: 12 }}>
            <label style={{ display: "flex", gap: 10, alignItems: "flex-start", cursor: "pointer" }}>
              <input type="checkbox" checked={pdpa} onChange={e => { setPdpa(e.target.checked); setErr({ ...err, pdpa: undefined }); }} style={{ marginTop: 3, width: 18, height: 18 }}/>
              <span style={{ fontSize: 12, color: B.dkGray, lineHeight: 1.5 }}>ข้าพเจ้ายินยอมให้ JIA TRAINER CENTER เก็บข้อมูล (ชื่อ, เบอร์, อีเมล, LINE ID) เพื่อจัดการหลักสูตรออนไลน์, ออกใบประกาศนียบัตร และแจ้งข้อมูลหลักสูตร/โปรโมชั่นในอนาคต ข้อมูลจะไม่เปิดเผยต่อบุคคลภายนอก</span>
            </label>
            {err.pdpa && <div style={{ color: B.red, fontSize: 12, marginTop: 4 }}>{err.pdpa}</div>}
          </div>
        </div>

        <button onClick={submitForm} disabled={submitting} style={{ ...css.btn(B.red, B.white, true), marginTop: 18, opacity: submitting ? .6 : 1 }}>รับโค้ดเลย →</button>

        <button onClick={() => setStep("redeem")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 10, border: `1px solid ${B.ltGray}`, fontSize: 13 }}>มีโค้ดอยู่แล้ว? กดใช้รหัส →</button>
      </div>
    </div>
  );

  // ===== Step: checking =====
  if (step === "checking") return (
    <div style={css.page}>
      <div style={{ ...css.wrap, paddingTop: 80, textAlign: "center" }}>
        <div style={{ width: 60, height: 60, border: `4px solid ${B.ltGray}`, borderTopColor: B.red, borderRadius: "50%", margin: "0 auto 20px", animation: "spin 1s linear infinite" }}/>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={{ fontSize: 16, fontWeight: 600 }}>กำลังสร้างโค้ดของคุณ...</div>
        <div style={{ fontSize: 13, color: B.dkGray, marginTop: 6 }}>กรุณารอสักครู่</div>
      </div>
    </div>
  );

  // ===== Step: reveal / already =====
  if ((step === "reveal" || step === "already") && claimed) {
    const days = daysUntil(claimed.expires_at);
    const isAlready = step === "already";
    return (
      <div style={css.page}>
        <div style={css.header(B.red)}><div style={{ fontSize: 16, fontWeight: 700, flex: 1, textAlign: "center" }}>{isAlready ? "พบโค้ดในระบบแล้ว" : "ได้รับโค้ดสำเร็จ!"}</div></div>
        <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
          {!isAlready && (
            <div style={{ textAlign: "center", marginBottom: 18 }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 10px" }}><I name="check" size={32} color={B.green}/></div>
              <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 4px" }}>ยินดีด้วย {claimed.name}!</h2>
              <p style={{ fontSize: 13, color: B.dkGray, margin: 0 }}>โค้ดของคุณพร้อมใช้แล้ว</p>
            </div>
          )}
          {isAlready && (
            <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 14, marginBottom: 16, fontSize: 13, color: B.dkGray, textAlign: "center" }}>
              คุณเคยรับโค้ดด้วยอีเมล/เบอร์นี้แล้ว นี่คือโค้ดเดิมของคุณ
            </div>
          )}

          <div style={{ background: B.white, borderRadius: 16, padding: 20, boxShadow: "0 4px 16px rgba(0,0,0,.08)", border: `2px dashed ${B.red}40`, textAlign: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>รหัสส่วนลด 100%</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{claimed.code}</div>
            <button onClick={() => copyCode(claimed.code)} style={{ ...css.btn(copied ? B.green : B.black, B.white), padding: "10px 24px", fontSize: 13 }}>{copied ? "✓ คัดลอกแล้ว" : "คัดลอกโค้ด"}</button>
            <div style={{ marginTop: 14, padding: "10px 14px", background: `${B.gold}12`, borderRadius: 10, fontSize: 12, color: B.dkGray }}>
              ⏳ หมดอายุใน <strong style={{ color: B.gold }}>{days} วัน</strong> ({new Date(claimed.expires_at).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })})
            </div>
          </div>

          <div style={{ ...css.card, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>ปลดล็อกเมื่อใช้โค้ด:</div>
            {(claimed.modules || PROMO_FREE_MODULES).map(id => {
              const m = COURSE.modules.find(x => x.id === id);
              if (!m) return null;
              return (
                <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${B.gray}` }}>
                  <I name="check" size={16} color={B.green}/>
                  <div style={{ fontSize: 13 }}><strong>{m.short}</strong><div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>{m.desc}</div></div>
                </div>
              );
            })}
          </div>

          <button onClick={() => { setRedeemCode(claimed.code); setStep("redeem"); }} style={{ ...css.btn(B.red, B.white, true), marginBottom: 12, fontSize: 15 }}>ใช้โค้ดและเข้าเรียนเลย →</button>

          <div style={{ ...css.card, textAlign: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>เพิ่ม LINE @jiacpr</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12 }}>รับสิทธิพิเศษและสอบถามได้ทันที</div>
            <img src={LINE_QR_URL} alt="LINE QR @jiacpr" style={{ width: 180, height: 180, borderRadius: 12, border: `1px solid ${B.ltGray}` }}/>
            <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 12, background: "#06C755", borderRadius: 12, padding: "12px 20px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={20} color={B.white}/> เปิด LINE เพิ่มเพื่อน</a>
          </div>

          <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: 12, fontSize: 12, color: B.dkGray, textAlign: "center", marginBottom: 12 }}>
            📧 เราจะส่งสำเนาโค้ดให้ทาง <strong>{load("promo_email", "อีเมล")}</strong><br/>หากไม่ได้รับ ตรวจในกล่อง Spam หรือใช้โค้ดด้านบนได้เลย
          </div>

          <button onClick={() => go("landing")} style={{ ...css.btn(B.white, B.dkGray, true), border: `1px solid ${B.ltGray}`, fontSize: 13 }}>← กลับหน้าแรก</button>
        </div>
      </div>
    );
  }

  // ===== Step: redeem =====
  if (step === "redeem") return (
    <div style={css.page}>
      <div style={css.header(B.red)}><button onClick={() => setStep(claimed ? "reveal" : "form")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>{partner ? "รับสิทธิ์เรียนฟรี" : "ใช้รหัสส่วนลด"}</div></div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        {partner && (
          <div style={{ background: `linear-gradient(135deg, ${B.gold} 0%, #E08800 100%)`, color: B.white, borderRadius: 16, padding: 18, marginBottom: 12, textAlign: "center" }}>
            <div style={{ fontSize: 12, fontWeight: 700, opacity: .9, letterSpacing: 1, textTransform: "uppercase" }}>คูปองเรียนฟรี</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4 }}>จาก {partner.company}</div>
            <div style={{ fontSize: 13, marginTop: 6, opacity: .95 }}>คอร์ส CPR &amp; AED ออนไลน์ เต็มหลักสูตร + ใบประกาศนียบัตร</div>
            <div style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>มูลค่า ฿{partner.sponsor_value || PRICING.full}</div>
            <div style={{ fontSize: 11, marginTop: 8, opacity: .85 }}>ใช้ได้ถึง {thaiShortDate((partner.expires_at || "").slice(0, 10))}</div>
            {partner.status === "redeemed" && <div style={{ marginTop: 10, background: "rgba(0,0,0,.18)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700 }}>คูปองใบนี้ถูกใช้ไปแล้ว</div>}
            {partner.status === "expired" && <div style={{ marginTop: 10, background: "rgba(0,0,0,.18)", borderRadius: 8, padding: "8px 10px", fontSize: 12.5, fontWeight: 700 }}>คูปองใบนี้หมดอายุแล้ว</div>}
          </div>
        )}
        <div style={css.card}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>{partner ? "กรอกชื่อ-เบอร์เพื่อรับสิทธิ์" : "กรอกรหัสส่วนลด"}</h3>
          {!partner && <p style={{ fontSize: 12, color: B.dkGray, marginTop: 0, marginBottom: 16 }}>รหัสรูปแบบ LEAD-XXXXXX, VCH-XXXXXX หรือโค้ดที่ได้รับจากเจ้าหน้าที่ (เช่น JIA-STUDENT)</p>}
          <input type="text" value={redeemCode} onChange={e => { setRedeemCode(e.target.value.toUpperCase()); setRedeemErr(""); }} placeholder="LEAD-XXXXXX" autoCapitalize="characters"
            style={{ width: "100%", padding: "14px 16px", border: `2px solid ${redeemErr ? B.red : B.ltGray}`, borderRadius: 10, fontSize: 18, outline: "none", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 2, textAlign: "center", textTransform: "uppercase", marginTop: partner ? 8 : 0 }}/>
          {redeemErr && <div style={{ color: B.red, fontSize: 13, marginTop: 8 }}>{redeemErr}</div>}
        </div>
        <div style={{ ...css.card, marginTop: 12 }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, marginTop: 0, marginBottom: 10 }}>ข้อมูลผู้เรียน (สำหรับตรวจสอบคะแนนภายหลัง)</h3>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>ชื่อ-นามสกุล *</label>
            <input type="text" value={redeemName} onChange={e => { setRedeemName(e.target.value); setRedeemErr(""); }} placeholder="เช่น สมชาย ใจดี"
              style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
          </div>
          <div>
            <label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 6 }}>เบอร์โทรศัพท์ *</label>
            <input type="tel" value={redeemPhone} onChange={e => { setRedeemPhone(e.target.value); setRedeemErr(""); }} placeholder="เช่น 081-234-5678"
              style={{ width: "100%", padding: "12px 14px", border: `2px solid ${B.ltGray}`, borderRadius: 10, fontSize: 14, outline: "none", boxSizing: "border-box" }}/>
          </div>
        </div>
        <button onClick={redeem} disabled={validating || !redeemCode} style={{ ...css.btn(B.red, B.white, true), marginTop: 16, opacity: (validating || !redeemCode) ? .5 : 1 }}>{validating ? "กำลังตรวจสอบ..." : partner ? "รับสิทธิ์เรียนฟรี →" : "ปลดล็อกบทเรียน →"}</button>
        {!claimed && !partner && <button onClick={() => setStep("form")} style={{ ...css.btn(B.white, B.dkGray, true), border: `1px solid ${B.ltGray}`, marginTop: 10, fontSize: 13 }}>ยังไม่มีโค้ด? รับฟรีที่นี่ →</button>}
      </div>
    </div>
  );

  // ===== Step: redeemed =====
  if (step === "redeemed" && claimed) { const sp = getPartnerSponsor(); return (
    <div style={css.page}>
      <div style={{ ...css.wrap, paddingTop: 60, textAlign: "center", paddingBottom: 40 }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 18px" }}><I name="check" size={40} color={B.green}/></div>
        <h2 style={{ fontSize: 24, fontWeight: 800, margin: "0 0 8px" }}>{sp ? `รับสิทธิ์เรียนฟรีจาก ${sp.company} แล้ว!` : "ปลดล็อกสำเร็จ!"}</h2>
        <p style={{ fontSize: 14, color: B.dkGray, marginBottom: 24 }}>โค้ด {claimed.code} ใช้แล้ว</p>

        <div style={{ ...css.card, textAlign: "left", marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>บทเรียนที่ปลดล็อก ({(claimed.modules || PROMO_FREE_MODULES).length} บท):</div>
          {(claimed.modules || PROMO_FREE_MODULES).map(id => {
            const m = COURSE.modules.find(x => x.id === id);
            return m ? (
              <div key={id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${B.gray}` }}>
                <I name="check" size={16} color={B.green}/>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{m.short}</div>
              </div>
            ) : null;
          })}
        </div>

        {sp && <div style={{ marginBottom: 20 }}><PartnerContactCard sponsor={sp} where="redeemed"/></div>}

        <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white, true), fontSize: 16, padding: "16px 32px" }}>เข้าเรียนเลย →</button>
      </div>
    </div>
  ); }

  // fallback
  return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <p style={{ color: B.dkGray }}>เกิดข้อผิดพลาด</p>
      <button onClick={() => { setStep("form"); setClaimed(null); }} style={{ ...css.btn(B.red, B.white), marginTop: 16 }}>เริ่มใหม่</button>
    </div></div>
  );
}

// ==================== PAYMENT ====================
function Payment({ go, user }) {
  const [uploading, setUploading] = useState(false);
  const [slipDone, setSlipDone] = useState(false);

  const handleSlip = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const u = user || load("user", null);
        const fileName = (u?.name || "student") + "_online_" + Date.now() + "_" + randToken() + ".jpg";
        const byteChars = atob(reader.result.split(",").pop());
        const byteArr = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArr[i] = byteChars.charCodeAt(i);
        const blob = new Blob([byteArr], { type: "image/jpeg" });
        const uploadRes = await fetch(`${SUPABASE_URL}/storage/v1/object/slips/${fileName}`, {
          method: "POST",
          headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "image/jpeg", "x-upsert": "true" },
          body: blob
        });
        if (uploadRes.ok) {
          const data = { url: `${SUPABASE_URL}/storage/v1/object/public/slips/${fileName}` };
          supaRest("online_purchases", "POST", { phone: u?.phone || "", modules: "online_fee", amount: 100, slip_url: data.url, payment_status: "แจ้งชำระแล้ว" });
          setSlipDone(true);
          save("enrolled", true);
        } else {
          alert("อัพโหลดไม่สำเร็จ กรุณาส่งสลิปทาง LINE แทน");
        }
      } catch(err) {
        alert("เกิดข้อผิดพลาด กรุณาส่งสลิปทาง LINE");
      }
      setUploading(false);
    };
    reader.readAsDataURL(file);
  };

  if (slipDone) return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>ได้รับสลิปแล้ว!</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>เจ้าหน้าที่จะตรวจสอบการชำระเงินอีกครั้ง ระหว่างนี้เข้าเรียนได้เลย</p>
      <button onClick={() => go("course")} style={{ ...css.btn(B.red, B.white), marginTop: 20, padding: "14px 40px", fontSize: 16 }}>เข้าเรียนเลย →</button>
    </div></div>
  );

  return (
    <div style={css.page}><div style={css.header(B.red)}><button onClick={() => go("register")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ fontSize: 16, fontWeight: 700 }}>ชำระเงิน ฿100</div></div>
    <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
      <div style={{ ...css.card, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>คอร์ส CPR & AED ออนไลน์</div>
        <div style={{ fontSize: 36, fontWeight: 800, color: B.red, margin: "8px 0" }}>฿100</div>
        <div style={{ fontSize: 13, color: B.dkGray }}>เอา ฿100 เป็นส่วนลดตอนมาเรียน On-site</div>
      </div>

      <div style={{ ...css.card, marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>โอนเงินเข้าบัญชี</div>
        <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
          <div style={{ fontSize: 13, color: B.dkGray }}>ธนาคารกสิกรไทย</div>
          <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: 2, margin: "6px 0" }}>134-3-11564-0</div>
          <div style={{ fontSize: 13, color: B.dkGray }}>บริษัท โรจน์รุ่งธุรกิจ จำกัด</div>
        </div>
        <button onClick={() => { navigator.clipboard?.writeText("1343115640"); alert("คัดลอกเลขบัญชีแล้ว!"); }} style={{ ...css.btn(B.white, B.black, true), border: `1px solid ${B.ltGray}`, fontSize: 13, padding: "8px 20px" }}>คัดลอกเลขบัญชี</button>
      </div>

      <div style={{ ...css.card, marginTop: 14, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>อัพโหลดสลิป</div>
        <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 14 }}>โอนแล้วอัพโหลดสลิปที่นี่เลย</div>
        <label style={{ ...css.btn(B.red, B.white), display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", opacity: uploading ? 0.6 : 1 }}>
          <I name="save" size={18} color={B.white}/> {uploading ? "กำลังอัพโหลด..." : "เลือกรูปสลิป"}
          <input type="file" accept="image/*" capture="environment" onChange={handleSlip} disabled={uploading} style={{ display: "none" }}/>
        </label>
      </div>

      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 14, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> หรือส่งสลิปทาง LINE @jiacpr</a>
    </div></div>
  );
}

const ENCOURAGE = ["","เยี่ยมมาก! รู้เรื่อง CPR ผู้ใหญ่แล้ว ไปบทต่อไปเลย","ดีมาก! รู้ทั้ง CPR และ AED แล้ว","เก่งมาก! CPR เด็กก็ไม่ยากเลย","สุดยอด! เรียนมาครึ่งทางแล้ว","ใกล้จบแล้ว! อีกบทเดียว","ผ่านครบทุกบทแล้ว! พร้อมสอบข้อสอบสุดท้ายได้เลย"];

// ==================== COURSE ====================
function Course({ go, progress, setProgress, user, setUser, openBlog, goGameRandom }) {
  const [active, setActive] = useState(null); const [quiz, setQuiz] = useState(false); const [ans, setAns] = useState({}); const [result, setResult] = useState(null); const [watched, setWatched] = useState(false); const [reviewMode, setReviewMode] = useState(false); const [timer, setTimer] = useState(0); const [canWatch, setCanWatch] = useState(false); const [mustRewatch, setMustRewatch] = useState(false); const [drawnQuiz, setDrawnQuiz] = useState(null); const [grading, setGrading] = useState(false);
  const beginQuiz = (mod) => { setDrawnQuiz(drawQuiz(mod)); setAns({}); setResult(null); setQuiz(true); };
  const timerRef = useRef(null);
  // ด่านก่อนสอบปลายภาค — grade-quiz บังคับ access_token จริงสำหรับ module สุดท้ายเสมอ (กันปลอมผลสอบ/
  // ไล่เดาหาเฉลย) หน้านี้กันไม่ให้ผู้เรียนกดเข้าไปแล้วเจอ 401 เงียบๆ โดยไม่รู้สาเหตุ
  const [examGate, setExamGate] = useState(false);
  const isAuthed = () => !!(user || load("user", null))?.auth_user_id;
  useEffect(() => {
    if (!examGate || !isAuthed()) return;
    setExamGate(false);
    const finalMod = COURSE.modules[COURSE.modules.length - 1];
    setActive(finalMod.id); beginQuiz(finalMod);
  }, [examGate, user?.auth_user_id]);
  // มาจากปุ่ม "ทำข้อสอบปลายภาคใหม่" (ใบประกาศหมดอายุ) → เปิดข้อสอบปลายภาคให้เลย (ยังไม่ล็อกอิน → ด่านเข้าสู่ระบบก่อน)
  useEffect(() => {
    if (!load("autostart_final", false)) return;
    save("autostart_final", false);
    const finalMod = COURSE.modules[COURSE.modules.length - 1];
    if (!isModuleAccessible(finalMod.id, getPurchased())) return;
    if (!isAuthed()) { setExamGate(true); return; }
    setActive(finalMod.id); beginQuiz(finalMod);
  }, []);
  // มีสลิปรอตรวจ → เช็คสถานะกับ server ตอนเปิดหน้าคอร์ส แอดมินอนุมัติแล้วจะปลดล็อกให้ทันที
  const [, setSlipSync] = useState(0);
  useEffect(() => { (async () => { if (await syncPendingSlips()) setSlipSync(x => x + 1); })(); }, []);
  const purchased = getPurchased();
  const hasMod = (id) => isModuleAccessible(id, purchased);
  const signedUp = isSignedUp();
  const gateOn = AUTH_GATE_ENABLED && getGateVariant() !== "soft"; // ด่านบังคับสมัครหลังจบบท 1
  const unlocked = id => {
    if (!hasMod(id)) return false;
    if (id === 1) return true;                                     // บทที่ 1 เรียนฟรีเสมอ
    const m = COURSE.modules.find(x => x.id === id);
    if (m && !m.vid && progress.done.filter(x => x <= 6).length < 6) return false; // แบบทดสอบสุดท้าย: ต้องเรียน+ผ่านครบ 6 บทก่อน (บังคับแม้ช่วง FREE_LAUNCH)
    if (!(progress.done.includes(id - 1) || FREE_LAUNCH)) return false;
    if (gateOn && !signedUp) return false;                         // บท 2+ ต้องสมัครก่อน
    return true;
  };
  const done = id => progress.done.includes(id);

  // Progress (ใช้ร่วมกันทั้งหน้าบทเรียนและหน้ารายการ)
  const total = COURSE.modules.length;
  const doneCount = progress.done.length;
  const pct = Math.round((doneCount / total) * 100);
  const remaining = total - doneCount;            // เหลืออีกกี่บทจะจบ + ได้ใบประกาศ
  const cheer = remaining === 0
    ? "เรียนครบทุกบทแล้ว! ไปรับใบประกาศได้เลย 🎉"
    : remaining === 1 ? "เหลืออีกบทเดียวเท่านั้น สู้ๆ ใกล้ได้ใบประกาศแล้ว!"
    : doneCount === 0 ? "เริ่มบทแรกกันเลย ค่อยๆ เรียนไปทีละบท เป็นกำลังใจให้นะ 💪"
    : remaining <= 3 ? "เลยครึ่งทางแล้ว อีกนิดเดียวจะจบและได้ใบประกาศ!"
    : "เรียนมาได้ดีมาก ไปต่อได้เลย เป็นกำลังใจให้!";

  // Timer for video watching (90% of duration)
  useEffect(() => { if (active && !reviewMode && !done(active)) { const mod = COURSE.modules.find(m => m.id === active); if (mod && mod.dur) { const target = Math.floor(mod.dur * 0.9); setTimer(target); setCanWatch(false); timerRef.current = setInterval(() => { setTimer(prev => { if (prev <= 1) { clearInterval(timerRef.current); setCanWatch(true); return 0; } return prev - 1; }); }, 1000); } } return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, [active, reviewMode, mustRewatch]);

  const submitQuiz = async () => {
    const mod = COURSE.modules.find(m => m.id === active); const qz = drawnQuiz || mod.quiz;
    const isFinal = !mod.vid;
    // ตรวจฝั่ง server (เฉลยอยู่ใน grade-quiz เท่านั้น) — แปลงคำตอบจากตำแหน่งบนจอกลับเป็น index ต้นฉบับก่อนส่ง
    const questions = qz.map((q, i) => (q.i ?? i));
    const answers = qz.map((q, i) => (q.order ? q.order[ans[i]] : ans[i]));
    // ข้อสอบปลายภาคต้องแนบ access token จริง (grade-quiz บังคับตรวจ+จำกัดจำนวนครั้ง+ไม่คืนเฉลย) —
    // บทเรียน 1-6 ไม่ต้อง (แค่แบบฝึกหัดทบทวน ไม่ใช่จุดที่ต้องยืนยันตัวตน)
    let accessToken = null;
    if (isFinal) {
      try { const supa = await getSupabase(); const { data: { session } } = await supa.auth.getSession(); accessToken = session?.access_token || null; } catch (e) {}
    }
    setGrading(true);
    let graded = null;
    try {
      const res = await fetch(FN_URL("grade-quiz"), { method: "POST", headers: FN_HEADERS, body: JSON.stringify({ module_id: mod.id, questions, answers, access_token: accessToken }) });
      if (res.ok) graded = await res.json();
      else if (res.status === 401) { alert("กรุณาเข้าสู่ระบบก่อนทำข้อสอบปลายภาค"); return; }
      else if (res.status === 429) { const d = await res.json().catch(() => ({})); alert(d.error || "ทำข้อสอบครบจำนวนครั้งที่กำหนดต่อวันแล้ว กรุณาลองใหม่วันถัดไป"); return; }
    } catch (e) {}
    setGrading(false);
    if (!graded || typeof graded.score !== "number") { alert("ตรวจคำตอบไม่สำเร็จ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง"); return; }
    const { score, correct, total: gradedTotal, passed } = graded;
    // เฉลยที่ตอบกลับเป็น index ต้นฉบับ → แปลงเป็นตำแหน่งที่แสดงบนจอ เพื่อไฮไลต์ข้อถูกตอนรีวิว
    // ข้อสอบปลายภาคไม่คืนเฉลยกลับมา (กันไล่เดาทีละข้อ) — graded.corrects เป็น undefined ได้ตามปกติ
    const corrects = Array.isArray(graded.corrects) ? qz.map((q, i) => (q.order ? q.order.indexOf(graded.corrects[i]) : graded.corrects[i])) : null;
    setResult({ score, correct, total: gradedTotal, passed, corrects });
    if (passed && !progress.done.includes(active)) { const np = { ...progress, done: [...progress.done, active], scores: { ...progress.scores, [active]: score } }; setProgress(np); save("progress", np); syncProgressRemote(np);
      // เก็บคะแนนรายบทลง online_students ตรงๆ (ไม่ผ่าน course_progress) เพื่อให้พนักงานดูคะแนนย่อยได้
      // แม้ผู้เรียนจะลงทะเบียนแบบชื่อ+เบอร์โทรอย่างเดียว ไม่ได้ล็อกอินผ่าน LINE/Google/Email OTP จริง
      const su = user || load("user", null);
      if (su?.phone && su?.name) supaRest("online_students", "PATCH", { chapter_scores: np.scores }, `?phone=ilike.*${su.phone.replace(/\D/g,"").slice(-9)}&name=eq.${encodeURIComponent(su.name)}`);
      if (!mod.vid && mod.id === COURSE.modules[COURSE.modules.length - 1].id) {
        const u = user || load("user", null);
        // ใช้คูปองเดิมที่เคยออกให้ (ตอนสมัคร) เป็นหลัก — อย่าสร้างทับ ไม่งั้นโค้ดที่ผู้เรียนจดไว้จะใช้ไม่ได้
        // นักเรียน pre-course (จ่ายค่า on-site แล้ว) ไม่ออกคูปอง ฿100 — กันใบประกาศ/ทีมขายโชว์ส่วนลดที่ไม่มีจริง
        const existingCoupon = load("coupon", null);
        if (u) {
          const renew = new Date(); renew.setMonth(renew.getMonth() + 6);
          // ต้องบันทึก completed_at ก่อน แล้วค่อยออกคูปอง — issue_online_coupon เช็กว่าเรียนจบแล้วจริงจากแถวนี้
          await supaRest("online_students", "PATCH", { status: "จบคอร์ส ✅", completed_at: new Date().toISOString(), final_score: score, renew_date: renew.toISOString().split("T")[0] }, `?phone=ilike.*${u.phone.replace(/\D/g,"").slice(-9)}&name=eq.${encodeURIComponent(u.name)}`);
          const coupon = existingCoupon || (isPreCourseStudent() || !u.customer_id ? null : await issueOnlineCoupon(u.customer_id, u.phone));
          if (coupon && !existingCoupon) save("coupon", coupon);
          // pre-course ไม่ต้องเข้าคิวติดตามขาย (จ่ายและจองคลาสแล้ว)
          if (!isPreCourseStudent()) supaRest("sales_tracking", "POST", { name: u.name, phone: u.phone.replace(/\D/g,""), completed_date: new Date().toISOString(), score, coupon_code: coupon, follow_status: "ยังไม่ติดต่อ" });
        }
      }
    }
  };
  const resetLesson = () => { setActive(null); setQuiz(false); setAns({}); setResult(null); setWatched(false); setReviewMode(false); setMustRewatch(false); setCanWatch(false); setTimer(0); setDrawnQuiz(null); if (timerRef.current) clearInterval(timerRef.current); };
  const formatTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  // ด่านก่อนสอบปลายภาค — เข้าสู่ระบบสำเร็จ (LINE หรืออีเมล) จะปิดด่านนี้และเริ่มข้อสอบให้อัตโนมัติ (useEffect ด้านบน)
  if (examGate) {
    return (<div style={css.page}><div style={css.header(B.black)}><button onClick={() => setExamGate(false)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: B.white }}>ก่อนทำข้อสอบปลายภาค</div></div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        <div style={css.card}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginTop: 0 }}>เข้าสู่ระบบก่อนทำข้อสอบปลายภาค</h2>
          <p style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.7 }}>เพื่อให้คะแนน/ใบประกาศผูกกับบัญชีจริงของคุณ (กันคนอื่นปลอมผลสอบแทนคุณ) กรุณาเข้าสู่ระบบก่อนเริ่มสอบ — ใช้บัญชีเดียวกับที่จะใช้จองคอร์สภาคปฏิบัติได้เลย</p>
          <LineLoginButton user={user} setUser={setUser} label="เข้าสู่ระบบด้วย LINE"/>
          <EmailIdentityCard user={user} setUser={setUser}/>
        </div>
      </div>
    </div>);
  }

  if (active) {
    const mod = COURSE.modules.find(m => m.id === active); const isFinal = !mod.vid; const alreadyDone = done(mod.id);
    return (<div style={css.page}><div style={css.header(B.black)}><button onClick={resetLesson} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}><I name="back" size={24} color={B.white}/></button><div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: B.white }}>{mod.title}</div></div>
      {/* Progress strip — เห็นความคืบหน้าระหว่างเรียน + ให้กำลังใจ */}
      <div style={{ background: B.black, padding: "0 24px 14px" }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.12)" }}><div style={{ height: "100%", borderRadius: 3, background: B.green, width: `${pct}%`, transition: "width .5s" }}/></div>
          <span style={{ fontSize: 12, fontWeight: 600, color: B.white }}>{pct}%</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "rgba(255,255,255,.6)", marginTop: 5 }}>
          <span>{doneCount}/{total} บทเรียน</span>
          {remaining > 0 && <><span style={{ opacity: .5 }}>·</span><I name="cert" size={13} color={B.gold}/><span>อีก {remaining} บท จะจบและรับใบประกาศ</span></>}
        </div>
      </div></div>
      <div style={{ background: `${B.gold}10`, borderBottom: `1px solid ${B.gold}20`, padding: "10px 24px" }}><div style={{ maxWidth: 480, margin: "0 auto", fontSize: 13, fontWeight: 600, color: "#B45309", textAlign: "center" }}>{cheer}</div></div>
      <div style={{ ...css.wrap, paddingTop: 24, paddingBottom: 40 }}>
        {(!quiz && !isFinal) || reviewMode || mustRewatch ? (<>
          <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 16 }}><iframe width="100%" style={{ aspectRatio: "16/9", border: "none", display: "block" }} src={"https://www.youtube.com/embed/" + mod.vid + "?rel=0"} title={mod.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen/></div>
          <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6, marginBottom: 16 }}>{mod.desc}</p>

          {mustRewatch ? (<>
            <div style={{ background: `${B.red}08`, borderRadius: 12, padding: 16, marginBottom: 12, textAlign: "center", border: `1px solid ${B.red}20` }}>
              <I name="warn" size={24} color={B.red}/><div style={{ color: B.red, fontSize: 14, fontWeight: 600, marginTop: 8 }}>สอบไม่ผ่าน — กรุณาดูวิดีโอใหม่ก่อนสอบอีกครั้ง</div>
            </div>
            {!canWatch ? (<div style={{ textAlign: "center", color: B.dkGray, fontSize: 13 }}>รอดูวิดีโอ... เหลือ {formatTime(timer)}</div>) : (<button onClick={() => { setMustRewatch(false); setWatched(true); beginQuiz(mod); }} style={css.btn(B.red, B.white, true)}>ดูจบแล้ว → ทำแบบทดสอบอีกครั้ง</button>)}
          </>) : reviewMode ? (<button onClick={resetLesson} style={css.btn(B.black, B.white, true)}>← กลับหน้าบทเรียน</button>
          ) : alreadyDone ? (<><div style={{ background: `${B.green}15`, borderRadius: 12, padding: 16, marginBottom: 12, textAlign: "center" }}><div style={{ color: B.green, fontSize: 14, fontWeight: 600 }}>✓ ผ่านบทนี้แล้ว ({progress.scores[mod.id]}%)</div></div><button onClick={resetLesson} style={css.btn(B.black, B.white, true)}>← กลับ</button></>
          ) : !canWatch ? (<div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 16, textAlign: "center" }}><div style={{ fontSize: 13, color: B.dkGray }}>กรุณาดูวิดีโอก่อน</div><div style={{ fontSize: 20, fontWeight: 700, color: B.gold, marginTop: 4 }}>{formatTime(timer)}</div></div>
          ) : !watched ? (<button onClick={() => setWatched(true)} style={css.btn(B.green, B.white, true)}>ดูวิดีโอจบแล้ว ✓</button>
          ) : (<button onClick={() => beginQuiz(mod)} style={css.btn(B.red, B.white, true)}>ทำแบบทดสอบ →</button>)}
        </>) : (() => { const qz = drawnQuiz || mod.quiz; return (
          <div style={css.card}><h3 style={{ fontSize: 16, fontWeight: 700, marginTop: 0, marginBottom: 4 }}>{isFinal ? "แบบทดสอบสุดท้าย" : "แบบทดสอบท้ายบท"}</h3><p style={{ fontSize: 12, color: B.dkGray, margin: "0 0 20px" }}>ต้องได้ 80% ขึ้นไป ({Math.ceil(qz.length * 0.8)}/{qz.length} ข้อ)</p>
            {qz.map((q, qi) => (<div key={qi} style={{ marginBottom: 22 }}><div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{qi + 1}. {q.q}</div>{q.c.map((c, ci) => { let bg = B.gray, border = "transparent"; if (result) { if (ci === result.corrects?.[qi]) { bg = `${B.green}18`; border = B.green; } else if (ans[qi] === ci) { bg = `${B.red}12`; border = B.red; } } else if (ans[qi] === ci) { bg = `${B.red}10`; border = B.red; } return <button key={ci} onClick={() => !result && setAns({...ans, [qi]: ci})} style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 14px", marginBottom: 5, background: bg, border: `2px solid ${border}`, borderRadius: 8, fontSize: 13, cursor: result ? "default" : "pointer" }}>{c}</button>; })}</div>))}
            {!result ? <button onClick={submitQuiz} disabled={grading || Object.keys(ans).length < qz.length} style={css.btn(!grading && Object.keys(ans).length >= qz.length ? B.red : B.ltGray, !grading && Object.keys(ans).length >= qz.length ? B.white : B.dkGray, true)}>{grading ? "กำลังตรวจคำตอบ..." : "ส่งคำตอบ"}</button>
            : <div style={{ textAlign: "center" }}><div style={{ background: result.passed ? `${B.green}12` : `${B.red}08`, borderRadius: 12, padding: 20, marginBottom: 16 }}><div style={{ fontSize: 40, fontWeight: 800, color: result.passed ? B.green : B.red }}>{result.score}%</div><div style={{ fontSize: 14, fontWeight: 600, color: result.passed ? B.green : B.red }}>{result.passed ? "ผ่าน!" : "ไม่ผ่าน"}</div><div style={{ fontSize: 12, color: B.dkGray, marginTop: 4 }}>ตอบถูก {result.correct}/{result.total} ข้อ</div></div>
              {result.passed && !isFinal && <div style={{ background: `${B.green}08`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, border: `1px solid ${B.green}20` }}><div style={{ fontSize: 14, fontWeight: 600, color: B.green, textAlign: "center" }}>{ENCOURAGE[mod.id] || "เยี่ยมมาก! ไปต่อได้เลย"}</div></div>}
              {!result.passed && <div style={{ fontSize: 13, color: B.dkGray, marginBottom: 12, textAlign: "center" }}>ไม่เป็นไร ทบทวนวิดีโออีกครั้ง แล้วสอบใหม่ได้เลย</div>}
              {result.passed ? (<button onClick={() => { const gate = gateOn && mod.id === 1 && !isFinal && !signedUp; resetLesson(); if (isFinal) go("register"); else if (gate) go("signupgate"); }} style={css.btn(B.green, B.white)}>{isFinal ? "ลงทะเบียนรับใบประกาศนียบัตร →" : (gateOn && mod.id === 1 && !signedUp ? "สมัครเพื่อรับใบผ่าน + เรียนต่อ →" : "กลับหน้าบทเรียน →")}</button>)
              : mod.vid ? (<button onClick={() => { setQuiz(false); setResult(null); setAns({}); setWatched(false); setMustRewatch(true); setCanWatch(false); setTimer(Math.floor(mod.dur * 0.9)); }} style={css.btn(B.red, B.white)}>← กลับดูวิดีโอใหม่แล้วสอบอีกครั้ง</button>)
              : (<button onClick={() => beginQuiz(mod)} style={css.btn(B.red, B.white)}>ทำใหม่</button>)}
            </div>}
          </div>
        ); })()}
      </div></div>);
  }

  return (<div style={css.page}>
    <div style={{ background: `linear-gradient(135deg, ${B.black} 0%, #2a2a2a 100%)`, color: B.white, padding: "24px 24px 30px" }}><div style={{ maxWidth: 480, margin: "0 auto" }}><div style={{ fontSize: 11, letterSpacing: 2, opacity: .5, textTransform: "uppercase" }}>JIA TRAINER CENTER</div><h2 style={{ fontSize: 20, fontWeight: 700, margin: "4px 0 14px" }}>CPR & AED ออนไลน์</h2><div style={{ display: "flex", alignItems: "center", gap: 10 }}><div style={{ flex: 1, height: 6, borderRadius: 3, background: "rgba(255,255,255,.12)" }}><div style={{ height: "100%", borderRadius: 3, background: B.green, width: `${pct}%`, transition: "width .5s" }}/></div><span style={{ fontSize: 12, fontWeight: 600 }}>{pct}%</span></div><div style={{ fontSize: 11, opacity: .5, marginTop: 4 }}>{progress.done.length}/{COURSE.modules.length} บทเรียน</div></div></div>
    {!load("line_added", false) && (() => {
      const lc = getLinkCode();
      const dl = lineLinkDeepLink(lc);
      return (
        <div style={{ ...css.wrap, paddingTop: 16 }}>
          <a href={dl} target="_blank" rel="noopener noreferrer"
             onClick={() => { safeTrack("line_oa_clicked", { variant: "course-banner", has_link_code: true }); phCapture("line_oa_clicked", { variant: "course-banner", has_link_code: true }); markLineAdded(user); }}
             style={{ display: "flex", alignItems: "center", gap: 12, background: "#06C75512", border: "1px solid #06C75540", borderRadius: 12, padding: "12px 14px", textDecoration: "none", color: B.black }}>
            <div style={{ minWidth: 38, height: 38, borderRadius: 10, background: "#06C755", display: "flex", alignItems: "center", justifyContent: "center" }}><I name="line" size={22} color={B.white}/></div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>เพิ่ม LINE @jiacpr + ผูกบัญชี</div>
              <div style={{ fontSize: 11, color: B.dkGray, marginTop: 2 }}>รับเตือนทบทวน + โปรต่ออายุ + คูปองพิเศษ อัตโนมัติ</div>
            </div>
            <button onClick={(e) => { e.preventDefault(); markLineAdded(user); window.open(dl, "_blank"); }} style={{ background: "#06C755", color: B.white, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>เพิ่ม →</button>
          </a>
        </div>
      );
    })()}
    <div style={{ ...css.wrap, paddingTop: 20, paddingBottom: 40 }}>
      <AccountCard user={user} setUser={setUser}/>
      {/* สิทธิ์ปลดทุกบทจากแคมเปญวันเดียว — บอกนักเรียนชัดๆ ว่าเรียนครบ+สอบผ่านแล้วได้ใบประกาศเลย */}
      {load("camp_course_unlock", false) && (
        <div style={{ width: "100%", marginBottom: 12, padding: "12px 14px", background: `${B.gold}15`, border: `1.5px dashed ${B.gold}`, borderRadius: 12, fontSize: 13, lineHeight: 1.6, color: B.black }}>
          🎉 <b>สิทธิ์พิเศษแคมเปญ LINE:</b> ปลดคอร์สให้ครบทุกบทแล้ว — เรียนจบ + สอบผ่าน รับใบประกาศนียบัตรออนไลน์ได้เลย
        </div>
      )}
      {/* คูปองพาร์ทเนอร์ (QR ธุรกิจพันธมิตร) — เตือนตลอดว่าใครมอบสิทธิ์เรียนฟรีนี้ให้ + ปุ่มติดต่อกลับ */}
      {getPartnerSponsor() && <div style={{ marginBottom: 12 }}><PartnerContactCard sponsor={getPartnerSponsor()} where="course" compact/></div>}
      {/* CPR HERO — เกมฝึกสถานการณ์จริง อิงเนื้อหาบทเรียน (เล่นฟรีทุกเคส) */}
      <button onClick={() => { safeTrack("game_banner_click", { from: "course" }); phCapture("game_banner_click", { from: "course" }); (goGameRandom || (() => go("game")))(); }} style={{ width: "100%", marginBottom: 12, background: "linear-gradient(135deg, #10182F 0%, #2B3D77 100%)", color: B.white, border: "none", borderRadius: 14, padding: "14px 16px", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ minWidth: 42, height: 42, borderRadius: 11, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🚨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>เกม CPR HERO — ลองของจริง!</div>
          <div style={{ fontSize: 11, opacity: .8, marginTop: 2 }}>จำลอง 8 สถานการณ์ตามบทเรียน • เล่นฟรี</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 800, color: "#F2C14E" }}>เล่นเลย →</span>
      </button>
      {doneCount > 0 && remaining > 0 && <div style={{ background: `${B.gold}10`, borderRadius: 12, padding: "12px 16px", marginBottom: 12, border: `1px solid ${B.gold}30`, textAlign: "center" }}><div style={{ fontSize: 13, fontWeight: 600, color: "#B45309" }}>{cheer}</div><div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, fontSize: 11, color: "#B45309", opacity: .8, marginTop: 4 }}><I name="cert" size={12} color={B.gold}/><span>อีก {remaining} บท จะจบและรับใบประกาศ</span></div></div>}
      {getPendingSlips().length > 0 && (
        <div style={{ background: `${B.gold}12`, border: `1px solid ${B.gold}40`, borderRadius: 12, padding: "10px 14px", marginBottom: 10, fontSize: 12.5, color: "#8a6d1a", display: "flex", alignItems: "center", gap: 8 }}>
          <I name="warn" size={16} color={B.gold}/>
          <span style={{ flex: 1 }}>สลิปของคุณอยู่ระหว่างตรวจสอบ — อนุมัติแล้วบทเรียนจะปลดล็อกอัตโนมัติ</span>
          <button onClick={async () => { await syncPendingSlips(); setSlipSync(x => x + 1); }} style={{ background: "none", border: `1px solid ${B.gold}`, borderRadius: 8, padding: "4px 10px", fontSize: 12, color: "#8a6d1a", cursor: "pointer", whiteSpace: "nowrap" }}>เช็คสถานะ</button>
        </div>
      )}
      {progress.done.includes(COURSE.modules[COURSE.modules.length - 1].id) && <CourseCertNotice go={go}/>}
      {COURSE.modules.map(m => { const owns = hasMod(m.id); const ok = unlocked(m.id); const dn = done(m.id); const fin = !m.vid; const needBuy = !owns && !FREE_LAUNCH && m.id <= 6; const gateLock = gateOn && !signedUp && m.id >= 2 && (progress.done.includes(m.id - 1) || FREE_LAUNCH); return (<button key={m.id} onClick={() => { if (needBuy) { go("store"); return; } if (!ok) { if (gateLock) go("signupgate"); else if (fin) alert("กรุณาเรียนและผ่านแบบทดสอบให้ครบทั้ง 6 บทก่อน จึงจะทำแบบทดสอบสุดท้ายได้"); return; } if (fin && !isAuthed()) { setExamGate(true); return; } setActive(m.id); if (fin) beginQuiz(m); else if (dn) setReviewMode(true); }} style={{ display: "flex", width: "100%", gap: 12, alignItems: "center", padding: 14, marginBottom: 8, background: needBuy ? `${B.gold}06` : B.white, border: dn ? `2px solid ${B.green}` : needBuy ? `1px dashed ${B.gold}` : "2px solid transparent", borderRadius: 14, cursor: (ok || needBuy || gateLock) ? "pointer" : "not-allowed", opacity: (ok || needBuy || gateLock) ? 1 : .5, textAlign: "left" }}><div style={{ minWidth: 42, height: 42, borderRadius: 11, background: dn ? B.green : needBuy ? `${B.gold}18` : fin ? `${B.gold}18` : `${B.red}10`, display: "flex", alignItems: "center", justifyContent: "center" }}>{dn ? <I name="check" size={18} color={B.white}/> : needBuy ? <I name="lock" size={16} color={B.gold}/> : !ok ? <I name="lock" size={16} color={gateLock ? "#06C755" : B.dkGray}/> : fin ? <I name="cert" size={18} color={B.gold}/> : <I name="play" size={16} color={B.red}/>}</div><div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 600 }}>{m.title}</div><div style={{ fontSize: 12, color: needBuy ? B.gold : gateLock ? "#06994A" : B.dkGray, marginTop: 2 }}>{dn ? (fin ? `✓ ผ่านแล้ว (${progress.scores[m.id]}%)` : `✓ ผ่านแล้ว • กดเพื่อดูวิดีโอซ้ำ`) : needBuy ? `฿${PRICING.single} — กดเพื่อซื้อ` : gateLock ? "🔓 สมัครฟรีเพื่อปลดล็อก" : (fin && !ok) ? "🔒 เรียนให้ครบทุกบทก่อน จึงทำแบบทดสอบได้" : m.vid ? `วิดีโอ + ${QUIZ_DRAW_N(m)} คำถาม` : `${QUIZ_DRAW_N(m)} คำถาม • ต้องได้ 80%`}</div></div>{needBuy ? <span style={{ fontSize: 14, fontWeight: 700, color: B.gold }}>฿{PRICING.single}</span> : ok && !dn ? <I name="arrow" size={14} color={B.dkGray}/> : ok && dn && m.vid ? <I name="replay" size={14} color={B.green}/> : null}</button>); })}
      {user?.customer_id && user?.phone && progress.done.length > 0 && <ReferralCard user={user} compact/>}
      <EmergencyGuideCard compact/>
      {(load("last_purchase", null) || (load("purchased", []) || []).some((x) => x > 1)) && <button onClick={() => go("taxinvoice")} style={{ background: "none", border: "none", color: B.dkGray, fontSize: 12.5, textDecoration: "underline", cursor: "pointer", marginTop: 12, padding: 0 }}>ต้องการใบกำกับภาษีเต็มรูป? ขอได้ที่นี่</button>}
      {PROMO_ENABLED && !FREE_LAUNCH && !load("promo_redeemed", false) && purchased.filter(x => x <= 6).length < 3 && <button onClick={() => { save("claim_start_redeem", true); go("claim"); }} style={{ width: "100%", marginTop: 8, padding: "14px 16px", background: `${B.gold}12`, border: `1px dashed ${B.gold}`, borderRadius: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
        <I name="star" size={20} color={B.gold}/>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: B.black }}>ปลดล็อก {PROMO_FREE_MODULES.length} บทฟรีด้วยโค้ดส่วนลด <span style={{ fontWeight: 400, color: B.dkGray }}>— ใช้เวลา 30 วิ</span></div>
        <I name="arrow" size={14} color={B.gold}/>
      </button>}
      {!FREE_LAUNCH && purchased.filter(x => x <= 6).length < 6 && <button onClick={() => go("store")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 8, fontSize: 14 }}>ซื้อเพิ่ม / Full Course ฿{PRICING.full} →</button>}
      {pct === 100 && <button onClick={() => go(load("enrolled", false) ? "certificate" : "register")} style={{ ...css.btn(B.gold, B.black, true), marginTop: 16 }}>{load("enrolled", false) ? (isPreCourseStudent() ? "ดูใบประกาศนียบัตร →" : "ดูใบประกาศนียบัตร & คูปอง →") : "ลงทะเบียนรับใบประกาศนียบัตร →"}</button>}
      {/* Mini cert per module */}
      {progress.done.filter(id => id <= 6).length > 0 && progress.done.filter(id => id <= 6).length < 7 && <button onClick={() => go("minicert")} style={{ ...css.btn(B.white, B.dkGray, true), marginTop: 8, border: `1px solid ${B.ltGray}`, fontSize: 13 }}>ดูใบ Mini Certificate →</button>}
      <div style={{ marginTop: 20 }}><MorrooAdBanner/></div>
      <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?\n\nข้อมูลการเรียนจะถูกล้าง และออกจากระบบบัญชีที่เข้าไว้")) startOverLearner(); }} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 12, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
    </div>
    {progress.done.length >= 4 && <NewsSection openBlog={openBlog} goAll={() => go("blog")} title="บทความ CPR เพิ่มเติม" subtitle={pct === 100 ? "ทักษะ CPR เสื่อมใน 3-6 เดือน — แวะอ่านทบทวนได้ตลอด" : "เก่งมาก! ใกล้จบแล้ว — มีบทความทบทวนให้อ่านเพิ่ม"} cprOnly={true} max={5}/>}
  </div>);
}

// ==================== CERTIFICATE ====================
// ใบประกาศออนไลน์กลางของ JIA (class.jiacpr.com — learning_hub.person_certificates) — ออกให้เมื่อผลสอบปลายภาค
// ที่ grade-quiz ส่งเข้าระบบกลางผ่านเกณฑ์และได้รับรองแล้ว; เป็นใบ "เพิ่ม" ที่ตรวจสอบได้ด้วยลิงก์/QR ของ Hub ส่วนใบของเว็บนี้
// ด้านบนยังเหมือนเดิมทุกอย่าง เรียก RPC ตรงด้วย Supabase session ของเว็บนี้ (โปรเจกต์เดียวกับ Hub) — ไม่มี session
// (ยังไม่ login) หรือ Hub ยังไม่พร้อม ก็ไม่แสดงอะไร
const HUB_URL = "https://class.jiacpr.com";
const HUB_COURSE_ID = "cpr";
// ใบประกาศกลางของ Hub: โหลดสถานะ + "ขอรับอัตโนมัติ" ครั้งเดียวเมื่อมีสิทธิ์ (ผ่านข้อสอบปลายภาคที่ยืนยันตัวตนแล้ว)
// ไม่ต้องรอผู้เรียนกดปุ่มเอง — ใบนี้คือใบที่ตรวจสอบได้จริง (QR บนใบประกาศชี้ไปหน้า verify ของ Hub)
// ขอรับอัตโนมัติไม่สำเร็จ (เช่น โปรไฟล์ Hub ยังไม่ครบ) → การ์ดยังมีปุ่มให้กดขอรับเองพร้อมข้อความ error ตามเดิม
const useHubCertificate = () => {
  const [state, setState] = useState(null); // null | { cert, claimable }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const autoTried = useRef(false);
  const fetchMine = useCallback(async () => {
    try {
      const supa = await getSupabase();
      const { data: { session } } = await supa.auth.getSession();
      if (!session) { setState(null); return null; }
      const { data, error } = await supa.rpc("jia_person_certificates", { action: "mine", payload: {} });
      if (error || !data) { setState(null); return null; }
      const mine = (data.certificates || []).filter((c) => c.courseId === HUB_COURSE_ID);
      const next = {
        cert: mine.find((c) => c.status === "issued") || null,
        // ใบล่าสุดไม่ว่าสถานะไหน (หมดอายุแล้วก็ยังต้องรู้ เพื่อเตือนให้สอบใหม่รับใบใหม่)
        latest: mine.filter((c) => c.expiresAt).sort((a, b) => new Date(b.issuedAt || 0) - new Date(a.issuedAt || 0))[0] || null,
        claimable: (data.claimable || []).some((c) => c.courseId === HUB_COURSE_ID),
      };
      setState(next);
      return next;
    } catch (e) { setState(null); return null; }
  }, []);
  const claim = useCallback(async ({ silent = false } = {}) => {
    setBusy(true); if (!silent) setErr("");
    try {
      const supa = await getSupabase();
      const { error } = await supa.rpc("jia_person_certificates", { action: "claim", payload: { courseId: HUB_COURSE_ID } });
      if (error) { if (!silent) setErr(error.message || "ขอรับใบประกาศไม่สำเร็จ"); }
      else { safeTrack("hub_cert_claimed", { auto: silent }); phCapture("hub_cert_claimed", { auto: silent }); }
      await fetchMine();
    } catch (e) { if (!silent) setErr("ขอรับใบประกาศไม่สำเร็จ ลองใหม่อีกครั้ง"); }
    finally { setBusy(false); }
  }, [fetchMine]);
  useEffect(() => {
    (async () => {
      const s = await fetchMine();
      if (s && !s.cert && s.claimable && !autoTried.current) { autoTried.current = true; await claim({ silent: true }); }
    })();
  }, [fetchMine, claim]);
  return { state, busy, err, claim };
};
const hubVerifyUrl = (cert) => (cert?.verifyPath ? HUB_URL + cert.verifyPath : null);
const thaiDate = (iso) => { try { return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };
// ใบประกาศใกล้หมดอายุ/หมดแล้ว (อิงวันหมดอายุของใบกลางที่ Hub) — ใช้โชว์แถบเตือนต่ออายุ
const CERT_RENEW_WARN_DAYS = 45;
const certRenewState = (cert) => {
  if (!cert?.expiresAt) return null;
  const days = Math.ceil((new Date(cert.expiresAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { expired: true, days };
  if (days <= CERT_RENEW_WARN_DAYS) return { expired: false, days };
  return null;
};

// แถบเตือนใบประกาศใกล้หมดอายุ / หมดอายุแล้ว — หมดแล้วพาไปสอบปลายภาคใหม่ (grade-quiz ส่งผลเข้า Hub → รับใบใหม่อัตโนมัติ)
function RenewBanner({ renew, go }) {
  const retake = () => { save("autostart_final", true); safeTrack("cert_renew_click", { expired: renew.expired }); phCapture("cert_renew_click", { expired: renew.expired }); go("course"); };
  const bg = renew.expired ? `${B.red}10` : `${B.gold}14`, bd = renew.expired ? `${B.red}55` : `${B.gold}66`;
  return <div data-testid="cert-renew-banner" style={{ background: bg, border: `1px solid ${bd}`, borderRadius: 12, padding: "12px 14px", marginTop: 12, fontSize: 13, lineHeight: 1.55, color: B.black }}>
    {renew.expired
      ? <><strong>ใบประกาศของคุณหมดอายุแล้ว</strong> — ทักษะ CPR ลดลงได้เร็วถ้าไม่ได้ทบทวน ทำข้อสอบปลายภาคใหม่ให้ผ่านเพื่อรับใบประกาศฉบับใหม่ (ทบทวนวิดีโอก่อนได้)</>
      : <><strong>ใบประกาศจะหมดอายุในอีก {renew.days} วัน</strong> — ทบทวนวิดีโอไว้ให้พร้อม เมื่อครบกำหนดแล้วทำข้อสอบปลายภาคใหม่เพื่อรับใบฉบับใหม่ (หรือต่อยอดด้วยคอร์สภาคปฏิบัติ On-site)</>}
    <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
      {renew.expired
        ? <button onClick={retake} style={{ ...css.btn(B.red, B.white), padding: "10px 16px", fontSize: 13 }}>ทำข้อสอบปลายภาคใหม่ →</button>
        : <button onClick={() => go("course")} style={{ ...css.btn(B.black, B.white), padding: "10px 16px", fontSize: 13 }}>ทบทวนบทเรียน</button>}
      <button onClick={() => go("booking")} style={{ ...css.btn(B.white, B.black), padding: "10px 16px", fontSize: 13, border: `1px solid ${B.ltGray}` }}>จองคอร์ส On-site</button>
    </div>
  </div>;
}

// หน้าบทเรียน: เรียนจบแล้วเท่านั้น — เตือนต่ออายุ (ถ้าใกล้/เลยกำหนด) + ขอรับใบกลางให้อัตโนมัติแม้ไม่ได้เปิดหน้าใบประกาศ
function CourseCertNotice({ go }) {
  const hub = useHubCertificate();
  const renew = hub.state?.claimable ? null : certRenewState(hub.state?.cert || hub.state?.latest);
  return renew ? <div style={{ marginBottom: 12 }}><RenewBanner renew={renew} go={go}/></div> : null;
}

function HubCertificateCard({ hub }) {
  const { state, busy, err, claim } = hub;
  if (!state || (!state.cert && !state.claimable)) return null;
  const box = { display: "block", background: `${B.green}14`, border: `1px solid ${B.green}66`, borderRadius: 12, padding: "12px 14px", marginTop: 12, color: B.black, textDecoration: "none", fontSize: 12.5, lineHeight: 1.5 };
  if (state.cert) {
    const c = state.cert;
    const exp = c.expiresAt ? thaiDate(c.expiresAt) : "";
    return <a href={hubVerifyUrl(c)} target="_blank" rel="noreferrer" style={box} data-testid="hub-certificate">
      <strong>ใบประกาศออนไลน์กลาง JIA</strong> · เลขที่ <span style={{ fontFamily: "monospace" }}>{c.number}</span>{exp ? ` · ใช้ได้ถึง ${exp}` : ""}
      <br/>นายจ้าง/HR สแกน QR บนใบประกาศ หรือเปิดลิงก์นี้เพื่อตรวจสอบได้ทันที
      <br/><span style={{ fontWeight: 700 }}>ตรวจสอบ / เปิดใบที่ class.jiacpr.com ↗</span>
    </a>;
  }
  return <div style={box} data-testid="hub-certificate-claim">
    <strong>ผ่านข้อสอบปลายภาคแล้ว</strong> — รับใบประกาศออนไลน์กลางของ JIA (ตรวจสอบได้ด้วย QR) ชื่อบนใบมาจากบัตรนักเรียน JIA ของคุณ
    <div style={{ marginTop: 8 }}><button onClick={() => claim()} disabled={busy} style={{ background: B.green, color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>{busy ? "กำลังขอรับ…" : "ขอรับใบประกาศกลาง"}</button></div>
    {err && <div style={{ color: "#b3261e", marginTop: 6 }}>{err}</div>}
  </div>;
}

// QR ตรวจสอบใบประกาศ (SVG) — สร้างฝั่ง client จากลิงก์ verify ของ Hub
function VerifyQR({ url, size = 84 }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    if (!url) return;
    let alive = true;
    import("qrcode").then((mod) => (mod.default || mod).toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" })).then((s) => { if (alive) setSvg(s); }).catch(() => {});
    return () => { alive = false; };
  }, [url]);
  if (!svg) return null;
  return <div style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: svg.replace("<svg", `<svg width="${size}" height="${size}"`) }}/>;
}

// ==================== REFERRAL CARD (ชวนเพื่อน) ====================
// ต้องมี customer_id + เบอร์ (สมัครแล้ว) — server ยืนยันความเป็นเจ้าของแล้วคืนโค้ดเดิม/สร้างใหม่ + ยอดเพื่อนที่สมัคร/ซื้อ
function ReferralCard({ user, compact = false }) {
  const u = user || load("user", null);
  const [info, setInfo] = useState(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!u?.customer_id || !u?.phone) return;
    supaRpc("referral_my_code", { p_customer_id: u.customer_id, p_phone: u.phone }).then((d) => {
      if (d?.code) { save("my_ref_code", d.code); setInfo(d); }
    });
  }, [u?.customer_id, u?.phone]);
  if (!info) return null;
  const link = referralLink(info.code);
  const text = `มาเรียน CPR & AED ออนไลน์ด้วยกัน ช่วยชีวิตคนใกล้ตัวได้จริง 💪 เข้าลิงก์นี้ได้ส่วนลด ${REFERRAL_DISCOUNT_PCT}% ตอนซื้อคอร์ส`;
  const share = async () => {
    safeTrack("referral_share", { code: info.code }); phCapture("referral_share", { code: info.code });
    try { if (navigator.share) { await navigator.share({ title: "JIA CPR Online", text, url: link }); return; } } catch (e) { if (e?.name === "AbortError") return; }
    window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text), "_blank");
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} };
  return <div data-testid="referral-card" style={{ background: `${B.gold}10`, border: `1px solid ${B.gold}55`, borderRadius: 16, padding: compact ? 14 : 18, marginTop: 14 }}>
    <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>🎁 ชวนเพื่อนเรียน CPR</div>
    <div style={{ fontSize: 12.5, color: B.dkGray, lineHeight: 1.6 }}>เพื่อนที่เข้าผ่านลิงก์ของคุณได้ส่วนลด <strong style={{ color: B.black }}>{REFERRAL_DISCOUNT_PCT}%</strong> ตอนซื้อคอร์ส · {REFERRAL_REWARD_TEXT}</div>
    <div style={{ display: "flex", gap: 8, alignItems: "center", background: B.white, border: `1px solid ${B.ltGray}`, borderRadius: 10, padding: "8px 10px", marginTop: 10 }}>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link.replace(/^https:\/\//, "")}</span>
      <button onClick={copy} style={{ background: B.gray, border: "none", borderRadius: 8, padding: "6px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>{copied ? "คัดลอกแล้ว" : "คัดลอก"}</button>
    </div>
    <button onClick={share} style={{ ...css.btn("#06C755", B.white, true), marginTop: 10, padding: "12px 20px", fontSize: 14 }}>แชร์ลิงก์ให้เพื่อน</button>
    <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, fontSize: 12, color: B.dkGray, textAlign: "center" }}>
      <div><div style={{ fontSize: 18, fontWeight: 800, color: B.black }}>{info.signups || 0}</div>เพื่อนสมัคร</div>
      <div><div style={{ fontSize: 18, fontWeight: 800, color: B.black }}>{info.purchases || 0}</div>เพื่อนซื้อคอร์ส</div>
    </div>
  </div>;
}

function Certificate({ user, go }) {
  const hub = useHubCertificate();
  const hubCert = hub.state?.cert || null;
  const verifyUrl = hubVerifyUrl(hubCert);
  // ต่ออายุ: Hub ออกใบใหม่ให้ได้เมื่อใบเดิมหมดอายุแล้ว + สอบปลายภาคผ่านใหม่ (ใบที่ยังไม่หมดอายุ claim ซ้ำจะได้ใบเดิม)
  const renew = hub.state?.claimable ? null : certRenewState(hubCert || hub.state?.latest);
  // มีใบกลางแล้ว → ใช้วันที่ออกใบจริงของ Hub (เดิมโชว์ "วันนี้" ทุกครั้งที่เปิดหน้า)
  const d = hubCert?.issuedAt ? new Date(hubCert.issuedAt) : new Date(); const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  // นักเรียน pre-course จ่ายค่าคอร์ส on-site เต็มราคาแล้ว — ใบประกาศต้องไม่โชว์ "ส่วนลด ฿100"
  // (เคยโชว์ให้ทุกคน ทำให้นักเรียนกลุ่มนี้เข้าใจว่ามีส่วนลดค้าง แล้วมาขอเงินคืน)
  const preCourseStudent = isPreCourseStudent();
  // ปกติควรมีคูปองจากตอนสมัคร/จบคอร์สอยู่แล้ว (Register/submitQuiz) — ถ้ายังไม่มี ออกผ่าน RPC ฝั่งเซิร์ฟเวอร์
  // แทนการสุ่มโค้ดฝั่ง client เอง ไม่งั้นใบเซอร์จะโชว์โค้ดที่พนักงาน validate ไม่ได้ (ไม่มีในฐานข้อมูลจริง)
  const [coupon, setCoupon] = useState(() => (preCourseStudent ? null : load("coupon", null)));
  useEffect(() => {
    if (preCourseStudent || coupon) return;
    const u = user || load("user", null);
    if (!u?.customer_id) return;
    issueOnlineCoupon(u.customer_id, u.phone).then(c => { if (c) { save("coupon", c); setCoupon(c); } });
  }, [preCourseStudent, coupon]);
  const certRef = useRef(null);
  const [gen, setGen] = useState(null); // null | "img" | "pdf"
  const fileBase = `JIA_Certificate_${sanitizeFileName(user?.name)}`;
  // ===== Strong-soft LINE gate =====
  const lc = getLinkCode();
  const [lineLinked, setLineLinked] = useState(() => load("line_linked", false));
  const [linkWaiting, setLinkWaiting] = useState(false);
  const pollRef = useRef(null);
  // fallback สุดท้าย ถ้าสร้างไฟล์ไม่สำเร็จ — บอกผู้ใช้ screenshot เอง
  const saveCertFallback = () => { alert("บันทึกอัตโนมัติไม่สำเร็จ กรุณา screenshot หน้าจอเพื่อบันทึกใบประกาศนียบัตร\n\niPhone: กดปุ่ม Power + Volume Up\nAndroid: กดปุ่ม Power + Volume Down" + (coupon ? "\n\nรหัสคูปอง: " + coupon : "")); };
  const downloadImage = async () => {
    if (gen) return; setGen("img");
    try {
      const dataUrl = await captureNodeToPng(certRef.current);
      await deliverBlob(await dataUrlToBlob(dataUrl), `${fileBase}.png`, "image/png");
      safeTrack("cert_download", { format: "png" });
    } catch (e) { safeTrack("cert_download_error", { format: "png" }); saveCertFallback(); }
    finally { setGen(null); }
  };
  const downloadPDF = async () => {
    if (gen) return; setGen("pdf");
    try {
      const dataUrl = await captureNodeToPng(certRef.current);
      const { jsPDF } = await import("jspdf");
      const img = new Image();
      await new Promise((res, rej) => { img.onload = res; img.onerror = rej; setTimeout(() => rej(new Error("img timeout")), 8000); img.src = dataUrl; });
      const pr = Math.max(2, window.devicePixelRatio || 1);
      const wMm = (img.width / pr) * 25.4 / 96, hMm = (img.height / pr) * 25.4 / 96;
      const pdf = new jsPDF({ orientation: wMm >= hMm ? "landscape" : "portrait", unit: "mm", format: [wMm, hMm] });
      pdf.addImage(dataUrl, "PNG", 0, 0, wMm, hMm, undefined, "FAST");
      await deliverBlob(pdf.output("blob"), `${fileBase}.pdf`, "application/pdf");
      safeTrack("cert_download", { format: "pdf" });
    } catch (e) { safeTrack("cert_download_error", { format: "pdf" }); saveCertFallback(); }
    finally { setGen(null); }
  };
  const CERT_W = 900, CERT_H = 636;
  const wrapRef = useRef(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const update = () => setScale(Math.min(1, el.clientWidth / CERT_W));
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);
  // เปิด LINE พร้อมโค้ด แล้ว poll หา line_user_id ที่ webhook เขียนกลับมา = ยืนยันการผูกจริง
  const startLineLink = () => {
    safeTrack("line_oa_clicked", { variant: "certificate", has_link_code: true }); phCapture("line_oa_clicked", { variant: "certificate", has_link_code: true });
    const u = user || load("user", null);
    const tail = u?.phone ? u.phone.replace(/\D/g, "").slice(-9) : null;
    // ผูกโค้ดนี้กับเรคคอร์ดลูกค้า เพื่อให้ webhook จับคู่ได้แน่นอน (ผ่าน RPC — ไม่แตะตาราง customers ตรง)
    if (tail) setCustomerLineLink(u, lc);
    setLinkWaiting(true);
    if (pollRef.current) clearInterval(pollRef.current);
    let tries = 0;
    pollRef.current = setInterval(async () => {
      tries++;
      if (tail) {
        // ต้องรู้ทั้งเบอร์ + โค้ดผูก (อยู่ในเครื่องนี้เท่านั้น) — ไม่อ่านตาราง customers ด้วย anon key อีกต่อไป
        if (await supaRpc("customer_line_linked", { p_phone: u.phone, p_code: lc }) === true) {
          clearInterval(pollRef.current); pollRef.current = null;
          save("line_linked", true); save("line_added", true);
          setLineLinked(true); setLinkWaiting(false);
          safeTrack("line_oa_linked", { variant: "certificate" }); phCapture("line_oa_linked", { variant: "certificate" });
          return;
        }
      }
      if (tries >= 40) { clearInterval(pollRef.current); pollRef.current = null; setLinkWaiting(false); }
    }, 3000);
  };
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <div style={{ textAlign: "center", marginBottom: 24 }}><div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.gold}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}><I name="star" size={38} color={B.gold}/></div><h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>ยินดีด้วย!</h2><p style={{ fontSize: 14, color: B.dkGray }}>คุณผ่านคอร์ส CPR & AED ออนไลน์แล้ว</p></div>
    <div ref={wrapRef} style={{ width: "100%", height: CERT_H * scale, overflow: "hidden", borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,.12)" }}>
      <div style={{ width: CERT_W, height: CERT_H, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <div ref={certRef} style={{ position: "relative", width: CERT_W, height: CERT_H, boxSizing: "border-box", background: "#FFFDF7", overflow: "hidden", fontFamily: SERIF }}>
          <div style={{ position: "absolute", inset: 0 }} dangerouslySetInnerHTML={{ __html: CERT_DECO }}/>
          <div style={{ position: "absolute", top: 36, left: 0, right: 0, display: "flex", justifyContent: "center" }}><Logo size={180}/></div>
          <div style={{ position: "absolute", top: 196, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 44, fontWeight: 700, lineHeight: 1, letterSpacing: 1, color: "#0E1E3C" }}>ใบประกาศนียบัตร</div>
          <div style={{ position: "absolute", top: 252, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 13, fontWeight: 700, letterSpacing: 5, color: "#B8862F" }}>CERTIFICATE OF COMPLETION</div>
          <div style={{ position: "absolute", top: 288, left: 0, right: 0, textAlign: "center", fontSize: 15, lineHeight: 1, color: B.dkGray }}>ขอมอบใบประกาศนียบัตรฉบับนี้เพื่อแสดงว่า</div>
          <div style={{ position: "absolute", top: 318, left: 0, right: 0, textAlign: "center", fontFamily: SERIF, fontSize: 46, fontWeight: 700, lineHeight: 1, color: "#0E1E3C" }}>{user?.name || "ชื่อผู้เรียน"}</div>
          <div style={{ position: "absolute", top: 392, left: 70, right: 70, textAlign: "center", fontSize: 14, color: B.dkGray }}>ได้ผ่านการอบรม <strong style={{ color: "#0E1E3C" }}>ภาคทฤษฎี (ออนไลน์)</strong></div>
          <div style={{ position: "absolute", top: 412, left: 70, right: 70, textAlign: "center", fontSize: 14, fontWeight: 700, color: B.black }}>หลักสูตรการช่วยชีวิตขั้นพื้นฐาน CPR &amp; AED · มาตรฐาน 2025</div>
          <div style={{ position: "absolute", top: 436, left: 0, right: 0, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: B.red }}>ขอเชิญฝึกภาคปฏิบัติกับผู้สอนตัวจริง เพื่อช่วยชีวิตได้อย่างมั่นใจ</div>
          {coupon ? (<>
            <div style={{ position: "absolute", top: 484, left: 0, right: 0, textAlign: "center", fontSize: 12.5, fontWeight: 600, color: "#FFF9E8" }}>ส่วนลด ฿100 คอร์ส On-site</div>
            <div style={{ position: "absolute", top: 506, left: 0, right: 0, textAlign: "center", fontSize: 15, fontWeight: 800, letterSpacing: 1, color: "#F3DB8E", fontFamily: "monospace" }}>• {coupon} •</div>
          </>) : (
            <div style={{ position: "absolute", top: 495, left: 0, right: 0, textAlign: "center", fontSize: 13, fontWeight: 700, color: "#FFF9E8" }}>แสดงใบประกาศนี้กับเจ้าหน้าที่ในวันอบรมภาคปฏิบัติ</div>
          )}
          <div style={{ position: "absolute", top: 542, left: 64, width: 216, textAlign: "center", background: "#FFFDF7", border: "1px solid rgba(196,154,72,.55)", borderRadius: 10, padding: "5px 6px", boxSizing: "border-box" }}>
            <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.25, color: B.black }}>{ds}</div>
            <div style={{ borderTop: "1.5px solid #C49A48", marginTop: 4, paddingTop: 4, fontSize: 11.5, lineHeight: 1.25, color: B.dkGray }}>วันที่ออกใบประกาศ</div>
          </div>
          <div style={{ position: "absolute", top: 542, right: 64, width: 216, textAlign: "center", background: "#FFFDF7", border: "1px solid rgba(196,154,72,.55)", borderRadius: 10, padding: "5px 6px", boxSizing: "border-box" }}>
            <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, lineHeight: 1.25, color: "#0E1E3C" }}>JIA TRAINER CENTER</div>
            <div style={{ borderTop: "1.5px solid #C49A48", marginTop: 4, paddingTop: 4, fontSize: 11.5, lineHeight: 1.25, color: B.dkGray }}>ศูนย์ฝึกอบรม CPR &amp; AED</div>
          </div>
          <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center", fontSize: 10.5, letterSpacing: .5, color: "#8A7A55" }}>088-558-8078 | cpr.morroo.com | LINE: @jiacpr</div>
          {verifyUrl && <div data-testid="cert-verify-qr" style={{ position: "absolute", top: 44, right: 58, width: 112, textAlign: "center", background: "#FFFDF7", border: "1px solid rgba(196,154,72,.55)", borderRadius: 10, padding: "8px 6px 6px", boxSizing: "border-box" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><VerifyQR url={verifyUrl} size={84}/></div>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0E1E3C", marginTop: 4, lineHeight: 1.2 }}>สแกนตรวจสอบใบประกาศ</div>
            <div style={{ fontSize: 9.5, color: B.dkGray, fontFamily: "monospace", lineHeight: 1.3 }}>{hubCert.number}</div>
            {hubCert.expiresAt && <div style={{ fontSize: 9.5, color: B.dkGray, lineHeight: 1.3 }}>ใช้ได้ถึง {thaiDate(hubCert.expiresAt)}</div>}
          </div>}
        </div>
      </div>
    </div>
    {/* คูปองพาร์ทเนอร์ (QR ธุรกิจพันธมิตร) — ขอบคุณผู้มอบคอร์สนี้ + ให้ช่องทางติดต่อกลับ (ไม่แตะรูปใบประกาศ) */}
    {getPartnerSponsor() && <div style={{ marginTop: 16 }}><PartnerContactCard sponsor={getPartnerSponsor()} where="certificate" title={`ขอบคุณ ${getPartnerSponsor().company} ผู้มอบคอร์สนี้ให้คุณ`}/></div>}
    {/* ใบประกาศออนไลน์กลาง JIA (ตรวจสอบได้ที่ Hub) — เพิ่มจากใบของเว็บนี้ ไม่แทน */}
    {renew && <RenewBanner renew={renew} go={go}/>}
    <HubCertificateCard hub={hub}/>
    <div style={{ marginTop: 16 }}><AccountCard user={user}/></div>
    {/* บัตรนักเรียน JIA กลาง (class.jiacpr.com) — มีเมื่อล็อกอิน LINE/อีเมลจริงแล้วเท่านั้น ใบเก่ายังใช้ได้ปกติ */}
    {user?.hub?.cardNo && <a href="https://class.jiacpr.com/card" target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: B.gray, borderRadius: 12, padding: "12px 14px", marginTop: 12, textDecoration: "none", color: B.black }}>
      <span style={{ fontSize: 12.5 }}>บัตรนักเรียน JIA: <strong style={{ fontFamily: "monospace" }}>{user.hub.cardNo}</strong>{user.hub.verifyLevel === "instructor" ? " · ยืนยันตัวตนแล้ว ✓" : ""}</span>
      <span style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>ดูบัตร →</span>
    </a>}
    {/* ===== LINE invite (โปรโมชัน ไม่บล็อกการดาวน์โหลด) ===== */}
    {lineLinked ? (
      <div style={{ background: `${B.green}14`, border: `1px solid ${B.green}66`, borderRadius: 12, padding: "12px 14px", marginTop: 16, textAlign: "center", fontSize: 14, fontWeight: 700, color: B.black }}>
        ✓ ผูก LINE @jiacpr เรียบร้อย — จะได้รับใบเซอร์ เตือนทบทวน และโปรทาง LINE
      </div>
    ) : (
      <div style={{ background: "#06C75510", border: "2px solid #06C75540", borderRadius: 16, padding: 18, marginTop: 16, textAlign: "center" }}>
        <I name="line" size={32} color="#06C755"/>
        <div style={{ fontSize: 16, fontWeight: 800, color: B.black, margin: "8px 0 4px" }}>{coupon ? "ผูก LINE @jiacpr รับคูปอง + เตือนทบทวน" : "ผูก LINE @jiacpr รับใบเซอร์ + เตือนทบทวน"}</div>
        <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 12, lineHeight: 1.6 }}>แอดแล้วผูกบัญชี รับเพิ่ม: {coupon ? "คูปองส่วนลด on-site ฿100 · " : ""}ใบประกาศทาง LINE · เตือนทบทวน CPR ทุก 3 เดือน</div>
        <a href={lineLinkDeepLink(lc)} onClick={startLineLink} target="_blank" rel="noopener noreferrer"
           style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}>
          <I name="line" size={22} color={B.white}/> {coupon ? "ผูก LINE รับคูปอง + ใบเซอร์" : "ผูก LINE รับใบเซอร์"}
        </a>
        <div style={{ fontSize: 11, color: B.dkGray, marginTop: 8, lineHeight: 1.5 }}>
          (LINE จะเด้งข้อความพร้อมโค้ด <strong style={{ fontFamily: "monospace", color: B.red }}>JIA-LINK-{lc}</strong> + ข้อความนัดเรียนภาคปฏิบัติ → <strong>กดส่ง</strong> ในแชต @jiacpr = ผูกบัญชีอัตโนมัติ)
        </div>
        {linkWaiting && (
          <div style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: "#06A047" }}>⏳ กำลังรอการยืนยัน... กดส่งข้อความในแอป LINE แล้วรอสักครู่</div>
        )}
      </div>
    )}

    {/* ดาวน์โหลด + คูปอง: แสดงเสมอ ไม่ต้องผูก/ข้าม LINE ก่อน */}
    {(<>
      <button onClick={downloadImage} disabled={!!gen} style={{ ...css.btn(B.black, B.white, true), marginTop: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: gen ? .6 : 1, cursor: gen ? "default" : "pointer" }}><I name="save" size={18} color={B.white}/> {gen === "img" ? "กำลังสร้างรูป..." : "บันทึกเป็นรูปภาพ"}</button>
      <button onClick={downloadPDF} disabled={!!gen} style={{ ...css.btn(B.white, B.black, true), marginTop: 10, border: `1px solid ${B.ltGray}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: gen ? .6 : 1, cursor: gen ? "default" : "pointer" }}><I name="cert" size={18} color={B.black}/> {gen === "pdf" ? "กำลังสร้าง PDF..." : "ดาวน์โหลด PDF"}</button>
      {coupon ? (
      <div style={{ background: `${B.red}08`, borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: B.red, marginBottom: 4 }}>คูปองส่วนลด ฿100 สำหรับคอร์ส On-site!</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: B.red, letterSpacing: 3, fontFamily: "monospace", marginBottom: 12 }}>{coupon}</div>
        <button onClick={() => go("booking")} style={{ ...css.btn(B.red, B.white, true), display: "block", width: "100%", textAlign: "center", cursor: "pointer" }}>จองคอร์ส On-site ใช้คูปองส่วนลด →</button>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={() => { safeTrack("line_oa_clicked", { variant: "certificate-inquire" }); phCapture("line_oa_clicked", { variant: "certificate-inquire" }); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10, background: "#06C755", borderRadius: 12, padding: "12px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={22} color={B.white}/> สอบถามทาง LINE @jiacpr</a>
      </div>
      ) : (
      <div style={{ background: `${B.green}0C`, borderRadius: 16, padding: 20, marginTop: 16, textAlign: "center" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: B.black, marginBottom: 4 }}>ชำระค่าคอร์สภาคปฏิบัติเรียบร้อยแล้ว ✅</div>
        <div style={{ fontSize: 13, color: B.dkGray, lineHeight: 1.6, marginBottom: 12 }}>พร้อมเข้าอบรมภาคปฏิบัติได้เลย — แสดงใบประกาศนี้กับเจ้าหน้าที่ในวันเรียน</div>
        <a href={LINE_URL} target="_blank" rel="noopener noreferrer" onClick={() => { safeTrack("line_oa_clicked", { variant: "certificate-inquire" }); phCapture("line_oa_clicked", { variant: "certificate-inquire" }); }} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#06C755", borderRadius: 12, padding: "12px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 14 }}><I name="line" size={22} color={B.white}/> สอบถามวันอบรมทาง LINE @jiacpr</a>
      </div>
      )}
    </>)}
    {/* ชวนเพื่อน (มีโค้ดของตัวเอง) — ยังสมัครไม่ครบ (ไม่มี customer_id) ใช้ปุ่มแชร์แบบเดิม */}
    {(user?.customer_id && user?.phone) ? <ReferralCard user={user}/> : <button onClick={() => { const txt = "ฉันผ่านคอร์ส CPR & AED ออนไลน์แล้ว! เรียนฟรีที่ cpr.morroo.com"; if (navigator.share) navigator.share({ title: "JIA CPR Online", text: txt, url: "https://cpr.morroo.com" }); else window.open("https://social-plugins.line.me/lineit/share?url=" + encodeURIComponent("https://cpr.morroo.com") + "&text=" + encodeURIComponent(txt), "_blank"); }} style={{ ...css.btn("#06C755", B.white, true), marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>แชร์ให้เพื่อนเรียนด้วย</button>}
    <ReviewForm user={user}/>
    <div style={{ marginTop: 20 }}><MorrooAdBanner/></div>
    <button onClick={() => go("course")} style={{ ...css.btn(B.white, B.black, true), marginTop: 10, border: `1px solid ${B.ltGray}` }}>← กลับหน้าบทเรียน</button>
    <button onClick={() => { if(confirm("ต้องการเริ่มใหม่ / เปลี่ยนคนเรียน?")) startOverLearner(); }} style={{ ...css.btn(B.gray, B.dkGray, true), marginTop: 8, fontSize: 13 }}>เริ่มใหม่ / เปลี่ยนคนเรียน</button>
  </div></div>);
}

// ==================== MINI CERTIFICATE ====================
function MiniCert({ user, go }) {
  const progress = load("progress", { done: [], scores: {} });
  const d = new Date(); const ds = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543}`;
  const completed = COURSE.modules.filter(m => m.id <= 6 && progress.done.includes(m.id));
  const refs = useRef({});
  const [genId, setGenId] = useState(null);
  const saveMiniImage = async (m) => {
    if (genId) return; setGenId(m.id);
    try {
      const dataUrl = await captureNodeToPng(refs.current[m.id]);
      await deliverBlob(await dataUrlToBlob(dataUrl), `JIA_${sanitizeFileName(m.short)}_${sanitizeFileName(user?.name)}.png`, "image/png");
      safeTrack("minicert_download", { module: m.id });
    } catch (e) { safeTrack("minicert_download_error", { module: m.id }); alert("บันทึกอัตโนมัติไม่สำเร็จ กรุณา screenshot หน้าจอเพื่อบันทึกใบประกาศ"); }
    finally { setGenId(null); }
  };
  return (<div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
    <button onClick={() => go("course")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: B.dkGray, fontSize: 14, marginBottom: 16 }}><I name="back" size={18} color={B.dkGray}/> กลับ</button>
    <h2 style={{ fontSize: 20, fontWeight: 800, textAlign: "center", marginBottom: 20 }}>Mini Certificate</h2>
    {completed.map(m => (
      <div key={m.id} style={{ marginBottom: 20 }}>
        <div style={{ background: B.white, borderRadius: 16, padding: 4, boxShadow: "0 4px 16px rgba(0,0,0,.08)" }}>
          <div ref={el => { refs.current[m.id] = el; }} style={{ position: "relative", border: `2px solid ${B.gold}`, borderRadius: 12, padding: "24px 16px", textAlign: "center", background: "linear-gradient(180deg, #FFFEF7 0%, #FFFFFF 100%)" }}>
            <div style={{ marginBottom: 8 }}><Logo size={64}/></div>
            <div style={{ fontSize: 14, fontWeight: 300, color: B.dkGray }}>Mini Certificate</div>
            <div style={{ fontSize: 16, fontWeight: 700, margin: "6px 0", color: B.black }}>{m.short}</div>
            <div style={{ fontSize: 12, color: B.dkGray, marginBottom: 6 }}>มอบให้แก่</div>
            <div style={{ fontFamily: SERIF, fontSize: 20, fontWeight: 600, lineHeight: 1.5, color: B.black, marginBottom: 8 }}>{user?.name || "ชื่อผู้เรียน"}</div>
            <div style={{ fontSize: 11, color: B.dkGray }}>คะแนน: {progress.scores[m.id]}% • วันที่ {ds}</div>
          </div>
        </div>
        <button onClick={() => saveMiniImage(m)} disabled={!!genId} style={{ ...css.btn(B.white, B.black, true), marginTop: 8, fontSize: 13, border: `1px solid ${B.ltGray}`, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: genId ? .6 : 1, cursor: genId ? "default" : "pointer" }}><I name="save" size={16} color={B.black}/> {genId === m.id ? "กำลังสร้างรูป..." : "บันทึกเป็นรูปภาพ"}</button>
      </div>
    ))}
    {completed.length === 0 && <div style={{ textAlign: "center", color: B.dkGray, padding: 20 }}>ยังไม่มีหัวข้อที่ผ่าน</div>}
  </div></div>);
}

// ==================== BOOKING ====================

function Booking({ go }) {
  // คูปองหมดอายุแล้ว (โค้ดจากเกมช่วงงาน) → ไม่ใช้เป็นส่วนลด; คูปองจากสมัคร (ไม่มีวันหมดอายุ) ใช้ได้ปกติ
  const rawCoupon = load("coupon", null);
  const couponExp = load("coupon_expires", null);
  const coupon = (rawCoupon && (!couponExp || todayISOTH() <= couponExp)) ? rawCoupon : null;
  const user = load("user", null);
  // จองผ่านเซลล์เป็นหลัก: ไม่ให้เลือกวันคลาสเอง (วันจริงนัด/จองผ่านช่องทางอื่น ระบบนี้ไม่ใช่แหล่งวันว่าง)
  // เก็บเป็น lead + คูปอง → เซลล์ติดต่อกลับนัดวัน+แจ้งชำระเงิน
  const [form, setForm] = useState({ name: user?.name || "", phone: user?.phone || "", people: "1", prefTime: "", note: coupon ? `คูปองออนไลน์ ${coupon}` : "" });
  const [step, setStep] = useState("form"); // form → done
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState(null);

  // รอบเรียน B-CPR ที่เปิดจองจริง — class.jiacpr.com (Hub) เป็นระบบจองกลางแล้ว (แทน class.morroo.com เดิม)
  // ดึงผ่าน public catalog API (ไม่ต้องใช้ key, เปิด CORS ให้ทุกโดเมน) — โชว์เป็นข้อมูล + ลิงก์ไปจองพร้อมจ่ายที่ hub
  // ดึงไม่ได้/ไม่มีรอบว่าง = ไม่โชว์บล็อกนี้ lead form เดิมทำงานตามปกติ
  const [hubRounds, setHubRounds] = useState(null);
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    fetch("https://class.jiacpr.com/api/public/catalog", { signal: ctrl.signal })
      .then(r => r.json()).then(d => {
        if (Array.isArray(d?.rounds)) {
          const open = d.rounds.filter(r => r.courseId === "bcpr" && r.seatsLeft > 0).slice(0, 3);
          if (open.length) setHubRounds(open);
        }
      }).catch(() => {}).finally(() => clearTimeout(timer));
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);
  // ISO datetime (UTC) → "22 ส.ค. 69 · 09:00 น." เวลาไทย (UTC+7) — คำนวณ offset เองแบบเดียวกับ todayISOTH()
  // แทนที่จะพึ่ง timezone ของเบราว์เซอร์ผู้ใช้
  const thRoundTime = (iso) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return String(iso || "");
    const t = new Date(d.getTime() + 7 * 3600 * 1000);
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const hh = String(t.getUTCHours()).padStart(2, "0"); const mm = String(t.getUTCMinutes()).padStart(2, "0");
    return `${t.getUTCDate()} ${months[t.getUTCMonth()]} ${(t.getUTCFullYear() + 543) % 100} · ${hh}:${mm} น.`;
  };
  const bcprBookingUrl = `https://class.jiacpr.com/courses/bcpr?${coupon ? `coupon=${encodeURIComponent(coupon)}&` : ""}utm_source=cpr-online`;
  const F = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const inp = { width: "100%", padding: "12px 14px", borderRadius: 10, border: `1px solid ${B.ltGray}`, fontSize: 15, boxSizing: "border-box", outline: "none" };
  const lbl = { fontSize: 13, fontWeight: 600, color: B.black, marginBottom: 6, display: "block" };
  const price = coupon ? 400 : 500;

  const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  const today = () => new Date().toISOString().slice(0, 10);

  // จอง → สร้าง lead ใน bookings (ไม่มีวันคลาส) สถานะ "รอเซลล์ติดต่อ" ให้ทีมขายนัดวัน+แจ้งชำระเงิน
  const submit = async () => {
    if (!form.name || !form.phone) { alert("กรุณากรอกชื่อและเบอร์โทร"); return; }
    setSubmitting(true);
    try {
      const custId = uid();
      const phone = form.phone.replace(/\D/g, "");
      await supaRest("customers", "POST", { id: custId, name: form.name, tel: phone, email: "", created_at: today(), source: "online-course" });

      const bkId = uid();
      const noteParts = [form.prefTime ? `สะดวก: ${form.prefTime}` : "", form.note || ""].filter(Boolean);
      const booking = await supaRest("bookings", "POST", { id: bkId, customer_id: custId, name: form.name, tel: phone, course_type: "joincourse", course_name: "CPR & AED (On-site)", channel: "online-course", total_people: parseInt(form.people) || 1, final_price: price, discount_code: coupon || "", discount_amount: coupon ? 100 : 0, payment_mode: "", payment_status: "รอเซลล์ติดต่อ (นัดวัน)", time_slot: form.prefTime || "", total_days: 1, note: noteParts.join(" | "), pdpa_consent: true, pdpa_consent_date: today(), created_at: new Date().toISOString() });
      console.log("📢 Booking lead:", booking);

      setBookingRef(bkId);
      setStep("done");
    } catch (e) {
      console.log("Booking error:", e);
      alert("เกิดข้อผิดพลาด กรุณาลองใหม่หรือจองผ่าน LINE");
    }
    setSubmitting(false);
  };

  // ===== Done: รับคำขอแล้ว เซลล์จะติดต่อกลับนัดวัน+แจ้งชำระเงิน =====
  if (step === "done") return (
    <div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto", textAlign: "center", paddingTop: 60 }}>
      <div style={{ width: 76, height: 76, borderRadius: "50%", background: `${B.green}18`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}><I name="check" size={38} color={B.green}/></div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>รับคำขอจองแล้ว!</h2>
      <p style={{ fontSize: 14, color: B.dkGray, lineHeight: 1.6 }}>ทีมงาน JIA จะติดต่อกลับเพื่อ<strong style={{ color: B.black }}>นัดวันเรียนและแจ้งวิธีชำระเงิน</strong><br/>โดยเร็วที่สุด (ในเวลาทำการ)</p>
      {coupon && <div style={{ background: `${B.gold}12`, borderRadius: 12, padding: 14, marginTop: 16, fontSize: 14 }}>เก็บรหัสคูปองไว้แจ้งทีมงาน<br/><strong style={{ color: B.red, fontFamily: "monospace", letterSpacing: 1 }}>{coupon}</strong> <span style={{ color: B.dkGray, fontSize: 13 }}>(ส่วนลด ฿100)</span></div>}
      <div style={{ fontSize: 13, color: B.dkGray, marginTop: 16 }}>อยากนัดวันเร็วขึ้น? ทักไลน์ได้เลย</div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 10, marginTop: 8, background: "#06C755", borderRadius: 12, padding: "14px 28px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> ทักนัดวันทาง LINE @jiacpr</a>
      <div><button onClick={() => go("course")} style={{ ...css.btn(B.white, B.black, true), marginTop: 14, border: `1px solid ${B.ltGray}` }}>← กลับหน้าบทเรียน</button></div>
    </div></div>
  );

  return (
    <div style={{ ...css.page, padding: 20 }}><div style={{ maxWidth: 480, margin: "0 auto" }}>
      <button onClick={() => go(load("enrolled", false) ? "certificate" : "landing")} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, color: B.dkGray, fontSize: 14, marginBottom: 16 }}><I name="back" size={18} color={B.dkGray}/> กลับ</button>

      <div style={{ textAlign: "center", marginBottom: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: `${B.red}12`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}><I name="cert" size={32} color={B.red}/></div>
        <h2 style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>จองคอร์ส On-site</h2>
        <p style={{ fontSize: 14, color: B.dkGray }}>CPR & AED มาตรฐาน 2025 | ทีมงานติดต่อนัดวันให้</p>
      </div>

      {/* Info cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
        {[
          { icon: "clock", t: "2 ชั่วโมง", s: "ต่อรอบ" },
          { icon: "star", t: coupon ? "฿400" : "฿500", s: coupon ? "ลดแล้ว ฿100" : "ต่อท่าน" },
          { icon: "book", t: "ใบรับรอง", s: "มาตรฐาน 2025" },
          { icon: "heart", t: "ฝึกจริง", s: "หุ่น CPR + AED" },
        ].map((c, i) => (
          <div key={i} style={{ background: B.white, borderRadius: 12, padding: 14, textAlign: "center", boxShadow: "0 1px 4px rgba(0,0,0,.05)" }}>
            <I name={c.icon} size={20} color={B.red}/><div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{c.t}</div><div style={{ fontSize: 11, color: B.dkGray }}>{c.s}</div>
          </div>
        ))}
      </div>

      {coupon && <div style={{ background: `${B.green}10`, borderRadius: 12, padding: "12px 16px", marginBottom: 20, display: "flex", alignItems: "center", gap: 10, border: `1px solid ${B.green}30` }}>
        <I name="check" size={20} color={B.green}/><div><div style={{ fontSize: 13, fontWeight: 700, color: B.green }}>คูปองส่วนลด ฿100 ถูกใช้แล้ว!</div><div style={{ fontSize: 12, color: B.dkGray }}>รหัส: {coupon} • ราคาจาก ฿500 เหลือ ฿400</div></div>
      </div>}

      {/* รอบที่เปิดรับจริงจากระบบจองกลาง — จองออนไลน์พร้อมชำระเงินได้เลยที่ class.jiacpr.com (คูปองใช้ได้ตรงที่หน้าจองเลย) */}
      {hubRounds && <div style={{ background: B.white, borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ fontSize: 14, fontWeight: 800 }}>📅 รอบเรียนที่เปิดรับตอนนี้</div>
        <div style={{ fontSize: 12, color: B.dkGray, marginTop: 2, marginBottom: 8 }}>อยากล็อกวันเลยไม่ต้องรอติดต่อกลับ — จองออนไลน์พร้อมชำระเงินได้ทันที</div>
        {hubRounds.map(r => (
          <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${B.ltGray}`, fontSize: 13 }}>
            <span><strong>{thRoundTime(r.startsAt)}</strong></span>
            <span style={{ color: B.green, fontWeight: 700 }}>เหลือ {r.seatsLeft} ที่</span>
          </div>
        ))}
        <a href={bcprBookingUrl} target="_blank" rel="noopener noreferrer"
          onClick={() => track("booking_hub_click", { source: "cpr-online" })}
          style={{ display: "block", textAlign: "center", marginTop: 10, background: B.red, color: B.white, borderRadius: 10, padding: "13px 12px", textDecoration: "none", fontWeight: 700, fontSize: 14 }}>
          จองรอบเรียนพร้อมชำระเงินเลย →
        </a>
        {coupon && <div style={{ fontSize: 11, color: B.dkGray, marginTop: 6, textAlign: "center" }}>
          ลิงก์ด้านบนใส่คูปองส่วนลด ฿100 ให้อัตโนมัติแล้ว
        </div>}
      </div>}

      {/* Form */}
      <div style={{ background: B.white, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(0,0,0,.06)" }}>
        <div style={{ marginBottom: 14 }}><label style={lbl}>ชื่อ-นามสกุล *</label><input value={form.name} onChange={e => F("name", e.target.value)} placeholder="ชื่อจริง นามสกุล" style={inp}/></div>
        <div style={{ marginBottom: 14 }}><label style={lbl}>เบอร์โทร *</label><input value={form.phone} onChange={e => F("phone", e.target.value)} placeholder="08X-XXX-XXXX" type="tel" style={inp}/></div>

        <div style={{ marginBottom: 14 }}>
          <label style={lbl}>ช่วงวัน/เวลาที่สะดวก</label>
          <input value={form.prefTime} onChange={e => F("prefTime", e.target.value)} placeholder="เช่น เสาร์-อาทิตย์ บ่าย, วันธรรมดาหลัง 17:00" style={inp}/>
          <div style={{ fontSize: 12, color: B.dkGray, marginTop: 6 }}>ทีมงานจะติดต่อกลับเพื่อยืนยันวันเรียนและแจ้งวิธีชำระเงิน</div>
        </div>

        <div style={{ marginBottom: 14 }}><label style={lbl}>จำนวนคน</label><select value={form.people} onChange={e => F("people", e.target.value)} style={inp}><option>1</option><option>2</option><option>3</option><option>4</option><option>5+</option></select></div>
        <div style={{ marginBottom: 18 }}><label style={lbl}>หมายเหตุ</label><textarea value={form.note} onChange={e => F("note", e.target.value)} placeholder="ข้อมูลเพิ่มเติม" rows={2} style={{ ...inp, resize: "vertical" }}/></div>
        <button onClick={submit} disabled={submitting} style={{ ...css.btn(B.red, B.white), width: "100%", padding: "14px", fontSize: 16, opacity: submitting ? 0.6 : 1 }}>{submitting ? "กำลังส่ง..." : "ส่งคำขอจอง — ให้ทีมงานติดต่อกลับ →"}</button>
      </div>

      <div style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: B.dkGray }}>หรือจองผ่าน LINE ได้เลย</div>
      <a href={LINE_URL} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 8, background: "#06C755", borderRadius: 12, padding: "14px 24px", color: B.white, textDecoration: "none", fontWeight: 700, fontSize: 15 }}><I name="line" size={22} color={B.white}/> จองผ่าน LINE @jiacpr</a>
    </div></div>
  );
}

// ==================== IN-APP BROWSER NOTICE ====================
// ทราฟิกจากโฆษณา FB/IG เปิดใน webview ของแอป ทำให้ deep link แอด LINE มักค้าง
// แนะนำให้เปิดในเบราว์เซอร์จริง (Chrome/Safari) เพื่อให้ flow แอด LINE ลื่นขึ้น
function detectInApp() {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  if (/FBAN|FBAV|FB_IAB/.test(ua)) return "Facebook";
  if (/Instagram/.test(ua)) return "Instagram";
  return null;
}
function InAppNotice() {
  const [src] = useState(detectInApp);
  const [hide, setHide] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (src) { safeTrack("inapp_browser_detected", { source: src }); phCapture("inapp_browser_detected", { source: src }); } }, [src]);
  if (!src || hide) return null;
  const copy = async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch (e) {} };
  return (
    <div style={{ background: "#FEF3C7", borderBottom: "1px solid #FDE68A", color: "#92400E", padding: "10px 14px", display: "flex", gap: 10, alignItems: "flex-start", fontSize: 13, lineHeight: 1.4 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>เปิดในเบราว์เซอร์จริงเพื่อแอด LINE ได้ลื่นกว่า</b>
        <div style={{ marginTop: 2 }}>คุณกำลังเปิดผ่านแอป {src} — กดเมนู ⋯ มุมขวาบนแล้วเลือก “เปิดในเบราว์เซอร์” (Chrome/Safari)</div>
        <button onClick={copy} style={{ marginTop: 8, padding: "6px 10px", borderRadius: 8, border: "1px solid #D97706", background: "#fff", color: "#92400E", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์"}</button>
      </div>
      <button onClick={() => setHide(true)} aria-label="ปิด" style={{ background: "none", border: "none", color: "#92400E", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 }}>×</button>
    </div>
  );
}

// ==================== STRIPE VERIFY ====================
// หน้ารอ/แจ้งผลระหว่างตรวจสอบว่า Stripe จ่ายเงินจริงหรือยัง (ดู useEffect stripeVerify ใน App)
function StripeVerify({ status, go }) {
  if (status === "failed") return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>ยังไม่พบการชำระเงิน</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>ถ้าคุณชำระเงินไปแล้วแต่ยังไม่ปลดล็อก กรุณาติดต่อเจ้าหน้าที่ผ่านไลน์ @jiacpr</p>
      <button onClick={() => go("store")} style={{ ...css.btn(B.red, B.white), marginTop: 20, padding: "14px 40px", fontSize: 16 }}>กลับไปหน้าร้าน</button>
    </div></div>
  );
  return (
    <div style={css.page}><div style={{ ...css.wrap, paddingTop: 60, textAlign: "center" }}>
      <h2 style={{ fontSize: 20, fontWeight: 800, margin: "0 0 8px" }}>กำลังตรวจสอบการชำระเงิน...</h2>
      <p style={{ fontSize: 14, color: B.dkGray }}>กรุณารอสักครู่</p>
    </div></div>
  );
}

// ==================== APP ====================
export default function App() {
  // เข้าหน้า admin ได้ทั้ง path /admin (เช่น cpr.morroo.com/admin) และ ?admin=1 (เดิม)
  const isAdmin = typeof window !== "undefined" && (
    new URLSearchParams(window.location.search).get("admin") === "1" ||
    /\/admin\/?$/.test(window.location.pathname)
  );
  const promoParam = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("promo") : null;
  // เปิดเกม CPR HERO ทันที ไม่ผ่านด่านสมัคร/หน้าที่ค้างไว้:
  //   ?game=1      → QR บูธ/อีเวนต์ (เช่น JIA-NIEMS-2026) เข้าหน้าเลือกเคส (hub)
  //   ?game=random → ลิงก์แบนเนอร์ "ท้าดวลกู้ชีพ" สุ่มโจทย์ให้นักเรียนเล่นทันที → ชนะรับคูปองส่วนลด
  //   /game?random=play → ฟอร์แมตเดียวกับ firstaid.morroo.com (ใช้ยิงแอด) — เต็มจอสุ่มโจทย์ทันที
  //   /game (ไม่มี random) → หน้าเลือกเคส · query อื่น (utm_*, fbclid, camp) คงอยู่ครบ ไม่มี redirect
  const gameSearch = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const gameValue = gameSearch ? gameSearch.get("game") : null;
  const gamePathParam = typeof window !== "undefined" && /^\/game\/?$/.test(window.location.pathname);
  const gameRandomParam = gameValue === "random" || (gamePathParam && gameSearch && gameSearch.get("random") === "play");
  const gameParam = gameValue === "1" || gamePathParam || gameRandomParam;
  // ต้องมี session_id (Stripe แทนค่าให้ตอน redirect กลับ) ถึงจะเข้าสู่หน้าตรวจสอบการจ่ายเงิน
  // ได้ — กัน exploit เดิมที่พิมพ์ ?stripe=success&modules=... เองแล้วปลดล็อกฟรีทันที
  const stripeSessionId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("session_id") : null;
  const stripeSuccess = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("stripe") === "success" && !!stripeSessionId;
  // หน้าที่ "จำตำแหน่งไว้ในเครื่อง" แล้วเปิดกลับมาที่เดิมได้ (กันนักเรียนต้องเริ่มขั้นตอนแรกใหม่ทุกครั้ง)
  const RESUMABLE_PAGES = ["course", "store", "register", "certificate", "minicert", "booking", "claim", "blog"];
  // เคยลงทะเบียน/ซื้อ/ปลดล็อก/มีความคืบหน้าแล้ว = กลับเข้าคอร์สได้เลย ไม่ต้องผ่านด่านสมัครซ้ำ
  // ใช้คีย์ดิบที่บันทึกจริง (purchased/promo_unlocked) ไม่ใช้ getPurchased() เพราะช่วง FREE_LAUNCH
  // getPurchased() จะคืนทุกบทให้ "ทุกคน" รวมถึงคนเปิดครั้งแรก → จะเด้งข้ามควิซเกริ่นนำผิดพลาด
  const hasEnrolledBefore = () => isSignedUp() || load("progress", { done: [] }).done.length > 0
    || load("enrolled", false) || load("promo_redeemed", false)
    || (load("purchased", []) || []).some(x => x > 1) || (load("promo_unlocked", []) || []).length > 0;
  const [page, setPage] = useState(() => {
    if (gameParam) return "game";
    if (promoParam) return "claim";
    if (stripeSuccess) return "stripe-verify";
    // จำหน้าล่าสุดที่เปิดค้างไว้ — เปิดเว็บใหม่ก็เรียนต่อจากเดิมได้
    const last = load("last_page", null);
    if (last && RESUMABLE_PAGES.includes(last)) return last;
    if (hasEnrolledBefore()) return "course";
    // front gate (before-course): เปิดเว็บครั้งแรก → ควิซเกริ่นนำ → ถ้าทำควิซแล้วแต่ยังไม่สมัคร → ด่านสมัคร
    if (AUTH_GATE_ENABLED && getGateVariant() === "before-course") return load("teaser_done", false) ? "signupgate" : "teaserquiz";
    return "landing";
  });
  const [initialClaimCode] = useState(promoParam || "");
  const [user, setUser] = useState(() => load("user", null));
  const [progress, setProgress] = useState(() => load("progress", { done: [], scores: {} }));
  const [blogSlug, setBlogSlug] = useState(null);
  const go = useCallback(p => { setPage(p); window.scrollTo(0, 0); }, []);
  // แบนเนอร์ในแอป + ลิงก์ ?game=random → เข้าเกมแบบสุ่มโจทย์ให้ทันที (ไม่ผ่านหน้าเลือกเคส)
  const [gameAutoRandom, setGameAutoRandom] = useState(gameRandomParam);
  const goGameRandom = useCallback(() => { setGameAutoRandom(true); go("game"); }, [go]);
  // ชนะเกม CPR HERO → ปลดคูปองส่วนลด ฿100 คอร์ส on-site (funnel ดึงคนมาเรียนจริง)
  // รียูสคูปองเดิมถ้ามี (อย่าออกทับ) และยกเว้นนักเรียน pre-course ที่จ่ายค่า on-site แล้ว
  // (กันเข้าใจผิดเรื่องส่วนลด/เงินคืน — กฎเดียวกับหน้าใบประกาศ/สมัคร)
  const issueGameVoucher = useCallback(() => {
    if (isPreCourseStudent()) return null;
    // เฉพาะช่วงแคมเปญเท่านั้น — นอกช่วงไม่ออกคูปอง (เกมยังเล่นได้ปกติ แค่ไม่มีรางวัลคูปอง)
    const camp = activeGameVoucherCampaign();
    if (!camp) return null;
    const note = camp.start === camp.end
      ? `ใช้ได้เฉพาะวันที่ ${thaiShortDate(camp.end)} วันเดียว · ${camp.event}`
      : `ใช้เป็นส่วนลดภายใน ${thaiShortDate(camp.end)} · เฉพาะ${camp.event}`;
    // รียูสคูปองเดิมเฉพาะใบที่ยังไม่หมดอายุ (ไม่มีวันหมดอายุ = คูปองสมัคร ใช้ได้ตลอด)
    // ใบจากแคมเปญก่อนที่หมดอายุแล้ว → ออกใบใหม่ของแคมเปญนี้แทน
    const existing = load("coupon", null);
    const existingExp = load("coupon_expires", null);
    if (existing && (!existingExp || todayISOTH() <= existingExp)) return { code: existing, note };
    const c = genCoupon();
    save("coupon", c);
    save("coupon_expires", camp.end); // เก็บวันหมดอายุไว้ (หน้าจอง/เซลล์ใช้อ้างอิงได้)
    // ใส่วันหมดอายุใน staff_name ให้เซลล์เห็นในระบบ (promo_codes ไม่มีคอลัมน์ expires_at)
    // ⚠️ TODO: Hub ปิด anon insert บน promo_codes แล้ว (เหลือแค่ public.issue_online_coupon ซึ่งกำหนด
    // สิทธิ์จาก "เรียนจบคอร์สออนไลน์แล้ว" — ไม่ตรงกับกติกาคูปองแคมเปญเกมนี้ที่ให้ตามการชนะเกม) การเขียนแถวนี้จึง
    // ใช้ไม่ได้แล้ว โค้ดที่โชว์บนจอจะไม่ถูกบันทึกจริง ต้องตัดสินใจ: ออก RPC ใหม่สำหรับคูปองแคมเปญโดยเฉพาะ หรือ
    // เปลี่ยนกติกา issue_online_coupon ให้ครอบคลุมกรณีนี้ด้วย
    try { supaRest("promo_codes", "POST", { code: c, type: "online", discount: 100, staff_name: `game·exp ${camp.end}` }); } catch (e) {}
    return { code: c, note };
  }, []);
  // เข้าคอร์ส: ขึ้นกับตัวแปรด่าน (A/B) — before-course เด้งสมัครก่อน, soft = แอด LINE แบบข้ามได้, after-lesson-1 = เข้าเลย (ด่านไปโผล่หลังจบบท 1)
  const enterCourse = useCallback(() => {
    const v = getGateVariant();
    if (AUTH_GATE_ENABLED && v === "before-course" && !isSignedUp()) { go(load("teaser_done", false) ? "signupgate" : "teaserquiz"); return; }
    if ((!AUTH_GATE_ENABLED || v === "soft") && !load("line_added", false) && !load("line_skipped_at", null)) { go("lineprompt"); return; }
    go("course");
  }, [go]);
  const openBlog = useCallback(slug => { setBlogSlug(slug); setPage("blog-detail"); window.scrollTo(0, 0); }, []);
  const backFromBlog = useCallback(() => { setPage(load("progress", { done: [] }).done.length > 0 ? "course" : "landing"); window.scrollTo(0, 0); }, []);

  // จำหน้าล่าสุดไว้ในเครื่อง (localStorage) เฉพาะหน้าที่กลับมาเปิดต่อได้ — จะได้ไม่ต้องเริ่มขั้นตอนแรกใหม่
  useEffect(() => { if (RESUMABLE_PAGES.includes(page)) save("last_page", page); }, [page]);

  // Handle Stripe success redirect: ตรวจสถานะจริงกับ server ด้วย session_id ผ่าน RPC
  // get_purchase_by_session แทนการเชื่อ ?modules=... จาก URL ตรงๆ เหมือนเดิม (ซึ่งใครก็
  // พิมพ์ URL เองแล้วปลดล็อกฟรีได้) — webhook อาจมาถึงช้ากว่า redirect เล็กน้อย จึง poll
  // สั้นๆ ก่อนค่อยฟันธงว่าล้มเหลว
  const [stripeVerify, setStripeVerify] = useState(null); // null | "ok" | "pending" | "failed"
  useEffect(() => {
    // เก็บ UTM ก่อนเสมอ — เผื่อลิงก์มี ?promo=...&utm_source=... (เช่น QR คูปองพาร์ทเนอร์) เพราะ
    // ด้านล่างจะ replaceState ตัด query ทิ้งก่อน effect เก็บ UTM หลักจะได้รัน (captureUTM idempotent)
    captureUTM();
    const params = new URLSearchParams(window.location.search);
    if (params.get("stripe") === "success") {
      const sessionId = params.get("session_id");
      window.history.replaceState({}, "", window.location.pathname);
      if (!sessionId) { setStripeVerify("failed"); return; }
      let cancelled = false;
      (async () => {
        for (let attempt = 0; attempt < 6; attempt++) {
          const res = await supaRpc("get_purchase_by_session", { p_session_id: sessionId });
          const row = Array.isArray(res) && res.length ? res[0] : null;
          if (row?.payment_status === "ชำระแล้ว") {
            const newMods = (row.modules || "").split(",").map(Number).filter(Boolean);
            const merged = [...new Set([...getPurchased(), ...newMods])];
            savePurchased(merged);
            save("last_purchase", { session_id: sessionId, modules: row.modules, at: Date.now() }); // อ้างอิงตอนขอใบกำกับภาษี
            if (!cancelled) { setStripeVerify("ok"); setPage("course"); }
            return;
          }
          await new Promise(r => setTimeout(r, 1500));
        }
        if (!cancelled) setStripeVerify("failed");
      })();
      return () => { cancelled = true; };
    }
    if (params.get("promo")) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // UTM + A/B variant
  useEffect(() => {
    captureUTM();
    captureReferral();
    // ลิงก์เฉพาะกิจแคมเปญ (?camp=line0806) — จำ key ไว้ให้ issueGameVoucher เช็คสิทธิ์คูปอง
    try { const ck = new URLSearchParams(window.location.search).get("camp"); if (ck) save("game_camp", ck); } catch (e) {}
    // แคมเปญที่เปิด unlockCourse: เข้าผ่านลิงก์ในวันแคมเปญ → ปลดคอร์สทุกบทให้เลย (จำสิทธิ์ถาวรในเครื่อง)
    const camp = activeGameVoucherCampaign();
    if (camp?.unlockCourse && !load("camp_course_unlock", false)) {
      save("camp_course_unlock", true);
      safeTrack("camp_course_unlock", { camp: camp.key || camp.event });
      phCapture("camp_course_unlock", { camp: camp.key || camp.event });
    }
    // เข้าจาก QR บูธ → บันทึก event พร้อม utm (เช่น utm_campaign=jia-niems-2026) ไว้วัดยอดสแกน
    if (gameParam) { const u = { ...getUTM(), mode: gameRandomParam ? "random" : "hub" }; safeTrack("game_qr_open", u); phCapture("game_qr_open", u); }
    getPosthog().then(ph => { if (ph) { try { ph.onFeatureFlags(() => { const v = ph.getFeatureFlag("gate_placement"); if (typeof v === "string" && ["before-course","after-lesson-1","soft"].includes(v)) save("gate_variant", v); }); } catch (e) {} } });
  }, []);

  // เข้ามาจากลิงก์ชวนเพื่อน แล้วสมัครสำเร็จ (ทุกเส้นทางจบที่ user มี customer_id + phone) → บันทึกยอดให้ผู้ชวนครั้งเดียว
  // server ตรวจเองว่าเป็นลูกค้าใหม่จริง (สร้างภายใน 3 วัน) และไม่ใช่เบอร์เดียวกับเจ้าของโค้ด
  useEffect(() => {
    const code = getRefCode();
    if (!code || load("ref_recorded", false) || !user?.customer_id || !user?.phone) return;
    supaRpc("referral_record_signup", { p_code: code, p_customer_id: user.customer_id, p_phone: user.phone }).then((ok) => {
      if (ok === null) return; // เรียกไม่สำเร็จ (เน็ต/ยังไม่ deploy) — ลองใหม่รอบหน้า
      save("ref_recorded", true);
      if (ok) { safeTrack("referral_signup", { code }); phCapture("referral_signup", { code }); }
    });
  }, [user?.customer_id, user?.phone]);

  // กลับจากหน้า LINE login (signInWithLine เคย liff.login() นำทางออกไปตอนกดปุ่มเข้าสู่ระบบ) → เก็บ
  // phone/name ที่กรอกไว้ตอนนั้นใน line_login_pending แล้วทำ signInWithLine ต่อให้จบตอนหน้ากลับมาโหลด
  useEffect(() => {
    const pending = load("line_login_pending", null);
    if (!pending) return;
    (async () => {
      const result = await signInWithLine(pending);
      if (result) { setUser(result.user); if (result.progress) setProgress(result.progress); }
    })();
  }, []);

  // เคยล็อกอิน LINE แล้ว (มี auth_user_id) แต่ Supabase session หายไปจริง (ล้างข้อมูลเบราว์เซอร์บางส่วน ฯลฯ)
  // → เคลียร์ auth_user_id ทิ้งแทนที่จะค้างสถานะ "ล็อกอินแล้ว" ทั้งที่ sync ข้อมูลกับบัญชีจริงไม่ได้อีก
  useEffect(() => {
    const u = load("user", null);
    if (!u?.auth_user_id) return;
    (async () => {
      try {
        const supa = await getSupabase();
        const { data: { session } } = await supa.auth.getSession();
        if (!session) { const nu = { ...u, auth_user_id: undefined }; setUser(nu); save("user", nu); }
      } catch (e) {}
    })();
  }, []);

  // Auto-link LINE: เปิดในแอป LINE (LIFF) และเป็นนักเรียนที่สมัครแล้วแต่ยังไม่ล็อกอิน LINE จริง (ยังไม่มี
  // auth_user_id) → เข้าสู่ระบบ LINE ให้เงียบ ๆ (silent: ไม่บังคับ redirect ถ้ายังไม่ได้ล็อกอิน LIFF)
  useEffect(() => {
    const u = load("user", null);
    if (!u?.phone || u?.auth_user_id || load("line_login_pending", null) || load("signed_out_account", null)) return;
    (async () => {
      try {
        const liff = await loadLiff();
        if (!liff || typeof liff.isInClient !== "function" || !liff.isInClient()) return;
        const result = await signInWithLine({ phone: u.phone, name: u.name || "", silent: true });
        if (result) { setUser(result.user); if (result.progress) setProgress(result.progress); }
      } catch (e) {}
    })();
  }, []);

  if (PORTAL_TOKEN) return (
    <>
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลด...</div>}><CompanyPortal token={PORTAL_TOKEN}/></Suspense>
      <Analytics />
    </>
  );

  if (isAdmin) return (
    <>
      <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: B.dkGray }}>กำลังโหลดหน้าแอดมิน...</div>}><Admin/></Suspense>
      <Analytics />
    </>
  );

  return (
    <>
      {/* หน้าเกมจากลิงก์แอดต้องเต็มจอทันที — ซ่อนแบนเนอร์ in-app browser (แบนเนอร์นี้มีไว้ช่วย flow แอด LINE ซึ่งไม่เกี่ยวกับหน้าเกม) */}
      {page !== "game" && <InAppNotice />}
      {(() => {
        switch (page) {
          case "stripe-verify": return <StripeVerify status={stripeVerify} go={go}/>;
          case "landing": return <Landing go={go} enterCourse={enterCourse} openBlog={openBlog} goGameRandom={goGameRandom}/>;
          case "register": return <Register go={go} setUser={u => { setUser(u); save("user", u); }}/>;
          case "lineprompt": return <LineAddPrompt go={go} user={user} setUser={u => { setUser(u); save("user", u); }} variant={isSignedUp() ? "post-register" : "pre-course"}/>;
          case "teaserquiz": return <TeaserQuiz go={go}/>;
          case "signupgate": return <SignupGate go={go} setUser={u => { setUser(u); save("user", u); }} setProgress={p => { setProgress(p); save("progress", p); }}/>;
          case "payment": return <Payment go={go} user={user}/>;
          case "store": return <Store go={go} setUser={u => { setUser(u); save("user", u); }}/>;
          case "course": return <Course go={go} progress={progress} setProgress={p => { setProgress(p); save("progress", p); }} user={user} setUser={u => { setUser(u); save("user", u); }} openBlog={openBlog} goGameRandom={goGameRandom}/>;
          case "certificate": return <Certificate user={user} go={go}/>;
          case "minicert": return <MiniCert user={user} go={go}/>;
          case "booking": return <Booking go={go}/>;
          case "taxinvoice": return <TaxInvoicePage go={go} user={user}/>;
          case "blog": return <BlogList goBack={backFromBlog} openBlog={openBlog}/>;
          case "blog-detail": return <BlogDetail slug={blogSlug} goBack={() => go("blog")} openBlog={openBlog}/>;
          case "claim": return <Claim go={go} setUser={u => { setUser(u); save("user", u); }} initialStep={initialClaimCode ? "redeem" : (load("claim_start_redeem", false) ? "redeem" : "form")} initialCode={initialClaimCode}/>;
          case "game": return <GamePage onExit={() => go(hasEnrolledBefore() ? "course" : "landing")} onTrack={(n, p) => { safeTrack(n, p); phCapture(n, p); }} fetchCustomImages={() => supaRest("game_character_images", "GET", null, "?select=char_id,pose,url")} finalExamPassed={progress.done.includes(COURSE.modules[COURSE.modules.length - 1].id)} earnVoucher={issueGameVoucher} onGoBooking={() => go("booking")} autoRandom={gameAutoRandom}/>;
          default: return <Landing go={go} enterCourse={enterCourse} openBlog={openBlog} goGameRandom={goGameRandom}/>;
        }
      })()}
      <Analytics />
    </>
  );
}

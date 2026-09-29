import { useRef, useState } from 'react';
import { B, SERIF, Logo, DEKD_EVENT, captureNodeToPng, deliverBlob, dataUrlToBlob, sanitizeFileName, thaiShortDate, todayISOTH } from '../lib/core';

// เกียรติบัตรงาน Dek-D — กรอกชื่อ → บันทึกเป็นรูป (ไปใส่พอร์ตได้) + โฆษณาคอร์สออฟฟิศ / roodee.me
export default function EventCert({ scenarioTitle, grade, onTrack, lineUrl }) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);
  const save = async () => {
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      const png = await captureNodeToPng(ref.current);
      await deliverBlob(await dataUrlToBlob(png), `CPR_HERO_${sanitizeFileName(name)}.png`, 'image/png');
      onTrack?.('dekd_cert_download', { grade });
    } catch (e) {
      onTrack?.('dekd_cert_download_error', {});
      alert('บันทึกอัตโนมัติไม่สำเร็จ กรุณา screenshot หน้าจอเพื่อบันทึกเกียรติบัตร');
    } finally { setBusy(false); }
  };
  return (
    <div style={{ margin: '16px 0', color: B.black }}>
      <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 8, textAlign: 'center', color: '#fff' }}>🏅 รับเกียรติบัตร — กรอกชื่อของคุณ</div>
      <input
        value={name} onChange={e => setName(e.target.value.slice(0, 60))} placeholder="ชื่อ-นามสกุล"
        style={{ width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 10, border: 'none', fontSize: 16, marginBottom: 10 }}
      />
      <div ref={ref} style={{ background: 'linear-gradient(180deg,#FFFEF7,#fff)', border: `2px solid ${B.gold}`, borderRadius: 12, padding: '22px 16px 14px', textAlign: 'center' }}>
        <Logo size={56} />
        <div style={{ fontSize: 13, color: B.dkGray, marginTop: 4 }}>เกียรติบัตร · JIA TRAINER CENTER</div>
        <div style={{ fontSize: 12, color: B.dkGray, margin: '10px 0 4px' }}>มอบให้แก่</div>
        <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, lineHeight: 1.4, minHeight: 32 }}>{name.trim() || 'ชื่อ-นามสกุล'}</div>
        <div style={{ fontSize: 13, margin: '8px 0 2px' }}>ผ่านภารกิจกู้ชีพ <b>CPR HERO</b>{scenarioTitle ? <> — {scenarioTitle}</> : null}</div>
        <div style={{ fontSize: 12, color: B.dkGray }}>เกรด {grade} · งาน Dek-D · {thaiShortDate(todayISOTH())}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14, textAlign: 'left' }}>
          <div style={{ flex: 1, background: '#FEF2F2', borderRadius: 8, padding: '8px 10px', fontSize: 11, lineHeight: 1.5 }}>
            <b style={{ color: B.red }}>เรียน CPR จริงที่ออฟฟิศ JIA</b><br />ฝึกกับหุ่น + ครูผู้สอน ได้ใบรับรอง<br />ทัก LINE @jiacpr
          </div>
          <div style={{ flex: 1, background: '#F5F3FF', borderRadius: 8, padding: '8px 10px', fontSize: 11, lineHeight: 1.5 }}>
            <b style={{ color: '#7C3AED' }}>roodee.me</b><br />ติวสอบ/คู่มือแพทย์ด้วย AI<br />ใช้โค้ด <b>{DEKD_EVENT.roodeeCode}</b> ฟรี {DEKD_EVENT.roodeeTrialDays} วัน
          </div>
        </div>
      </div>
      <button type="button" className="cbs-btn-main" onClick={save} disabled={busy || !name.trim()} style={{ width: '100%', marginTop: 10, opacity: name.trim() ? 1 : .5 }}>
        {busy ? 'กำลังสร้างรูป...' : '💾 บันทึกเกียรติบัตรเป็นรูปภาพ'}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <a className="cbs-btn-line" style={{ flex: 1, textAlign: 'center' }} href={lineUrl} target="_blank" rel="noopener noreferrer" onClick={() => onTrack?.('dekd_line_cta', {})}>💬 สนใจคอร์สออฟฟิศ</a>
        <a className="cbs-btn-ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href={DEKD_EVENT.roodeeUrl} target="_blank" rel="noopener noreferrer" onClick={() => onTrack?.('dekd_roodee_cta', {})}>📚 ลอง roodee.me</a>
      </div>
    </div>
  );
}

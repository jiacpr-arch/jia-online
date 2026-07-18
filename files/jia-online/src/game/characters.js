// Character registry — CPR HERO (เกมภารกิจพลเมืองดี บน cpr.morroo.com)
//
// ตัวละครทั้งหมดเป็น "ข้อมูล" ไม่ใช่โค้ดเกม:
//   - เกม/โจทย์อ้างถึงตัวละครด้วย charId + pose เท่านั้น
//   - รูปจริง (ถ้ามี) วางที่ public/images/characters/{charId}/{pose}.webp
//     (+ {pose}_talk.webp สำหรับเฟรมปากอ้า — มีหรือไม่มีก็ได้)
//   - ถ้ายังไม่มีรูปจริง CharacterSprite จะ fallback มาใช้ SVG placeholder ในไฟล์นี้
//   - เพิ่มตัวละครใหม่ = เพิ่ม entry ที่นี่ + วางรูปในโฟลเดอร์ ไม่ต้องแตะ engine
//
// ชุดตัวละคร "พลเมืองดี": ผู้เล่นคือคนแรกที่เจอเหตุ ตัวละครรอบข้างเป็นคนธรรมดา
// + เจ้าหน้าที่ 1669 ปลายสาย (ทำหน้าที่โค้ช/ดุเมื่อตัดสินใจผิด แบบ อ.เดช ในเกม ACLS)

export const POSES = ['idle', 'talk', 'panic', 'stern', 'happy'];

// charId ของ "โค้ช" — ตัวที่พูดตอนตอบผิด/time-skip (GamePage อ้างค่านี้)
export const COACH_ID = 'dispatcher_prom';

const OUT = '#0E1322';

function eyes(pose, x1, x2, y, iris) {
  if (pose === 'happy') {
    return `<path d="M${x1 - 9},${y} Q${x1},${y - 9} ${x1 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>
            <path d="M${x2 - 9},${y} Q${x2},${y - 9} ${x2 + 9},${y}" stroke="${OUT}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  }
  const r = pose === 'panic' ? 8.5 : 7;
  const pr = pose === 'panic' ? 2.6 : 3.4;
  return `<ellipse cx="${x1}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x1}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x1 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>
          <ellipse cx="${x2}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
          <circle cx="${x2}" cy="${y + 1}" r="${pr}" fill="${iris}"/>
          <circle cx="${x2 + 1.5}" cy="${y - 1.5}" r="1.3" fill="#fff"/>`;
}

function brows(pose, x1, x2, y) {
  if (pose === 'stern') {
    return `<path d="M${x1 - 10},${y - 6} L${x1 + 9},${y + 1}" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
            <path d="M${x2 + 10},${y - 6} L${x2 - 9},${y + 1}" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`;
  }
  if (pose === 'panic') {
    return `<path d="M${x1 - 9},${y + 1} Q${x1},${y - 8} ${x1 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
            <path d="M${x2 + 9},${y + 1} Q${x2},${y - 8} ${x2 - 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
  }
  return `<path d="M${x1 - 9},${y - 2} Q${x1},${y - 6} ${x1 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>
          <path d="M${x2 - 9},${y - 2} Q${x2},${y - 6} ${x2 + 9},${y - 2}" stroke="${OUT}" stroke-width="3.6" fill="none" stroke-linecap="round"/>`;
}

function mouth(pose, cx, y) {
  if (pose === 'panic') return `<ellipse cx="${cx}" cy="${y + 3}" rx="9" ry="11" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
  if (pose === 'happy') return `<path d="M${cx - 12},${y} Q${cx},${y + 13} ${cx + 12},${y}" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
  if (pose === 'stern') return `<path d="M${cx - 10},${y + 4} Q${cx},${y - 2} ${cx + 10},${y + 4}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  return `<path d="M${cx - 8},${y + 2} Q${cx},${y + 6} ${cx + 8},${y + 2}" stroke="${OUT}" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

function mouthTalk(cx, y) {
  return `<ellipse cx="${cx}" cy="${y + 2}" rx="7" ry="6" fill="#8C3A46" stroke="${OUT}" stroke-width="2.8"/>`;
}

// wrap face parts so CharacterSprite toggles ปากปิด/ปากอ้า ระหว่างพิมพ์บทพูด
function mouthGroups(pose, cx, y) {
  return `<g data-mouth="idle">${mouth(pose, cx, y)}</g>
          <g data-mouth="talk" style="display:none">${mouthTalk(cx, y)}</g>`;
}

export const CHARACTERS = {
  // ป้าแก้ว — คนเห็นเหตุการณ์/ญาติผู้ป่วย ตื่นตกใจ เป็นคนตะโกนขอความช่วยเหลือ
  aunt_kaew: {
    name: 'ป้าแก้ว',
    role: 'คนเห็นเหตุการณ์',
    plate: ['#C86FA0', '#8E3D6C'],
    placeholder(pose) {
      const skin = '#F6CDA8', dress = '#C86FA0', dressD = '#9A4A78', hair = '#4A3A3F';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M26,250 L26,206 Q26,170 100,168 Q174,170 174,206 L174,250 Z" fill="${dress}" stroke="${OUT}" stroke-width="4"/>
      <path d="M62,180 Q100,198 138,180 L138,194 Q100,212 62,194 Z" fill="${dressD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="88" y="150" width="24" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,102 Q52,44 100,42 Q148,44 148,102 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M46,112 Q38,46 100,36 Q162,46 154,112 Q150,80 136,70 Q118,86 100,64 Q82,86 64,70 Q50,80 46,112 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <circle cx="100" cy="34" r="15" fill="${hair}" stroke="${OUT}" stroke-width="3.4"/>
      <circle cx="60" cy="120" r="5" fill="#E8A5C0" opacity=".55"/>
      <circle cx="140" cy="120" r="5" fill="#E8A5C0" opacity=".55"/>
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#4A3728')}
      ${mouthGroups(pose, 100, 132)}
      </svg>`;
    },
  },

  // พี่โอ๊ต — พลเมืองดีอีกคนที่วิ่งเข้ามาช่วย (ช่วยกด/สลับมือกับผู้เล่น)
  helper_oat: {
    name: 'พี่โอ๊ต',
    role: 'พลเมืองดี',
    plate: ['#3E9E52', '#256936'],
    placeholder(pose) {
      const skin = '#EEB98C', shirt = '#3E9E52', shirtD = '#2A6E39', hair = '#171A21';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,250 L22,204 Q22,168 100,166 Q178,168 178,204 L178,250 Z" fill="${shirt}" stroke="${OUT}" stroke-width="4"/>
      <path d="M70,170 Q100,188 130,170 L130,184 Q100,202 70,184 Z" fill="${shirtD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="86" y="148" width="28" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,102 Q52,44 100,42 Q148,44 148,102 Q148,140 128,152 Q114,160 100,160 Q86,160 72,152 Q52,140 52,102 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M50,92 Q52,40 100,32 Q148,40 150,92 L142,90 L146,74 L132,84 L134,64 L118,78 L114,56 L100,74 L86,56 L82,78 L66,64 L68,84 L54,74 L58,90 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      ${brows(pose, 80, 120, 96)}
      ${eyes(pose, 80, 120, 107, '#33261B')}
      ${mouthGroups(pose, 100, 134)}
      <path d="M60,120 Q58,126 62,130 M140,120 Q142,126 138,130" stroke="#D89B6C" stroke-width="2.4" fill="none"/>
      </svg>`;
    },
  },

  // ลุงดำ — รปภ./พนักงานสถานที่ คนวิ่งไปเอา AED และคอยกันคนมุง
  guard_dam: {
    name: 'ลุงดำ รปภ.',
    role: 'รปภ. · คนเอา AED',
    plate: ['#4A6FA8', '#2C4571'],
    placeholder(pose) {
      const skin = '#D9A778', uni = '#4A6FA8', uniD = '#33507E', cap = '#2C4571';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M22,250 L22,204 Q22,168 100,166 Q178,168 178,204 L178,250 Z" fill="${uni}" stroke="${OUT}" stroke-width="4"/>
      <path d="M74,172 L100,198 L126,172 L119,166 L100,184 L81,166 Z" fill="${uniD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="30" y="196" width="140" height="12" fill="${uniD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="86" y="148" width="28" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,104 Q52,48 100,46 Q148,48 148,104 Q148,140 128,152 Q114,160 100,160 Q86,160 72,152 Q52,140 52,104 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M48,84 Q48,48 100,44 Q152,48 152,84 L152,92 L48,92 Z" fill="${cap}" stroke="${OUT}" stroke-width="4"/>
      <path d="M40,92 L160,92 L154,102 L46,102 Z" fill="${uniD}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M92,68 L100,54 L108,68 L100,64 Z" fill="#F2C14E" stroke="${OUT}" stroke-width="2.4"/>
      <path d="M84,138 Q100,146 116,138 L116,144 Q100,152 84,144 Z" fill="#6B7A8F" stroke="${OUT}" stroke-width="2.4"/>
      ${brows(pose, 80, 120, 108)}
      ${eyes(pose, 80, 120, 118, '#33261B')}
      ${mouthGroups(pose, 100, 140)}
      </svg>`;
    },
  },

  // หมอพร้อม — เจ้าหน้าที่ศูนย์สั่งการ 1669 ปลายสาย (โค้ชประจำเกม ใส่เฮดเซ็ต)
  dispatcher_prom: {
    name: 'หมอพร้อม · 1669',
    role: 'ศูนย์สั่งการฉุกเฉิน',
    plate: ['#D9542B', '#96320F'],
    placeholder(pose) {
      const skin = '#F6CDA8', uni = '#D9542B', uniD = '#A53A12', hair = '#2A2233';
      return `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
      <path d="M26,250 L26,206 Q26,170 100,168 Q174,170 174,206 L174,250 Z" fill="${uni}" stroke="${OUT}" stroke-width="4"/>
      <path d="M76,176 L100,200 L124,176 L118,170 L100,186 L82,170 Z" fill="${uniD}" stroke="${OUT}" stroke-width="3"/>
      <rect x="118" y="196" width="40" height="18" rx="4" fill="#fff" stroke="${OUT}" stroke-width="2.6"/>
      <path d="M130,200 L134,210 M138,196 L138,214 M146,202 L150,208" stroke="#D9542B" stroke-width="2.4" fill="none"/>
      <rect x="88" y="150" width="24" height="26" fill="${skin}" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M52,100 Q52,42 100,40 Q148,42 148,100 Q148,140 128,152 Q114,161 100,161 Q86,161 72,152 Q52,140 52,100 Z" fill="${skin}" stroke="${OUT}" stroke-width="4"/>
      <path d="M48,106 Q42,44 100,34 Q158,44 152,106 Q150,80 138,72 Q120,88 100,66 Q80,88 62,72 Q50,80 48,106 Z" fill="${hair}" stroke="${OUT}" stroke-width="4"/>
      <path d="M50,96 Q46,60 60,50" stroke="#2B3D77" stroke-width="7" fill="none" stroke-linecap="round"/>
      <ellipse cx="56" cy="108" rx="10" ry="13" fill="#2B3D77" stroke="${OUT}" stroke-width="3.4"/>
      <path d="M62,120 Q76,136 92,138" stroke="#2B3D77" stroke-width="4.5" fill="none" stroke-linecap="round"/>
      <circle cx="94" cy="139" r="5" fill="#2B3D77" stroke="${OUT}" stroke-width="2.6"/>
      ${brows(pose, 80, 120, 92)}
      ${eyes(pose, 80, 120, 104, '#4A3728')}
      ${mouthGroups(pose, 100, 130)}
      </svg>`;
    },
  },
};

export function getCharacter(charId) {
  if (CHARACTERS[charId]) return CHARACTERS[charId];
  if (!charId) return null;
  // ตัวละครที่ยังไม่รู้จัก → silhouette กลาง กัน "หน้าหาย"
  const fallback = { name: '—', role: '', plate: ['#405089', '#232F5E'] };
  return {
    ...fallback,
    placeholder: (pose) => `<svg viewBox="0 0 200 250" xmlns="http://www.w3.org/2000/svg">
    <path d="M24,250 L24,206 Q24,170 100,168 Q176,170 176,206 L176,250 Z" fill="#405089" stroke="${OUT}" stroke-width="4"/>
    <rect x="88" y="150" width="24" height="26" fill="#EDBE96" stroke="${OUT}" stroke-width="3.4"/>
    <ellipse cx="100" cy="100" rx="46" ry="52" fill="#EDBE96" stroke="${OUT}" stroke-width="4"/>
    <path d="M52,96 Q56,42 100,38 Q144,42 148,96 Q144,66 128,62 Q110,74 100,60 Q90,74 72,62 Q56,66 52,96 Z" fill="#3A3F4B" stroke="${OUT}" stroke-width="4"/>
    ${brows(pose, 79, 121, 90)}
    ${eyes(pose, 79, 121, 104, '#3A3228')}
    ${mouthGroups(pose, 100, 132)}
  </svg>`,
  };
}

// รูป override ที่แอดมินอัปโหลดผ่านหน้า /admin (ตาราง game_character_images ใน Supabase)
// key = `${charId}/${pose}` (pose มี suffix _talk สำหรับเฟรมปากอ้า) → URL บน storage
let customImages = {};
export function registerCustomImages(map) {
  customImages = map || {};
}

// URL รูปจริง — ลำดับ: รูปที่แอดมินอัปโหลด > ไฟล์ใน public/images/characters/ > SVG placeholder
export function characterImageUrl(charId, pose, talking = false) {
  const key = `${charId}/${pose}${talking ? '_talk' : ''}`;
  if (customImages[key]) return customImages[key];
  return `/images/characters/${charId}/${pose}${talking ? '_talk' : ''}.webp`;
}

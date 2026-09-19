# JIA TRAINER CENTER — Online CPR & AED Course

แพลตฟอร์มเรียน CPR & AED ออนไลน์ ราคา ฿100

## Features
- 5 บทเรียน + Final Exam
- ดูวิดีโอ → ทำ Quiz → ผ่าน 80% ไปบทถัดไป
- ใบประกาศนียบัตรอัตโนมัติ
- ส่วนลด ฿100 สำหรับคอร์ส On-site
- ชำระเงินผ่าน QR PromptPay + แอดมินอนุมัติ
- คูปองพาร์ทเนอร์ (QR) — ธุรกิจพันธมิตรแจกคูปองให้ลูกค้าเรียนคอร์สเต็มฟรี

## คูปองพาร์ทเนอร์ (QR) — สำหรับเจ้าหน้าที่ JIA
ธุรกิจพันธมิตร (เช่น ออฟฟิศที่ส่งของประจำที่อ้อมน้อย) อยากแจกคูปองให้ลูกค้าของเขา
สแกน QR แล้วเรียนคอร์ส CPR & AED ออนไลน์ได้ฟรีทั้งคอร์สทันที (เห็นมูลค่า ฿149)
คูปองไม่ซ้ำ ใบละ 1 สิทธิ์ หลังใช้/เรียนจบจะเห็น LINE + เบอร์โทรของพาร์ทเนอร์ให้ลูกค้าติดต่อกลับ
(ลูกค้ายังได้คูปองส่วนลด ฿100 คอร์ส On-site ของ JIA ตามปกติด้วย)

วิธีออกคูปอง:
1. เข้าหน้าแอดมิน (`/admin`) → แท็บ **"คูปองพาร์ทเนอร์ (QR)"**
2. กรอกชื่อพาร์ทเนอร์, รหัสย่อ (ใช้ขึ้นต้นโค้ด เช่น `OMNOI`), LINE, เบอร์โทร, มูลค่าที่โชว์, จำนวนใบ และวันหมดอายุ แล้วกด "สร้างชุดคูปอง"
3. กด "พิมพ์ชุดนี้" (หรือ "พิมพ์ใบที่ยังไม่ใช้" ในรายการด้านล่าง) เพื่อเปิดหน้าพิมพ์ A4 (8 ใบ/หน้า) แล้วกดพิมพ์ หรือกด "บันทึกรูป" ต่อใบเพื่อส่งให้พาร์ทเนอร์ทาง LINE
4. ดูยอดใช้ + รายชื่อคนใช้คูปองได้ในหน้าเดียวกัน และแก้ไข LINE/เบอร์ทีหลังได้โดยไม่ต้องพิมพ์คูปองใหม่ (คูปองที่พิมพ์ไปแล้วยังใช้ได้ปกติ แค่หน้าเว็บจะโชว์ข้อมูลติดต่อใหม่)

## Deploy บน Vercel (ฟรี)

### ขั้นตอนที่ 1: เตรียม GitHub Repo
```bash
# สร้าง repo ใหม่บน GitHub ชื่อ jia-online
# จากนั้น push โค้ดขึ้นไป:
cd jia-online
git init
git add .
git commit -m "Initial: JIA Online Course"
git branch -M main
git remote add origin https://github.com/jiacpr-arch/jia-online.git
git push -u origin main
```

### ขั้นตอนที่ 2: Deploy บน Vercel
1. ไปที่ https://vercel.com → Sign up ด้วย GitHub
2. กด "New Project" → Import จาก GitHub repo "jia-online"
3. Vercel จะ detect Vite อัตโนมัติ → กด Deploy
4. รอ 1-2 นาที → ได้ URL เช่น `jia-online.vercel.app`

### ขั้นตอนที่ 3: Redirect จาก jiacpr.com/online
ที่ MakeWebEasy:
1. สร้างหน้าใหม่ชื่อ "online"
2. ใส่ HTML embed:
```html
<script>window.location.href = "https://jia-online.vercel.app";</script>
```
หรือ ใส่ iframe:
```html
<iframe src="https://jia-online.vercel.app" 
  style="width:100%;height:100vh;border:none;" 
  allow="fullscreen">
</iframe>
```

## สิ่งที่ต้องเพิ่มก่อนเปิดจริง
- [ ] แทนที่ QR Code placeholder ด้วย QR PromptPay จริง (ใน Payment component)
- [ ] เพิ่ม YouTube embed URLs สำหรับวิดีโอแต่ละบท
- [ ] ปรับคำถาม Quiz ให้ตรงกับเนื้อหาวิดีโอจริง
- [ ] เพิ่ม Google Analytics / Facebook Pixel tracking
- [ ] ตั้ง Custom Domain (ถ้าต้องการ) ที่ Vercel Settings → Domains

## Tech Stack
- React 18 + Vite
- No external CSS framework (inline styles)
- localStorage สำหรับ save progress
- Responsive mobile-first design

## Contact
JIA TRAINER CENTER
- โทร: 088-558-8078
- LINE: @jiacpr
- Email: jiacpr@gmail.com
- Web: jiacpr.com

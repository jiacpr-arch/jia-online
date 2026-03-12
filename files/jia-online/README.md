# JIA TRAINER CENTER — Online CPR & AED Course

แพลตฟอร์มเรียน CPR & AED ออนไลน์ ราคา ฿100

## Features
- 5 บทเรียน + Final Exam
- ดูวิดีโอ → ทำ Quiz → ผ่าน 80% ไปบทถัดไป
- ใบประกาศนียบัตรอัตโนมัติ
- ส่วนลด ฿100 สำหรับคอร์ส On-site
- ชำระเงินผ่าน QR PromptPay + แอดมินอนุมัติ

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

import { Component } from "react";
import { phCaptureException } from "./lib/core";

// จับ error ตอน render ที่หลุดมาถึงราก — แทนที่จะเป็นจอขาว ให้ผู้เรียนเห็นปุ่มโหลดใหม่/ติดต่อ LINE
// และส่ง error เข้า PostHog Error Tracking (error อื่นนอก render — onerror/unhandledrejection —
// PostHog เก็บเองผ่าน capture_exceptions ใน getPosthog)
export default class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error, info) {
    phCaptureException(error, { source: "react_error_boundary", component_stack: (info?.componentStack || "").slice(0, 2000), path: window.location.pathname });
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 24, background: "#FFF8F0", textAlign: "center" }}>
        <div style={{ maxWidth: 360 }}>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>ขออภัย เกิดข้อผิดพลาด</div>
          <div style={{ fontSize: 14, color: "#666", lineHeight: 1.6, marginBottom: 20 }}>ความคืบหน้าการเรียนของคุณยังอยู่ครบ ลองโหลดหน้าใหม่อีกครั้ง ถ้ายังไม่หายติดต่อเราทาง LINE @jiacpr</div>
          <button onClick={() => window.location.reload()} style={{ background: "#C8102E", color: "#fff", border: "none", borderRadius: 12, padding: "14px 32px", fontSize: 15, fontWeight: 700, cursor: "pointer", width: "100%" }}>โหลดหน้าใหม่</button>
          <a href="https://line.me/R/ti/p/@jiacpr" target="_blank" rel="noopener noreferrer" style={{ display: "block", marginTop: 12, color: "#06C755", fontWeight: 700, fontSize: 14 }}>ติดต่อ LINE @jiacpr</a>
        </div>
      </div>
    );
  }
}

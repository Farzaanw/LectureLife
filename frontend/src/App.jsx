import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";
import LectureLifeLogo from "./components/LectureLifeLogo";
import LeafIcon from "./components/Leaf";

const LOCAL_SERVER = "http://localhost:3001";
const NGROK_URL = "https://lining-quintet-flock.ngrok-free.dev";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;


const Leaf = () => {
  const leaves = useMemo(() => {
    const rows = 4;
    const cols = 5;
    const jitter = 6;
    const items = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const topBase = ((r + 0.5) / rows) * 100;
        const leftBase = ((c + 0.5) / cols) * 100;
        items.push({
          top: topBase + (Math.random() * jitter - jitter / 2),
          left: leftBase + (Math.random() * jitter - jitter / 2),
          size: 26 + Math.random() * 22,
          rot: -35 + Math.random() * 70,
          opacity: 0.55 + Math.random() * 0.25,
        });
      }
    }
    return items;
  }, []);

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 1 }}>
      {leaves.map((leaf, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            top: `${leaf.top}%`,
            left: `${leaf.left}%`,
            transform: `translate(-50%, -50%) rotate(${leaf.rot}deg)`,
            opacity: leaf.opacity,
          }}
          aria-hidden="true"
        >
          <LeafIcon size={leaf.size} />
        </div>
      ))}
    </div>
  );
};

const Spinner = () => (
  <div className="flex flex-col items-center justify-center mt-20">
    <div className="w-14 h-14 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-orange-600 font-semibold">Processing your slides...</p>
  </div>
);

const SAMPLE_UI_SPEC = {
  title: "TCP: Transmission Control Protocol",
  theme: { primaryColor: "#1f73b7", fontTitle: "Google Sans", fontBody: "Roboto" },
  enhancements: [
    { type: "ADD_TEXT_BOX", content: "The 'Reliable' Layer of the Internet Stack", position: { x: 50, y: 80 }, size: { width: 400, height: 60 }, animation: "FADE_IN", animationOrder: 1 },
    { type: "ADD_TEXT_BOX", content: "Connection-oriented • Ordered delivery • Error detection • Flow control • Congestion control", position: { x: 50, y: 160 }, size: { width: 400, height: 80 }, animation: "FLY_IN_FROM_LEFT", animationOrder: 2 },
  ],
  interactivity: { type: "QUIZ", items: [] },
};

// ─────────────────────────────────────────────
//  CANVAS SLIDE BUILDER
// ─────────────────────────────────────────────

function ctxWrapText(ctx, text, x, y, maxW, lineH) {
  const words = text.split(" ");
  let line = "";
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line.trim(), x, y);
      y += lineH;
      line = word + " ";
    } else {
      line = test;
    }
  }
  if (line.trim()) ctx.fillText(line.trim(), x, y);
}

function buildSlideCanvas(uiSpec) {
  const W = 1280, H = 720;
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  // Background
  ctx.fillStyle = uiSpec.theme?.primaryColor || "#2563eb";
  ctx.fillRect(0, 0, W, H);

  // Dark gradient overlay for depth
  const grd = ctx.createLinearGradient(0, 0, W, H);
  grd.addColorStop(0, "rgba(0,0,0,0.1)");
  grd.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, W, H);

  // Title
  ctx.fillStyle = "white";
  ctx.font = "bold 52px Arial, sans-serif";
  ctx.fillText(uiSpec.title || "Enhanced Slide", 80, 120, 1100);

  // Divider
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 148); ctx.lineTo(1200, 148); ctx.stroke();

  // Enhancement text items
  const texts = (uiSpec.enhancements || []).filter(e => e.type === "ADD_TEXT_BOX");
  texts.slice(0, 3).forEach((e, i) => {
    ctx.fillStyle = i === 0 ? "rgba(255,255,255,0.92)" : "rgba(255,255,255,0.7)";
    ctx.font = `${i === 0 ? "bold " : ""}${i === 0 ? 30 : 24}px Arial, sans-serif`;
    ctxWrapText(ctx, e.content, 80, 195 + i * 110, 1100, i === 0 ? 40 : 32);
  });

  // Interactivity preview (first 3 items)
  const iType = uiSpec.interactivity?.type;
  const iItems = uiSpec.interactivity?.items || [];
  if (iItems.length > 0 && iType !== "NONE") {
    const previewLabels = iItems.slice(0, 3).map(item =>
      item.question || item.left || item.title || item.front || ""
    ).filter(Boolean);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.font = "20px Arial, sans-serif";
    previewLabels.forEach((label, i) => {
      ctx.fillText(`• ${label}`, 80, 530 + i * 32, 1100);
    });
  }

  // Mode badge
  const modeLabels = { QUIZ: "Quiz", MATCH_PAIRS: "Match Pairs", STORY: "Story", ACCORDION: "Explore", FLIP_CARDS: "Flip Cards", TIMELINE: "Timeline", NONE: "Enhanced" };
  const badge = `✦ ${modeLabels[iType] || iType || "Enhanced"}`;
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(80, 640, ctx.measureText(badge).width + 40, 44);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = "bold 20px Arial, sans-serif";
  ctx.fillText(badge, 100, 668);

  // LectureLife watermark
  ctx.fillStyle = "rgba(255,255,255,0.28)";
  ctx.font = "bold 18px Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("LectureLife", 1200, 700);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/jpeg", 0.92);
}

function NavButton({ direction, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        position: "absolute",
        [direction === "left" ? "left" : "right"]: 12,
        top: "50%",
        transform: "translateY(-50%)",
        width: 44, height: 44,
        borderRadius: "50%",
        border: "1px solid rgba(255,255,255,0.15)",
        background: "rgba(255,255,255,0.08)",
        color: "white",
        fontSize: 26,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.2 : 0.8,
        display: "flex", alignItems: "center", justifyContent: "center",
        backdropFilter: "blur(4px)",
        zIndex: 10,
      }}
    >
      {direction === "left" ? "‹" : "›"}
    </button>
  );
}

function QrIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="3" height="3"/>
      <rect x="18" y="18" width="3" height="3"/>
    </svg>
  );
}

function PresentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/>
      <line x1="8" y1="21" x2="16" y2="21"/>
      <line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  );
}

function PresentOverlay({ slides, socket, studentUrl, onClose }) {
  const [current, setCurrent] = useState(0);
  const [showQR, setShowQR] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [floatingBubble, setFloatingBubble] = useState(null);
  const [landedIds, setLandedIds] = useState(new Set());
  const prevQIds = useRef(new Set());

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(slides.length - 1, c + 1)), [slides.length]);

  useEffect(() => {
    if (socket) socket.emit("change-slide", current);
  }, [current, socket]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft"  || e.key === "ArrowUp")   prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  useEffect(() => {
    if (!socket) return;
    const handler = (qs) => {
      setQuestions(qs);
      const incoming = qs.filter(q => !prevQIds.current.has(q.id));
      if (incoming.length > 0) {
        const newest = incoming[0];
        setFloatingBubble({ id: newest.id, text: newest.text });
        setTimeout(() => {
          setLandedIds(prev => new Set([...prev, newest.id]));
          setFloatingBubble(null);
        }, 2000);
      }
      qs.forEach(q => prevQIds.current.add(q.id));
    };
    socket.on("questions-update", handler);
    return () => socket.off("questions-update", handler);
  }, [socket]);

  const dismissQuestion = (id) => {
    if (socket) socket.emit("dismiss-question", id);
    setLandedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    prevQIds.current.delete(id);
  };

  const clearAll = () => {
    if (socket) socket.emit("clear-questions");
    setLandedIds(new Set());
    prevQIds.current.clear();
  };

  const pendingCount = questions.length;

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: "#0f0f0f", display: "flex", flexDirection: "column" }}>

      {floatingBubble && (
        <div key={floatingBubble.id} style={{
          position: "absolute", bottom: 100, left: "50%", transform: "translateX(-50%)",
          zIndex: 2000, pointerEvents: "none",
          animation: "bubbleFloat 2s cubic-bezier(0.4,0,0.6,1) forwards",
        }}>
          <div style={{
            background: "linear-gradient(135deg, #f0945c, #e07840)",
            color: "white", borderRadius: 20, padding: "14px 20px",
            maxWidth: 340, fontSize: 15, fontWeight: 500, lineHeight: 1.45,
            boxShadow: "0 12px 40px rgba(240,148,92,0.5), 0 0 0 1px rgba(255,255,255,0.1)",
            position: "relative",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.7, display: "block", marginBottom: 5, letterSpacing: "0.08em" }}>✦ NEW QUESTION</span>
            {floatingBubble.text}
            <div style={{ position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)", width: 0, height: 0, borderLeft: "7px solid transparent", borderRight: "7px solid transparent", borderTop: "7px solid #e07840" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ color: "#f0945c", fontWeight: 700, fontSize: 18 }}>LectureLife</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          Slide <span style={{ color: "white", fontWeight: 600 }}>{current + 1}</span> / {slides.length}
        </span>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => setShowQR((v) => !v)}
            style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(240,148,92,0.5)", background: showQR ? "rgba(240,148,92,0.2)" : "transparent", color: "#f0945c", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <QrIcon /> {showQR ? "Hide QR" : "Show QR"}
          </button>
          <button onClick={onClose}
            style={{ padding: "7px 14px", borderRadius: 999, border: "1px solid rgba(255,255,255,0.15)", background: "transparent", color: "rgba(255,255,255,0.7)", fontSize: 13, cursor: "pointer" }}>
            ✕ Exit
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative" }}>
          <NavButton direction="left" onClick={prev} disabled={current === 0} />
          {slides[current]?.uiSpec ? (
            <div key={current} style={{ width: "100%", maxWidth: 680, maxHeight: "calc(100vh - 130px)", overflowY: "auto", borderRadius: 12, animation: "slideIn 0.2s ease-out" }}>
              <InteractiveSlide uiSpec={slides[current].uiSpec} compact={false} />
            </div>
          ) : (
            <img key={current} src={slides[current]?.src} alt={`Slide ${current + 1}`}
              style={{ maxWidth: "100%", maxHeight: "calc(100vh - 130px)", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", animation: "slideIn 0.2s ease-out" }} />
          )}
          <NavButton direction="right" onClick={next} disabled={current === slides.length - 1} />
        </div>

        {showQR && (
          <div style={{ width: 260, background: "rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>
            <div style={{ padding: "20px 20px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
              <p style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: 600, letterSpacing: "0.08em" }}>STUDENT ACCESS</p>
              <div style={{ background: "white", borderRadius: 12, padding: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {studentUrl
                  ? <QRCodeCanvas value={studentUrl} size={140} fgColor="#1a1a1a" bgColor="#ffffff" level="M" />
                  : <div style={{ width: 140, height: 140, display: "flex", alignItems: "center", justifyContent: "center", color: "#ccc", fontSize: 12 }}>Connecting…</div>
                }
              </div>
              {studentUrl && (
                <span style={{ fontSize: 9, color: "#888", textAlign: "center", wordBreak: "break-all", lineHeight: 1.4 }}>{studentUrl}</span>
              )}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                {slides.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)}
                    style={{ width: i === current ? 18 : 7, height: 7, borderRadius: 999, border: "none", background: i === current ? "#f0945c" : "rgba(255,255,255,0.2)", cursor: "pointer", transition: "all 0.2s", padding: 0 }} />
                ))}
              </div>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>QUESTIONS</span>
                  {pendingCount > 0 && (
                    <span style={{ background: "#f0945c", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{pendingCount}</span>
                  )}
                </div>
                {pendingCount > 0 && (
                  <button onClick={clearAll} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", padding: "2px 6px" }}>Clear all</button>
                )}
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>No questions yet</div>
                ) : (
                  questions.map((q) => (
                    <div key={q.id} style={{
                      background: landedIds.has(q.id) ? "rgba(240,148,92,0.08)" : "rgba(255,255,255,0.04)",
                      border: landedIds.has(q.id) ? "1px solid rgba(240,148,92,0.5)" : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 10, padding: "10px 12px", position: "relative",
                      animation: landedIds.has(q.id) ? "landInSidebar 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards" : "none",
                      boxShadow: landedIds.has(q.id) ? "0 0 16px rgba(240,148,92,0.15)" : "none",
                      transition: "border 0.4s, background 0.4s, box-shadow 0.4s",
                    }}>
                      <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.85)", lineHeight: 1.5, marginRight: 18 }}>{q.text}</p>
                      <p style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", marginTop: 5 }}>
                        Slide {q.slideIndex + 1} · {new Date(q.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <button onClick={() => dismissQuestion(q.id)}
                        style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", color: "rgba(255,255,255,0.25)", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px 4px" }}
                        title="Dismiss">✕</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, padding: "8px 16px", overflowX: "auto", background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {slides.map((slide, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            style={{ border: i === current ? "2px solid #f0945c" : "2px solid transparent", borderRadius: 4, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", flexShrink: 0, opacity: i === current ? 1 : 0.4, transition: "opacity 0.15s, border-color 0.15s", position: "relative" }}>
            <img src={slide.src} alt={`Slide ${i + 1}`} style={{ height: 44, width: "auto", display: "block" }} />
            {slide.uiSpec && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(224,92,42,0.85)", fontSize: 7, fontWeight: 700, color: "white", textAlign: "center", letterSpacing: "0.05em", padding: "1px 0" }}>
                {slide.uiSpec.interactivity?.type || "LIVE"}
              </div>
            )}
          </button>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
        @keyframes bubbleFloat {
          0%   { opacity: 0;   transform: translateX(-50%) translateY(0px)    scale(0.92); }
          15%  { opacity: 1;   transform: translateX(-50%) translateY(-30px)  scale(1);    }
          100% { opacity: 0;   transform: translateX(-50%) translateY(-220px) scale(0.9);  }
        }
        @keyframes landInSidebar {
          0%   { opacity: 0; transform: translateX(20px) scale(0.92); }
          60%  { transform: translateX(-3px) scale(1.02); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─────────────────────────────────────────────
//  INTERACTIVE SLIDE COMPONENTS
// ─────────────────────────────────────────────

function QuizInteractive({ items }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  if (!items?.length) {
    return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No questions generated.</p>;
  }

  if (done) {
    const pct = Math.round((score / items.length) * 100);
    const pass = pct >= 60;
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "28px 0" }}>
        <span style={{ fontSize: 44 }}>{pass ? "🏆" : "📚"}</span>
        <div style={{ width: 82, height: 82, borderRadius: "50%", background: pass ? "#dcfce7" : "#fee2e2", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 26, fontWeight: 800, color: pass ? "#16a34a" : "#dc2626" }}>{pct}%</span>
        </div>
        <p style={{ fontWeight: 600, fontSize: 15, color: "#111827", margin: 0 }}>{score} / {items.length} correct</p>
        <button onClick={() => { setCurrent(0); setSelected(null); setScore(0); setDone(false); }}
          style={{ padding: "8px 24px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #e05c2a, #f0945c)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Try Again
        </button>
      </div>
    );
  }

  const q = items[current];

  const handleSelect = (idx) => {
    if (selected !== null) return;
    setSelected(idx);
    if (idx === q.correct) setScore(s => s + 1);
  };

  const handleNext = () => {
    if (current + 1 >= items.length) setDone(true);
    else { setCurrent(c => c + 1); setSelected(null); }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", justifyContent: "center", gap: 5 }}>
        {items.map((_, idx) => (
          <div key={idx} style={{ width: idx === current ? 20 : 8, height: 8, borderRadius: 999, background: idx < current ? "#86efac" : idx === current ? "linear-gradient(90deg,#e05c2a,#f0945c)" : "#e5e7eb", transition: "all 0.25s" }} />
        ))}
      </div>

      <p style={{ fontSize: 15, fontWeight: 600, color: "#111827", lineHeight: 1.4, margin: 0 }}>{q.question}</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(q.options || []).map((opt, idx) => {
          const isCorrect  = idx === q.correct;
          const isSelected = idx === selected;
          let bg = "white", border = "#e5e7eb", color = "#374151";
          if (selected !== null) {
            if (isCorrect)       { bg = "#f0fdf4"; border = "#86efac"; color = "#15803d"; }
            else if (isSelected) { bg = "#fef2f2"; border = "#fca5a5"; color = "#b91c1c"; }
          }
          return (
            <button
              key={idx}
              onClick={() => handleSelect(idx)}
              disabled={selected !== null}
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, color, textAlign: "left", fontSize: 14, fontWeight: selected !== null && isCorrect ? 600 : 400, cursor: selected !== null ? "default" : "pointer", transition: "all 0.2s", width: "100%" }}
            >
              <span style={{ width: 24, height: 24, borderRadius: "50%", flexShrink: 0, background: selected !== null && isCorrect ? "#bbf7d0" : isSelected ? "#fecaca" : "#f3f4f6", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: selected !== null && isCorrect ? "#15803d" : isSelected ? "#b91c1c" : "#9ca3af" }}>
                {selected !== null && isCorrect ? "✓" : selected !== null && isSelected ? "✗" : ["A","B","C","D"][idx]}
              </span>
              {opt}
            </button>
          );
        })}
      </div>

      {selected !== null && (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={handleNext}
            style={{ padding: "8px 20px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #e05c2a, #f0945c)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {current + 1 >= items.length ? "See Results" : "Next →"}
          </button>
        </div>
      )}
    </div>
  );
}

function FlipCardsInteractive({ items }) {
  const [flipped, setFlipped] = useState(new Set());

  if (!items?.length) {
    return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No cards generated.</p>;
  }

  const toggle = (idx) => {
    setFlipped(prev => { const n = new Set(prev); n.has(idx) ? n.delete(idx) : n.add(idx); return n; });
  };

  return (
    <div>
      <style>{`
        .fc-wrap { perspective: 700px; cursor: pointer; }
        .fc-inner { position: relative; width: 100%; height: 100%; transition: transform 0.45s; transform-style: preserve-3d; }
        .fc-inner.fc-flipped { transform: rotateY(180deg); }
        .fc-face { position: absolute; inset: 0; backface-visibility: hidden; -webkit-backface-visibility: hidden; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 12px; gap: 5px; }
        .fc-back { transform: rotateY(180deg); }
      `}</style>
      <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>
        {flipped.size} / {items.length} flipped · tap to reveal
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {items.map((item, idx) => (
          <div key={idx} className="fc-wrap" onClick={() => toggle(idx)} style={{ height: 108 }}>
            <div className={`fc-inner${flipped.has(idx) ? " fc-flipped" : ""}`}>
              <div className="fc-face" style={{ border: "1.5px solid #e5e7eb", background: "white", boxShadow: "0 1px 6px rgba(0,0,0,0.06)" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#9ca3af" }}>TERM</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", textAlign: "center", lineHeight: 1.3 }}>{item.front}</span>
              </div>
              <div className="fc-face fc-back" style={{ border: "1.5px solid #fed7aa", background: "linear-gradient(135deg,#fff4ed,#fff8f2)", boxShadow: "0 2px 12px rgba(240,148,92,0.15)" }}>
                <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: "#f0945c" }}>DEFINITION</span>
                <span style={{ fontSize: 12, color: "#374151", textAlign: "center", lineHeight: 1.4 }}>{item.back}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineInteractive({ items }) {
  const [active, setActive] = useState(0);

  if (!items?.length) {
    return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No steps generated.</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {items.map((item, idx) => {
        const isActive = idx === active;
        const isPast   = idx < active;
        const isLast   = idx === items.length - 1;
        return (
          <div key={idx} style={{ display: "flex" }}>
            {/* Dot + connector line */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 36, flexShrink: 0 }}>
              <button onClick={() => setActive(idx)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: isActive ? "linear-gradient(135deg,#e05c2a,#f0945c)" : isPast ? "#d1fae5" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: isActive ? "white" : isPast ? "#059669" : "#9ca3af", cursor: "pointer", flexShrink: 0, position: "relative", zIndex: 1 }}>
                {isPast ? "✓" : (item.step || idx + 1)}
              </button>
              {!isLast && (
                <div style={{ width: 2, flex: 1, minHeight: 16, background: isPast ? "#86efac" : "#e5e7eb", margin: "2px 0" }} />
              )}
            </div>
            {/* Content */}
            <button onClick={() => setActive(idx)}
              style={{ flex: 1, textAlign: "left", padding: "2px 10px 14px", border: "none", background: "transparent", cursor: "pointer" }}>
              <p style={{ fontSize: 13, fontWeight: isActive ? 600 : 500, color: isActive ? "#111827" : "#6b7280", lineHeight: 1.3, margin: 0 }}>{item.title}</p>
              {isActive && item.description && (
                <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, margin: "4px 0 0 0" }}>{item.description}</p>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function MatchPairsInteractive({ items }) {
  const [terms] = useState(() => items.map((item, i) => ({ ...item, origIdx: i })).sort(() => Math.random() - 0.5));
  const [defs]  = useState(() => items.map((item, i) => ({ ...item, origIdx: i })).sort(() => Math.random() - 0.5));
  const [selTerm, setSelTerm] = useState(null);
  const [matched, setMatched] = useState(new Set());
  const [flash, setFlash] = useState(null);

  if (!items?.length) return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No pairs generated.</p>;

  const allDone = matched.size === items.length;

  const handleTerm = (idx) => {
    if (matched.has(terms[idx].origIdx) || flash) return;
    setSelTerm(idx);
  };

  const handleDef = (idx) => {
    if (matched.has(defs[idx].origIdx) || flash || selTerm === null) return;
    const termItem = terms[selTerm];
    const defItem  = defs[idx];
    if (termItem.origIdx === defItem.origIdx) {
      setFlash({ type: "correct", termIdx: selTerm, defIdx: idx });
      setTimeout(() => { setMatched(prev => new Set([...prev, termItem.origIdx])); setFlash(null); setSelTerm(null); }, 500);
    } else {
      setFlash({ type: "wrong", termIdx: selTerm, defIdx: idx });
      setTimeout(() => { setFlash(null); setSelTerm(null); }, 500);
    }
  };

  if (allDone) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <span style={{ fontSize: 40 }}>🎉</span>
        <p style={{ fontWeight: 700, fontSize: 16, color: "#111827", margin: 0 }}>All matched!</p>
        <button onClick={() => { setMatched(new Set()); setSelTerm(null); }}
          style={{ padding: "8px 24px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #e05c2a, #f0945c)", color: "white", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          Play Again
        </button>
      </div>
    );
  }

  return (
    <div>
      <p style={{ textAlign: "center", fontSize: 11, color: "#9ca3af", marginBottom: 12 }}>
        {matched.size} / {items.length} matched · select a term, then its definition
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {terms.map((item, idx) => {
            const isMatched = matched.has(item.origIdx);
            const isSel = selTerm === idx;
            const isFlash = flash?.termIdx === idx;
            let bg = "white", border = "#e5e7eb";
            if (isMatched)                              { bg = "#f0fdf4"; border = "#86efac"; }
            else if (isFlash && flash.type === "correct") { bg = "#f0fdf4"; border = "#86efac"; }
            else if (isFlash && flash.type === "wrong")   { bg = "#fef2f2"; border = "#fca5a5"; }
            else if (isSel)                             { bg = "#fff4ed"; border = "#f0945c"; }
            return (
              <button key={idx} onClick={() => handleTerm(idx)} disabled={isMatched || !!flash}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 13, fontWeight: 600, cursor: isMatched ? "default" : "pointer", opacity: isMatched ? 0.45 : 1, transition: "all 0.2s", textAlign: "left" }}>
                {item.left}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {defs.map((item, idx) => {
            const isMatched = matched.has(item.origIdx);
            const isFlash = flash?.defIdx === idx;
            let bg = "white", border = "#e5e7eb";
            if (isMatched)                              { bg = "#f0fdf4"; border = "#86efac"; }
            else if (isFlash && flash.type === "correct") { bg = "#f0fdf4"; border = "#86efac"; }
            else if (isFlash && flash.type === "wrong")   { bg = "#fef2f2"; border = "#fca5a5"; }
            return (
              <button key={idx} onClick={() => handleDef(idx)} disabled={isMatched || selTerm === null || !!flash}
                style={{ padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${border}`, background: bg, fontSize: 12, cursor: (isMatched || selTerm === null) ? "default" : "pointer", opacity: isMatched ? 0.45 : selTerm === null ? 0.5 : 1, transition: "all 0.2s", textAlign: "left" }}>
                {item.right}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const STORY_THEMES = [
  { bg: "linear-gradient(150deg,#1a1a2e,#16213e,#0f3460)", accent: "#f0945c", glow: "rgba(240,148,92,0.35)" },
  { bg: "linear-gradient(150deg,#0d2137,#0e2d44,#0a3859)", accent: "#38bdf8", glow: "rgba(56,189,248,0.35)" },
  { bg: "linear-gradient(150deg,#1f0d2e,#2a1040,#1a0835)", accent: "#a78bfa", glow: "rgba(167,139,250,0.35)" },
  { bg: "linear-gradient(150deg,#0e2218,#12301e,#0a2813)", accent: "#4ade80", glow: "rgba(74,222,128,0.35)" },
  { bg: "linear-gradient(150deg,#2e1a0d,#3a200e,#2a1508)", accent: "#fb923c", glow: "rgba(251,146,60,0.35)" },
];

function StoryInteractive({ items }) {
  const [current, setCurrent] = useState(0);
  const [insightOpen, setInsightOpen] = useState(false);

  if (!items?.length) return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No story generated.</p>;

  const item = items[current];
  const theme = STORY_THEMES[current % STORY_THEMES.length];
  const chapterNum = String(item.step || current + 1).padStart(2, "0");

  const go = (idx) => { setCurrent(Math.max(0, Math.min(items.length - 1, idx))); setInsightOpen(false); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <style>{`
        @keyframes storyIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes iconFloat { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-7px); } }
        @keyframes insightPop { from { opacity: 0; transform: scale(0.88); } to { opacity: 1; transform: scale(1); } }
        .story-page { animation: storyIn 0.28s ease-out; }
      `}</style>

      {/* Chapter card */}
      <div key={current} className="story-page" style={{
        position: "relative", borderRadius: 18, overflow: "hidden",
        background: theme.bg, padding: "22px 20px 20px",
      }}>
        {/* Watermark chapter number */}
        <div style={{ position: "absolute", top: 0, right: 10, fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,0.04)", lineHeight: 1, userSelect: "none", fontFamily: "monospace", pointerEvents: "none" }}>
          {chapterNum}
        </div>

        {/* Floating icon */}
        {item.icon && (
          <div style={{ fontSize: 48, marginBottom: 10, display: "inline-block", animation: "iconFloat 3.2s ease-in-out infinite", filter: `drop-shadow(0 0 14px ${theme.glow})` }}>
            {item.icon}
          </div>
        )}

        <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.13em", color: theme.accent, marginBottom: 7 }}>
          CHAPTER {chapterNum}
        </div>

        <h3 style={{ fontSize: 17, fontWeight: 700, color: "white", margin: "0 0 10px 0", lineHeight: 1.25, paddingRight: 32 }}>
          {item.title}
        </h3>

        {item.narration && (
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.62)", lineHeight: 1.6, margin: "0 0 14px 0", fontStyle: "italic" }}>
            {item.narration}
          </p>
        )}

        {/* Key insight — tappable, opens pop-up */}
        {item.keyInsight && (
          <button onClick={() => setInsightOpen(true)}
            style={{ display: "flex", alignItems: "center", gap: 9, borderRadius: 10, background: `${theme.accent}1a`, border: `1px solid ${theme.accent}44`, padding: "10px 13px", cursor: "pointer", width: "100%", textAlign: "left" }}>
            <span style={{ fontSize: 16, flexShrink: 0 }}>💡</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.accent, lineHeight: 1.35, flex: 1 }}>{item.keyInsight}</span>
            <span style={{ fontSize: 11, color: theme.accent, opacity: 0.55, flexShrink: 0 }}>↗</span>
          </button>
        )}
      </div>

      {/* Dot nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <button onClick={() => go(current - 1)} disabled={current === 0}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: current === 0 ? "#f3f4f6" : "linear-gradient(135deg,#e05c2a,#f0945c)", color: current === 0 ? "#9ca3af" : "white", fontSize: 16, cursor: current === 0 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ‹
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          {items.map((it, idx) => (
            <button key={idx} onClick={() => go(idx)} title={it.title}
              style={{ width: idx === current ? 22 : 8, height: 8, borderRadius: 999, border: "none", background: idx === current ? `linear-gradient(90deg,#e05c2a,#f0945c)` : idx < current ? "#fed7aa" : "#e5e7eb", cursor: "pointer", padding: 0, transition: "all 0.25s" }} />
          ))}
        </div>
        <button onClick={() => go(current + 1)} disabled={current === items.length - 1}
          style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: current === items.length - 1 ? "#f3f4f6" : "linear-gradient(135deg,#e05c2a,#f0945c)", color: current === items.length - 1 ? "#9ca3af" : "white", fontSize: 16, cursor: current === items.length - 1 ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
          ›
        </button>
      </div>

      {/* Key Insight pop-up */}
      {insightOpen && (
        <div onClick={() => setInsightOpen(false)}
          style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)", padding: 28 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ animation: "insightPop 0.22s ease-out", maxWidth: 320, width: "100%", borderRadius: 22, overflow: "hidden", background: theme.bg }}>
            <div style={{ padding: "32px 24px 24px", textAlign: "center" }}>
              <div style={{ fontSize: 54, marginBottom: 16, filter: `drop-shadow(0 0 18px ${theme.glow})` }}>
                {item.icon || "💡"}
              </div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.13em", color: theme.accent, marginBottom: 14 }}>
                CHAPTER {chapterNum} · KEY INSIGHT
              </div>
              <p style={{ fontSize: 20, fontWeight: 700, color: "white", lineHeight: 1.4, margin: 0 }}>
                {item.keyInsight}
              </p>
            </div>
            <button onClick={() => setInsightOpen(false)}
              style={{ display: "block", width: "100%", padding: "15px", background: `${theme.accent}1a`, border: "none", borderTop: `1px solid ${theme.accent}33`, color: theme.accent, fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.06em" }}>
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AccordionInteractive({ items }) {
  const [open, setOpen] = useState(0);

  const DOTS = ["#f0945c","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b","#06b6d4","#ef4444"];

  if (!items?.length) return <p style={{ textAlign: "center", color: "#9ca3af", fontSize: 14, padding: "32px 0" }}>No concepts generated.</p>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, idx) => {
        const isOpen = open === idx;
        const dot = DOTS[idx % DOTS.length];
        return (
          <div key={idx} style={{ borderRadius: 12, border: `1.5px solid ${isOpen ? dot + "55" : "#e5e7eb"}`, overflow: "hidden", transition: "border-color 0.2s" }}>
            <button onClick={() => setOpen(isOpen ? null : idx)}
              style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", background: isOpen ? dot + "12" : "white", border: "none", cursor: "pointer", textAlign: "left" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: dot, flexShrink: 0 }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#111827", flex: 1 }}>{item.title}</span>
              {!isOpen && item.summary && (
                <span style={{ fontSize: 11, color: "#9ca3af", maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.summary}</span>
              )}
              <span style={{ fontSize: 10, color: "#9ca3af", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
            </button>
            {isOpen && item.detail && (
              <div style={{ padding: "0 14px 12px 32px", borderTop: `1px solid ${dot}22` }}>
                <p style={{ fontSize: 13, color: "#374151", lineHeight: 1.55, margin: "8px 0 0 0" }}>{item.detail}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const MODE_LABELS = { QUIZ: "Quiz", MATCH_PAIRS: "Match Pairs", STORY: "Story", ACCORDION: "Explore", FLIP_CARDS: "Flip Cards", TIMELINE: "Timeline", NONE: "Enhanced Slide" };
const MODE_COUNT  = {
  QUIZ:        (n) => `${n} question${n !== 1 ? "s" : ""}`,
  MATCH_PAIRS: (n) => `${n} pair${n !== 1 ? "s" : ""}`,
  STORY:       (n) => `${n} chapter${n !== 1 ? "s" : ""}`,
  ACCORDION:   (n) => `${n} concept${n !== 1 ? "s" : ""}`,
  FLIP_CARDS:  (n) => `${n} card${n !== 1 ? "s" : ""}`,
  TIMELINE:    (n) => `${n} step${n !== 1 ? "s" : ""}`,
  NONE:        ()  => "",
};

function InteractiveSlide({ uiSpec, compact, onExpand }) {
  if (!uiSpec) return null;

  const type     = uiSpec.interactivity?.type  || "NONE";
  const items    = uiSpec.interactivity?.items || [];
  const label    = MODE_LABELS[type] || type;
  const countFn  = MODE_COUNT[type];
  const countLabel = countFn ? countFn(items.length) : "";

  if (compact) {
    return (
      <div style={{ borderRadius: 14, border: "1.5px solid #fed7aa", overflow: "hidden" }}>
        <div style={{ padding: "12px 14px", background: "linear-gradient(135deg, #fff4ed, #fff8f2)", borderBottom: "1px solid #fee2cc" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.09em", color: "#f0945c" }}>{label.toUpperCase()}</span>
            {countLabel && <span style={{ fontSize: 10, color: "#9ca3af" }}>{countLabel}</span>}
          </div>
          <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", lineHeight: 1.3, margin: 0 }}>{uiSpec.title}</p>
        </div>
        <button
          onClick={onExpand}
          style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", padding: "9px", background: "linear-gradient(135deg, #e05c2a, #f0945c)", border: "none", color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}
        >
          ▶ Open Interactive Slide
        </button>
      </div>
    );
  }

  return (
    <div style={{ background: "white", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 40px rgba(0,0,0,0.12)", width: "100%" }}>
      <div style={{ padding: "20px 24px 16px", background: "linear-gradient(135deg, #fff4ed, #fff8f2)", borderBottom: "1px solid #fee2cc" }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "#f0945c", marginBottom: 4 }}>{label.toUpperCase()}</div>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#111827", lineHeight: 1.25, margin: 0 }}>{uiSpec.title}</h2>
        {countLabel && <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0 0" }}>{countLabel}</p>}
      </div>
      <div style={{ padding: "20px 24px" }}>
        {type === "QUIZ"        && <QuizInteractive       items={items} />}
        {type === "MATCH_PAIRS" && <MatchPairsInteractive items={items} />}
        {type === "STORY"       && <StoryInteractive      items={items} />}
        {type === "ACCORDION"   && <AccordionInteractive  items={items} />}
        {type === "FLIP_CARDS"  && <FlipCardsInteractive  items={items} />}
        {type === "TIMELINE"    && <TimelineInteractive   items={items} />}
        {type === "NONE" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {(uiSpec.enhancements || []).map((item, idx) => (
              <div key={idx} style={{ borderRadius: 10, border: "1px solid #f3f4f6", background: "#fafafa", padding: "10px 14px" }}>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 600, marginBottom: 3 }}>{item.type}</div>
                <div style={{ fontSize: 13, color: "#374151" }}>{item.content}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────

export default function LectureLife() {
  const [slides, setSlides] = useState([]);
  const [pendingSlides, setPendingSlides] = useState([]);
  const [pendingPreview, setPendingPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [chatContent, setChatContent] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [expandedUiSpec, setExpandedUiSpec] = useState(null);
  const [expandedSlideIdx, setExpandedSlideIdx] = useState(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [presentMode, setPresentMode] = useState(false);
  const [studentUrl, setStudentUrl] = useState(null);
  const [chatInput, setChatInput] = useState("");
  const [applied, setApplied] = useState(false);
  const socketRef = useRef(null);
  const dragIdx = useRef(null);

  const resetApp = () => {
    setSlides([]);
    setPendingSlides([]);
    setPendingPreview(null);
    setChatContent(null);
    setPresentMode(false);
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = null;
    setStudentUrl(null);
  };

  const startPresenting = () => {
    const socket = io(LOCAL_SERVER);
    socketRef.current = socket;
    socket.emit("upload-slides", slides.map(s => s.src));
    socket.emit("upload-ui-specs", slides.map(s => s.uiSpec || null));
    setStudentUrl(`${NGROK_URL}/student`);
    setPresentMode(true);
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || file.type !== "application/pdf") return;
    setLoading(true);
    const reader = new FileReader();
    reader.onload = async function () {
      const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
      let pages = [];
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        await page.render({ canvasContext: ctx, viewport }).promise;
        pages.push(canvas.toDataURL());
      }
      const nextSlides = pages.map(src => ({ src }));
      setPendingSlides(nextSlides);
      setPendingPreview(pages[0] || null);
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleStartFromUpload = () => {
    if (!pendingSlides.length) return;
    setIsTransitioning(true);
    setChatContent({ status: "idle", text: "Let's enhance your slides!" });
    setTimeout(() => {
      setSlides(pendingSlides);
      setPendingSlides([]);
      setPendingPreview(null);
      setIsTransitioning(false);
    }, 350);
  };

  const enhanceSlide = (img) => {
    setApplied(false);
    setChatInput("");
    setPendingImage(img);
    setChatContent({ status: "select-mode", image: img, text: <strong>Choose your interactive style:</strong> });
  };

  const sendToAgent1 = async (modeLabel) => {
    if (!pendingImage) return;

    const statusSteps = [
      "Fetching data...",
      "Parsing slide pixels...",
      "Extracting content...",
      "Detecting layout cues...",
      "Mapping to interactive mode...",
      "Drafting activity blocks...",
    ];

    setChatContent({ status: "loading", image: pendingImage, text: null, lines: [statusSteps[0]] });

    const timers = statusSteps.slice(1).map((step, index) =>
      setTimeout(() => {
        setChatContent((prev) => {
          if (!prev || prev.status !== "loading") return prev;
          return { ...prev, lines: [step] };
        });
      }, 4000 * (index + 1))
    );

    try {
      const res = await fetch("http://localhost:3333/api/agent1/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageDataUrl: pendingImage,
          interactionMode: modeLabel,
          prompt: `Analyze this slide and output structured extraction that Agent 2 can directly use.\nUser selected mode: ${modeLabel}.`,
        }),
      });

      if (!res.ok) throw new Error("Backend error");

      const data = await res.json();
      const uiSpec = data?.uiSpec || SAMPLE_UI_SPEC;

      setApplied(false);
      setChatContent({ status: "done", image: pendingImage, uiSpec, agent1Output: data.agent1Output || "", interactionMode: modeLabel });
      setPendingImage(null);
    } catch {
      setChatContent({ status: "error", image: pendingImage, text: "Error sending to backend" });
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  const handleApplyToSlide = () => {
    if (!chatContent?.uiSpec) return;
    const src = buildSlideCanvas(chatContent.uiSpec);
    setSlides(prev => [...prev, { src, uiSpec: chatContent.uiSpec }]);
    setApplied(true);
  };

  const handleChatSubmit = async () => {
    const msg = chatInput.trim();
    if (!msg || chatContent?.status !== "done" || !chatContent?.agent1Output) return;
    setChatInput("");
    setApplied(false);

    const steps = ["Refining slide...", "Applying your changes...", "Almost done..."];
    setChatContent(prev => ({ ...prev, status: "loading", lines: [steps[0]] }));
    const timers = steps.slice(1).map((s, i) =>
      setTimeout(() => {
        setChatContent(prev => {
          if (!prev || prev.status !== "loading") return prev;
          return { ...prev, lines: [s] };
        });
      }, 3000 * (i + 1))
    );

    try {
      const res = await fetch("http://localhost:3333/api/agent2/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent1Output: chatContent.agent1Output,
          interactionMode: chatContent.interactionMode || "unknown",
          userMessage: msg,
        }),
      });
      if (!res.ok) throw new Error("Refine failed");
      const data = await res.json();
      const uiSpec = data?.uiSpec || chatContent.uiSpec;
      setChatContent(prev => ({ ...prev, status: "done", uiSpec }));
    } catch {
      setChatContent(prev => ({ ...prev, status: "error", text: "Failed to refine. Try again." }));
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  return (
    <>
      {presentMode && (
        <PresentOverlay
          slides={slides}
          socket={socketRef.current}
          studentUrl={studentUrl}
          onClose={() => setPresentMode(false)}
        />
      )}

      <div className="animated-bg pl-6 pr-0 py-0 flex gap-6">
        <Leaf />

        <div className={`flex-1 transition-opacity duration-500 ${isTransitioning ? "opacity-0" : "opacity-100"}`} style={{ position: "relative", zIndex: 2 }}>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-2">
              <h1 className="text-4xl font-bold text-orange-600">LectureLife</h1>
              <div className="mt-1">
                <LectureLifeLogo size={56} />
              </div>
            </div>
            {slides.length > 0 && (
              <button onClick={resetApp} className="px-4 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300">← Back</button>
            )}
          </div>

          {loading && <Spinner />}

          {!loading && slides.length === 0 && (
            <div className="max-w-3xl mx-auto">
              <label className="block rounded-3xl p-14 text-center bg-white/90 cursor-pointer relative overflow-hidden shadow-lg">
                {pendingPreview ? (
                  <div className="space-y-3">
                    <img
                      src={pendingPreview}
                      alt="Uploaded preview"
                      className="mx-auto w-72 rounded-2xl shadow"
                    />
                    <p className="text-sm font-semibold text-green-600">Upload Successful!</p>
                  </div>
                ) : (
                  <>
                    <div className="flex justify-center mb-5">
                      <div className="relative h-20 w-20 flex items-center justify-center">
                        <div className="upload-orbit-mask" aria-hidden="true"></div>
                        <svg
                          className="relative z-10 h-16 w-16 text-orange-600"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                          <polyline points="17 8 12 3 7 8" />
                          <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                      </div>
                    </div>
                    <p className="text-orange-700 font-semibold text-lg">Upload Teacher Material</p>
                    <p className="text-sm text-gray-500 mt-1">(PDF only for now)</p>
                  </>
                )}
                <input type="file" onChange={handleUpload} className="hidden" />
              </label>
              <button
                className={`w-full mt-6 py-4 rounded-xl ${pendingSlides.length ? "bg-orange-600 text-white" : "bg-gray-200 text-gray-500"}`}
                onClick={handleStartFromUpload}
                disabled={!pendingSlides.length}
              >
                ✦ Transform & Go Live
              </button>
            </div>
          )}

          {!loading && slides.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {slides.map((slide, i) => (
                  <div
                    key={i}
                    className="relative group"
                    draggable
                    onDragStart={() => { dragIdx.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      const from = dragIdx.current;
                      if (from === null || from === i) return;
                      setSlides(prev => {
                        const next = [...prev];
                        const [item] = next.splice(from, 1);
                        next.splice(i, 0, item);
                        return next;
                      });
                      dragIdx.current = null;
                    }}
                    style={{ cursor: "grab" }}
                  >
                    <div
                      className="rounded-xl shadow overflow-hidden cursor-pointer slide-glow"
                      onClick={() => setExpandedSlideIdx(i)}
                      style={{ position: "relative" }}
                    >
                      <img src={slide.src} className="w-full block" alt={`Slide ${i + 1}`} />
                      {slide.uiSpec && (
                        <div style={{ position: "absolute", top: 6, right: 6, background: "linear-gradient(135deg,#e05c2a,#f0945c)", color: "white", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 999, letterSpacing: "0.06em" }}>
                          {slide.uiSpec.interactivity?.type || "INTERACTIVE"}
                        </div>
                      )}
                      <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0)", transition: "background 0.15s" }} className="group-hover:bg-black/25" />
                      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.15s" }} className="group-hover:opacity-100">
                        <span style={{ background: "rgba(0,0,0,0.55)", color: "white", fontSize: 11, fontWeight: 600, padding: "4px 12px", borderRadius: 999, backdropFilter: "blur(4px)" }}>🔍 Expand</span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); enhanceSlide(slide.src); }}
                      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-6 py-2 text-sm font-semibold text-white opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "linear-gradient(135deg, rgba(224,92,42,0.92), rgba(240,148,92,0.92))", borderRadius: 999, cursor: "pointer" }}
                    >
                      ✦ Enhance
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-center pb-10">
                <button
                  onClick={startPresenting}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 36px", borderRadius: 999, border: "none", background: "linear-gradient(135deg, #c94e1e 0%, #e8733a 50%, #f0945c 100%)", color: "white", fontWeight: 700, fontSize: 15, cursor: "pointer", boxShadow: "0 4px 24px rgba(200,78,30,0.35)", letterSpacing: "0.02em", transition: "transform 0.15s, box-shadow 0.15s" }}
                  onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 32px rgba(200,78,30,0.45)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 24px rgba(200,78,30,0.35)"; }}
                >
                  <PresentIcon />
                  Present to Class
                </button>
              </div>
            </>
          )}
        </div>

        {/* AI Assistant panel */}
        {chatContent && (
          <div className="w-80 rounded-2xl panel-orbit" style={{ display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, alignSelf: "stretch", zIndex: 2 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
            <h3 className="text-orange-600 font-semibold mb-3">AI Assistant</h3>

            {chatContent.image && (
              <img src={chatContent.image} alt="Slide" className="rounded-lg mb-3" />
            )}

            {chatContent.status === "loading" && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "12px 0" }}>
                <style>{`
                  @keyframes lineIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
                `}</style>
                <div style={{ flexShrink: 0 }}>
                  <LectureLifeLogo size={56} />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, width: "100%", alignItems: "center" }}>
                  <p
                    key={(Array.isArray(chatContent.lines) ? chatContent.lines[0] : chatContent.lines) || "Working..."}
                    style={{ fontSize: 12, color: "#f0945c", margin: 0, animation: "lineIn 0.35s ease-out", textAlign: "center" }}
                  >
                    {(Array.isArray(chatContent.lines) ? chatContent.lines[0] : chatContent.lines) || "Working..."}
                  </p>
                </div>
              </div>
            )}

            {chatContent.status === "idle" && (
              <div className="flex flex-col items-center gap-6 mt-6">
                <p className="text-sm text-gray-700 font-semibold">{chatContent.text}</p>
                {!chatContent.image && <LectureLifeLogo size={64} />}
              </div>
            )}

            {chatContent.status === "select-mode" && (
              <div className="rounded-xl bg-gray-200 border border-gray-400 overflow-hidden">
                <div className="px-3 py-2">
                  <p className="text-sm text-gray-700">{chatContent.text}</p>
                </div>
                <div className="h-px bg-gray-300" />
                <div className="flex flex-col gap-2 p-3">
                  <button onClick={() => sendToAgent1("Quiz")}         className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Quiz</button>
                  <button onClick={() => sendToAgent1("Game")}         className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Game</button>
                  <button onClick={() => sendToAgent1("Storymode")}    className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Storymode</button>
                  <button onClick={() => sendToAgent1("Explore mode")} className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Explore</button>
                </div>
              </div>
            )}

            {chatContent.status === "done" && chatContent.uiSpec && (
              <InteractiveSlide
                uiSpec={chatContent.uiSpec}
                compact={true}
                onExpand={() => setExpandedUiSpec(chatContent.uiSpec)}
              />
            )}

            {chatContent.status === "done" && !chatContent.uiSpec && (
              <p className="text-sm text-gray-500">Slide enhanced — no spec returned.</p>
            )}

            {chatContent.status === "error" && (
              <p className="text-red-500 text-sm">{chatContent.text}</p>
            )}

            {/* Apply to Slide button */}
            {chatContent.status === "done" && chatContent.uiSpec && (
              <button
                onClick={handleApplyToSlide}
                disabled={applied}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  alignSelf: "center",
                  width: "fit-content",
                  marginTop: 12,
                  padding: "10px 18px",
                  borderRadius: 12,
                  border: applied ? "1.5px solid #9fc0a6" : "1px solid rgba(107,143,113,0.45)",
                  background: applied
                    ? "linear-gradient(135deg, #eef6f0, #f3f8f4)"
                    : "linear-gradient(135deg, #dfe9e2, #cfdcd3)",
                  color: applied ? "#2f5f3a" : "#2f5f3a",
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  cursor: applied ? "default" : "pointer",
                  boxShadow: applied
                    ? "0 6px 16px rgba(107,143,113,0.18)"
                    : "0 12px 28px rgba(107,143,113,0.25)",
                  transition: "all 0.2s",
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: applied ? "#dfe9e2" : "rgba(107,143,113,0.22)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 11,
                    fontWeight: 800,
                    color: applied ? "#2f5f3a" : "#2f5f3a",
                    boxShadow: applied ? "none" : "inset 0 0 0 1px rgba(47,95,58,0.25)",
                  }}
                >
                  {applied ? "✓" : "✦"}
                </span>
                {applied ? "Added to Deck" : "Add to Deck"}
              </button>
            )}
            </div>

            {/* Chat bar */}
            <div style={{ padding: "10px 16px 14px", borderTop: "1px solid #f3f4f6", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) handleChatSubmit(); }}
                  placeholder={chatContent.status === "done" ? "Ask a follow-up..." : "Suggest edits along the way..."}
                  disabled={chatContent.status === "loading"}
                  style={{ flex: 1, padding: "8px 12px", borderRadius: 10, border: "1.5px solid #e5e7eb", fontSize: 13, outline: "none", background: chatContent.status === "loading" ? "#f9fafb" : "white", color: "#111827" }}
                />
                <button
                  onClick={handleChatSubmit}
                  disabled={!chatInput.trim() || chatContent.status !== "done"}
                  style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: chatInput.trim() && chatContent.status === "done" ? "linear-gradient(135deg,#e05c2a,#f0945c)" : "#f3f4f6", color: chatInput.trim() && chatContent.status === "done" ? "white" : "#9ca3af", cursor: chatInput.trim() && chatContent.status === "done" ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, fontWeight: 700 }}
                >
                  ↑
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Expanded interactive modal (from AI panel Play button) */}
      {expandedUiSpec && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.72)", padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpandedUiSpec(null); }}
        >
          <div style={{ position: "relative", width: "100%", maxWidth: 600, maxHeight: "88vh", overflowY: "auto" }}>
            <button
              onClick={() => setExpandedUiSpec(null)}
              style={{ position: "absolute", top: -40, right: 0, borderRadius: 999, background: "rgba(255,255,255,0.85)", border: "none", padding: "6px 16px", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 600 }}
            >
              ✕ Close
            </button>
            <InteractiveSlide uiSpec={expandedUiSpec} compact={false} />
          </div>
        </div>
      )}

      {/* Slide expand overlay (click on any slide in the deck) */}
      {expandedSlideIdx !== null && slides[expandedSlideIdx] && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 150, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)", padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) setExpandedSlideIdx(null); }}
        >
          <div style={{ position: "relative", width: "100%", maxWidth: slides[expandedSlideIdx].uiSpec ? 640 : 900, maxHeight: "90vh", overflowY: "auto" }}>
            {/* Close + nav row */}
            <div style={{ position: "absolute", top: -44, left: 0, right: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => setExpandedSlideIdx(i => Math.max(0, i - 1))}
                  disabled={expandedSlideIdx === 0}
                  style={{ borderRadius: 999, background: "rgba(255,255,255,0.15)", border: "none", padding: "5px 14px", fontSize: 18, color: "white", cursor: expandedSlideIdx === 0 ? "default" : "pointer", opacity: expandedSlideIdx === 0 ? 0.3 : 1 }}
                >‹</button>
                <span style={{ color: "rgba(255,255,255,0.55)", fontSize: 13, alignSelf: "center" }}>
                  {expandedSlideIdx + 1} / {slides.length}
                </span>
                <button
                  onClick={() => setExpandedSlideIdx(i => Math.min(slides.length - 1, i + 1))}
                  disabled={expandedSlideIdx === slides.length - 1}
                  style={{ borderRadius: 999, background: "rgba(255,255,255,0.15)", border: "none", padding: "5px 14px", fontSize: 18, color: "white", cursor: expandedSlideIdx === slides.length - 1 ? "default" : "pointer", opacity: expandedSlideIdx === slides.length - 1 ? 0.3 : 1 }}
                >›</button>
              </div>
              <button
                onClick={() => setExpandedSlideIdx(null)}
                style={{ borderRadius: 999, background: "rgba(255,255,255,0.85)", border: "none", padding: "6px 16px", fontSize: 13, color: "#374151", cursor: "pointer", fontWeight: 600 }}
              >✕ Close</button>
            </div>

            {/* Content: interactive slide or plain image */}
            {slides[expandedSlideIdx].uiSpec ? (
              <InteractiveSlide uiSpec={slides[expandedSlideIdx].uiSpec} compact={false} />
            ) : (
              <img
                src={slides[expandedSlideIdx].src}
                alt={`Slide ${expandedSlideIdx + 1}`}
                style={{ width: "100%", borderRadius: 12, boxShadow: "0 20px 60px rgba(0,0,0,0.5)", display: "block" }}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
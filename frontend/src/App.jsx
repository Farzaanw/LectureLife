import React, { useState, useEffect, useCallback, useRef } from "react";
import { css } from "@emotion/react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";
import { QRCodeCanvas } from "qrcode.react";
import { io } from "socket.io-client";

const LOCAL_SERVER = "http://localhost:3001";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

const bg = css`
  background: linear-gradient(160deg, #fdeae6 0%, #f7cfc5 40%, #efb2a4 100%);
  min-height: 100vh;
  position: relative;
`;

const Leaf = ({ style }) => (
  <svg style={{ position: "fixed", opacity: 0.15, pointerEvents: "none", ...style }} width="50" height="80" viewBox="0 0 48 80">
    <path d="M24 2 C24 2 46 20 46 42 C46 62 35 78 24 78 C13 78 2 62 2 42 C2 20 24 2 24 2Z" fill="#d96a3a" />
  </svg>
);

const Spinner = () => (
  <div className="flex flex-col items-center justify-center mt-20">
    <div className="w-14 h-14 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-orange-600 font-semibold">Processing your slides...</p>
  </div>
);

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

function PresentOverlay({ images, socket, studentUrl, onClose }) {
  const [current, setCurrent] = useState(0);
  const [showQR, setShowQR] = useState(true);
  const [questions, setQuestions] = useState([]);
  const [floatingBubble, setFloatingBubble] = useState(null); // { id, text } currently floating
  const [landedIds, setLandedIds] = useState(new Set()); // ids that have completed animation
  const prevQIds = useRef(new Set());

  const prev = useCallback(() => setCurrent((c) => Math.max(0, c - 1)), []);
  const next = useCallback(() => setCurrent((c) => Math.min(images.length - 1, c + 1)), [images.length]);

  useEffect(() => {
    if (socket) socket.emit("change-slide", current);
  }, [current, socket]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") next();
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") prev();
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, onClose]);

  // Listen for incoming questions — show floating bubble for each new one
  useEffect(() => {
    if (!socket) return;
    const handler = (qs) => {
      setQuestions(qs);
      // Find newly arrived questions
      const incoming = qs.filter(q => !prevQIds.current.has(q.id));
      if (incoming.length > 0) {
        // Show the latest one as a floating bubble
        const newest = incoming[0];
        setFloatingBubble({ id: newest.id, text: newest.text });
        // After float animation (~1.8s), mark as landed so it glows in the sidebar
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

      {/* FLOATING QUESTION BUBBLE */}
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
            <div style={{
              position: "absolute", bottom: -7, left: "50%", transform: "translateX(-50%)",
              width: 0, height: 0,
              borderLeft: "7px solid transparent", borderRight: "7px solid transparent",
              borderTop: "7px solid #e07840",
            }} />
          </div>
        </div>
      )}

      {/* TOP BAR */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 }}>
        <span style={{ color: "#f0945c", fontWeight: 700, fontSize: 18 }}>LectureLife</span>
        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>
          Slide <span style={{ color: "white", fontWeight: 600 }}>{current + 1}</span> / {images.length}
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

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* SLIDE */}
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", position: "relative" }}>
          <NavButton direction="left" onClick={prev} disabled={current === 0} />
          <img key={current} src={images[current]} alt={`Slide ${current + 1}`}
            style={{ maxWidth: "100%", maxHeight: "calc(100vh - 130px)", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 60px rgba(0,0,0,0.6)", animation: "slideIn 0.2s ease-out" }} />
          <NavButton direction="right" onClick={next} disabled={current === images.length - 1} />
        </div>

        {/* RIGHT PANEL: QR + Questions stacked */}
        {showQR && (
          <div style={{ width: 260, background: "rgba(255,255,255,0.03)", borderLeft: "1px solid rgba(255,255,255,0.07)", display: "flex", flexDirection: "column", flexShrink: 0, overflow: "hidden" }}>

            {/* QR section */}
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
              {/* Slide dots */}
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center" }}>
                {images.map((_, i) => (
                  <button key={i} onClick={() => setCurrent(i)}
                    style={{ width: i === current ? 18 : 7, height: 7, borderRadius: 999, border: "none", background: i === current ? "#f0945c" : "rgba(255,255,255,0.2)", cursor: "pointer", transition: "all 0.2s", padding: 0 }} />
                ))}
              </div>
            </div>

            {/* Questions section */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
              {/* Questions header */}
              <div style={{ padding: "12px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 600 }}>QUESTIONS</span>
                  {pendingCount > 0 && (
                    <span style={{ background: "#f0945c", color: "white", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>
                      {pendingCount}
                    </span>
                  )}
                </div>
                {pendingCount > 0 && (
                  <button onClick={clearAll}
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", fontSize: 11, cursor: "pointer", padding: "2px 6px" }}>
                    Clear all
                  </button>
                )}
              </div>

              {/* Question list */}
              <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
                {questions.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "24px 0", color: "rgba(255,255,255,0.2)", fontSize: 12 }}>
                    No questions yet
                  </div>
                ) : (
                  questions.map((q) => (
                    <div key={q.id}
                      style={{
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

      {/* THUMBNAIL STRIP */}
      <div style={{ display: "flex", gap: 6, padding: "8px 16px", overflowX: "auto", background: "rgba(0,0,0,0.4)", borderTop: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
        {images.map((img, i) => (
          <button key={i} onClick={() => setCurrent(i)}
            style={{ border: i === current ? "2px solid #f0945c" : "2px solid transparent", borderRadius: 4, overflow: "hidden", cursor: "pointer", padding: 0, background: "none", flexShrink: 0, opacity: i === current ? 1 : 0.4, transition: "opacity 0.15s, border-color 0.15s" }}>
            <img src={img} alt={`Slide ${i + 1}`} style={{ height: 44, width: "auto", display: "block" }} />
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

export default function LectureLife() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatContent, setChatContent] = useState(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [presentMode, setPresentMode] = useState(false);
  const [studentUrl, setStudentUrl] = useState(null);
  const socketRef = useRef(null);

  const resetApp = () => {
    setImages([]);
    setChatContent(null);
    setPresentMode(false);
    if (socketRef.current) socketRef.current.disconnect();
    socketRef.current = null;
    setStudentUrl(null);
  };

  const startPresenting = async () => {
    const socket = io(LOCAL_SERVER);
    socketRef.current = socket;
    socket.emit("upload-slides", images);
    try {
      const res = await fetch(`${LOCAL_SERVER}/info`);
      const { ip, port } = await res.json();
      setStudentUrl(`http://${ip}:${port}/student`);
    } catch {
      setStudentUrl(`${LOCAL_SERVER}/student`);
    }
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
      setImages(pages);
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const enhanceSlide = (img) => {
    setPendingImage(img);
    setChatContent({
      status: "select-mode",
      image: img,
      text: "What type of interactive style do you want?",
    });
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

    setChatContent({
      status: "loading",
      image: pendingImage,
      text: null,
      lines: [statusSteps[0]],
    });

    const timers = statusSteps.slice(1).map((step, index) =>
      setTimeout(() => {
        setChatContent((prev) => {
          if (!prev || prev.status !== "loading") return prev;
          const existing = Array.isArray(prev.lines) ? prev.lines : [];
          return { ...prev, lines: [...existing, step] };
        });
      }, 700 * (index + 1))
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

      if (!res.ok) {
        throw new Error("Backend error");
      }

      setChatContent({ status: "done", image: pendingImage, text: "Create interactive slide..." });
      setPendingImage(null);
    } catch {
      setChatContent({ status: "error", image: pendingImage, text: "Error sending to backend" });
    } finally {
      timers.forEach(clearTimeout);
    }
  };

  return (
    <>
      {presentMode && (
        <PresentOverlay
          images={images}
          socket={socketRef.current}
          studentUrl={studentUrl}
          onClose={() => setPresentMode(false)}
        />
      )}

      <div css={bg} className="p-6 flex gap-6">
        <Leaf style={{ top: "10%", left: "5%" }} />
        <Leaf style={{ top: "30%", right: "5%" }} />
        <Leaf style={{ bottom: "10%", left: "10%" }} />

        <div className="flex-1">
          <div className="flex justify-between mb-8">
            <h1 className="text-2xl font-bold text-orange-600">LectureLife</h1>
            {images.length > 0 && (
              <button onClick={resetApp} className="px-4 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300">← Back</button>
            )}
          </div>

          {loading && <Spinner />}

          {!loading && images.length === 0 && (
            <div className="max-w-3xl mx-auto">
              <label className="block border-2 border-dashed border-orange-300 rounded-2xl p-16 text-center bg-white cursor-pointer">
                <p className="text-orange-600 font-semibold text-lg">Drop your lecture recording here</p>
                <p className="text-sm text-gray-400 mt-2">or click to browse • PDF only</p>
                <input type="file" onChange={handleUpload} className="hidden" />
              </label>
              <button className="w-full mt-6 bg-orange-600 text-white py-4 rounded-xl">✦ Transform & Go Live</button>
            </div>
          )}

          {!loading && images.length > 0 && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={img} className="rounded-xl shadow" alt={`Slide ${i + 1}`} />
                    <button
                      onClick={() => enhanceSlide(img)}
                      className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: "linear-gradient(135deg,#e05c2a,#f0945c)" }}
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

        {chatContent && (
          <div className="w-80 bg-white p-4 rounded-xl shadow sticky top-6 h-fit">
            <h3 className="text-orange-600 font-semibold mb-3">AI Assistant</h3>
            {chatContent.image && <img src={chatContent.image} alt="Slide" className="rounded-lg mb-3" />}
            {chatContent.status === "loading" && (
              <div className="space-y-1">
                {(Array.isArray(chatContent.lines) ? chatContent.lines : ["Working..."]).map((line, idx) => (
                  <p key={idx} className="text-orange-400 animate-pulse text-sm">
                    {line}
                  </p>
                ))}
              </div>
            )}
            {chatContent.status === "select-mode" && (
              <div className="space-y-2">
                <p className="text-sm text-gray-700">{chatContent.text}</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => sendToAgent1("Quiz")} className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Quiz</button>
                  <button onClick={() => sendToAgent1("Game")} className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Game</button>
                  <button onClick={() => sendToAgent1("Storymode / Walkthrough")} className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Storymode / Walkthrough</button>
                  <button onClick={() => sendToAgent1("Explore mode")} className="px-3 py-2 rounded-lg bg-orange-100 text-orange-700">Explore mode</button>
                </div>
              </div>
            )}
            {chatContent.status === "done" && <p className="text-sm text-gray-700 whitespace-pre-wrap">{chatContent.text}</p>}
            {chatContent.status === "error" && <p className="text-red-500 text-sm">{chatContent.text}</p>}
          </div>
        )}
      </div>
    </>
  );
}
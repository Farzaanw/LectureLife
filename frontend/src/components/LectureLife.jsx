import React, { useState } from "react";
import { css } from "@emotion/react";
import * as pdfjsLib from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

/* BACKGROUND + ANIMATION */
const bg = css`
  background: linear-gradient(180deg, #fcebea 0%, #f7cfc5 60%, #f4b6a8 100%);
  min-height: 100vh;
  position: relative;

  @keyframes float1 {
    0% { transform: translateY(0px); }
    50% { transform: translateY(-20px); }
    100% { transform: translateY(0px); }
  }

  @keyframes float2 {
    0% { transform: translateY(0px); }
    50% { transform: translateY(15px); }
    100% { transform: translateY(0px); }
  }
`;

/* LEAF WITH ANIMATION */
const Leaf = ({ style, variant = 1 }) => (
  <svg
    style={{
      position: "fixed",
      opacity: 0.12,
      pointerEvents: "none",
      animation: `${variant === 1 ? "float1" : "float2"} 6s ease-in-out infinite`,
      ...style,
    }}
    width="50"
    height="80"
    viewBox="0 0 48 80"
  >
    <path d="M24 2 C24 2 46 20 46 42 C46 62 35 78 24 78 C13 78 2 62 2 42 C2 20 24 2 24 2Z" fill="#d96a3a" />
  </svg>
);

/* SPINNER */
const Spinner = () => (
  <div className="flex flex-col items-center justify-center mt-20">
    <div className="w-14 h-14 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin"></div>
    <p className="mt-4 text-orange-600 font-semibold">Processing your slides...</p>
  </div>
);

export default function LectureLife() {
  const [images, setImages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [chatContent, setChatContent] = useState(null);

  const resetApp = () => {
    setImages([]);
    setChatContent(null);
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

  const enhanceSlide = async (img) => {
    setChatContent({
      status: "loading",
      image: img,
      text: null,
    });

    try {
      const jpegBase64 = img.replace("image/png", "image/jpeg").split(",")[1];

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: jpegBase64,
                  },
                },
                {
                  type: "text",
                  text: "Summarize this slide clearly with key points.",
                },
              ],
            },
          ],
        }),
      });

      const data = await res.json();

      setChatContent({
        status: "done",
        image: img,
        text: data.content?.[0]?.text || "No response",
      });
    } catch {
      setChatContent({
        status: "error",
        image: img,
        text: "Error analyzing slide",
      });
    }
  };

  return (
    <div css={bg} className="p-6">

      {/* 🌿 MORE LEAVES WITH MOTION */}
      <Leaf style={{ top: "10%", left: "5%" }} />
      <Leaf style={{ top: "30%", right: "5%" }} variant={2} />
      <Leaf style={{ bottom: "10%", left: "10%" }} />

      {/* NEW ONES */}
      <Leaf style={{ top: "60%", left: "3%" }} variant={2} />
      <Leaf style={{ top: "75%", right: "6%" }} />
      <Leaf style={{ bottom: "25%", right: "3%" }} variant={2} />

      {/* HEADER */}
      <div className="flex justify-between mb-8">
        <h1 className="text-2xl font-bold text-orange-600">LectureLife</h1>

        {images.length > 0 && (
          <button
            onClick={resetApp}
            className="px-4 py-2 bg-gray-200 rounded-full text-gray-700 hover:bg-gray-300"
          >
            ← Back
          </button>
        )}
      </div>

      {loading && <Spinner />}

      {!loading && images.length === 0 && (
        <div className="max-w-3xl mx-auto">
          <label className="block border-2 border-dashed border-orange-300 rounded-2xl p-16 text-center bg-white cursor-pointer">
            <p className="text-orange-600 font-semibold text-lg">
              Drop your lecture recording here
            </p>
            <p className="text-sm text-gray-400 mt-2">
              or click to browse • PDF only
            </p>
            <input type="file" onChange={handleUpload} className="hidden" />
          </label>

          <button className="w-full mt-6 bg-orange-600 text-white py-4 rounded-xl">
            ✦ Transform & Go Live
          </button>
        </div>
      )}

      {!loading && images.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {images.map((img, i) => (
            <div key={i} className="relative group">
              <img src={img} className="rounded-xl shadow" />

              <button
                onClick={() => enhanceSlide(img)}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-white text-xs opacity-0 group-hover:opacity-100"
                style={{
                  background: "linear-gradient(135deg,#e05c2a,#f0945c)",
                }}
              >
                ✦ Enhance
              </button>
            </div>
          ))}
        </div>
      )}

      {chatContent && (
        <div className="fixed right-6 top-20 w-80 bg-white p-4 rounded-xl shadow">
          <h3 className="text-orange-600 font-semibold mb-3">AI Assistant</h3>

          {chatContent.image && (
            <img src={chatContent.image} className="rounded-lg mb-3" />
          )}

          {chatContent.status === "loading" && (
            <p className="text-orange-400 animate-pulse">Analyzing slide...</p>
          )}

          {chatContent.status === "done" && (
            <p className="text-sm text-gray-700 whitespace-pre-wrap">
              {chatContent.text}
            </p>
          )}

          {chatContent.status === "error" && (
            <p className="text-red-500 text-sm">{chatContent.text}</p>
          )}
        </div>
      )}
    </div>
  );
}
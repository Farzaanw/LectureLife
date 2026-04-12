import React from "react";
 
export default function LeafIcon({ size = 40, className = "" }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M40 10 C60 0, 78 15, 75 40 C72 60, 55 72, 40 80 C25 72, 8 60, 5 40 C2 15, 20 0, 40 10Z"
        fill="#6B8F71"
      />
      <path d="M40 18 L40 72" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M40 30 L28 22" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 30 L52 22" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 40 L25 33" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 40 L55 33" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 50 L28 44" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 50 L52 44" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 60 L32 55" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 60 L48 55" stroke="white" strokeWidth="0.8" strokeLinecap="round" />
      <path d="M40 72 L40 90" stroke="#8D6E63" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
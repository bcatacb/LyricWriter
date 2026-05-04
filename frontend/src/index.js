import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

// Wavesurfer's async teardown throws AbortError when it's destroyed
// before audio load/decoding completes (common with React 19 StrictMode
// double-mounting in dev). These are harmless — suppress globally.
if (typeof window !== "undefined") {
    window.addEventListener("unhandledrejection", (e) => {
        if (e?.reason?.name === "AbortError") {
            e.preventDefault();
        }
    });
    window.addEventListener("error", (e) => {
        if (e?.error?.name === "AbortError") {
            e.preventDefault();
        }
    });
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

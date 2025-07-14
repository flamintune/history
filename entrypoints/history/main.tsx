import React from "react";
import { createRoot } from "react-dom/client";
import HistoryTimeline from "./HistoryTimeline";
import "@/styles/globals.css";

const root = createRoot(document.getElementById("app")!);
root.render(
  <React.StrictMode>
    <HistoryTimeline />
  </React.StrictMode>
);

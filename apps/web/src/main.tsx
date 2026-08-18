import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ThemeProvider } from "next-themes";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import { App } from "./App.js";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="vm-theme">
      <App />
    </ThemeProvider>
  </StrictMode>,
);

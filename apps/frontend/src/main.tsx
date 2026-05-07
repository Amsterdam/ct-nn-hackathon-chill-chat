import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@amsterdam/design-system-tokens/dist/index.css";
import "./styles/theme.css";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

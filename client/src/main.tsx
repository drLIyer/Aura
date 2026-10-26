import { createRoot } from "react-dom/client";
import App from "./App";
import { IS_DEMO } from "./lib/demo";
import "./index.css";

async function boot() {
  if (IS_DEMO) {
    const { startDemo, syncTheme } = await import("./demo/demoServer");
    syncTheme();
    await startDemo();
  }
  createRoot(document.getElementById("root")!).render(<App />);
}

void boot();

import { createApp } from "./app";
import { authMode, setupAuth } from "./auth";
import { createStorage } from "./storage";
import { log, serveStatic, setupVite } from "./vite";

(async () => {
  const storage = await createStorage();
  const mode = authMode();
  const { app, server } = await createApp({ storage, authMode: mode, beforeRoutes: setupAuth });

  // Vite in development, built files in production; set up after the API so its catch-all doesn't shadow it.
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({ port, host: "0.0.0.0", reusePort: true }, () => log(`serving on port ${port}`));
})();

import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API routes FIRST
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/proxy/gsheet", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Missing url parameter" });
      }

      // Extract sheet ID from standard google sheets url
      // Example: https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit
      const idMatch = url.match(/\/d\/([a-zA-Z0-9-_]+)/);
      if (!idMatch || idMatch.length < 2) {
        return res.status(400).json({ error: "Invalid Google Sheets URL" });
      }

      const sheetId = idMatch[1];
      const exportUrl = `https://docs.google.com/spreadsheets/export?id=${sheetId}&exportFormat=xlsx`;

      const response = await fetch(exportUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch from Google Sheets: ${response.status} ${response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="sheet-${sheetId}.xlsx"`);
      res.send(buffer);
    } catch (e: any) {
      console.error('GSheet Proxy Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/proxy/html", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "Missing url parameter" });
      }
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      res.send(html);
    } catch (e: any) {
      console.error('HTML Proxy Error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

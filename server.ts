import express from "express";
import cors from "cors";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Initialize SDK with the key
  const apiKey = process.env.Gemini_API_Key1 || process.env.CUSTOM_GEMINI_API_KEY || process.env.GEMINI_API_KEY || "AIzaSyCjgg2tLtwk1cKTfGDrVVdqbd-PwQBWPdM";
  const ai = new GoogleGenAI({ apiKey });

  // Generic proxy endpoint for all gemini calls
  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const response = await ai.models.generateContent({
        model: model || "gemini-2.5-flash",
        contents,
        config
      });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error.message || error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Stream proxy endpoint
  app.post("/api/gemini/generateContentStream", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      console.log("RECEIVED CONTENTS:", JSON.stringify(contents).substring(0, 500));
      const responseStream = await ai.models.generateContentStream({
        model: model || "gemini-2.5-flash",
        contents,
        config
      });
      
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      for await (const chunk of responseStream) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Gemini Proxy Stream Error:", error.message || error);
      res.write(`data: ${JSON.stringify({ error: error.message || "Internal Server Error" })}\n\n`);
      res.end();
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
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

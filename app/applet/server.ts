import express from "express";
import cors from "cors";
import path from "path";
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

  const executeWithFallback = async (model: string, contents: any, config: any, stream: boolean) => {
    const modelsToTry = [model];
    
    // Add fallbacks based on requested model
    if (model.includes('pro')) {
      modelsToTry.push('gemini-1.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash');
    } else {
      modelsToTry.push('gemini-2.0-flash', 'gemini-1.5-flash');
    }

    let lastError;
    
    for (const currentModel of modelsToTry) {
      try {
        if (stream) {
           return await ai.models.generateContentStream({
             model: currentModel,
             contents,
             config
           });
        } else {
           return await ai.models.generateContent({
             model: currentModel,
             contents,
             config
           });
        }
      } catch (err: any) {
        lastError = err;
        const msg = err.message || String(err);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('quota')) {
          console.warn(`Quota exceeded for ${currentModel}, falling back to next available model...`);
          continue; // Try next model
        }
        throw err; // For non-429 errors, throw immediately
      }
    }
    
    throw lastError; // If all failed, throw the last error (likely 429 on all)
  };

  // Generic proxy endpoint for all gemini calls
  app.post("/api/gemini/generateContent", async (req, res) => {
    try {
      const { model, contents, config } = req.body;
      const response: any = await executeWithFallback(model || "gemini-2.5-flash", contents, config, false);
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
      
      const responseStream: any = await executeWithFallback(model || "gemini-2.5-flash", contents, config, true);
      
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
      // Determine if headers are sent. If not, we can still standard 500 maybe? Better catch it.
      if (!res.headersSent) {
         res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
         res.flushHeaders();
      }
      res.write(`data: ${JSON.stringify({ error: error.message || "Internal Server Error" })}\n\n`);
      res.end();
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await import("vite");
    const viteServer = await vite.createServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
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

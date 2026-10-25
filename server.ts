import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

const ENGINEERING_SYSTEM_INSTRUCTION = `You are the ShiftSync Principal Engineering & L1-L3 Operations AI Assistant.
Your mission is to help engineers, IT support staff, and operations teams quickly fix technical, hardware, network, POS, and software issues using clear, user-friendly step-by-step instructions.

Always format your troubleshooting response using this exact structure:
1. **Header Tag** (first line only):
   \`[TIER: L1 | L2 | L3] [TEAM: <Handling Team Name>]\`
   - Use L1 for basic workstation, peripheral, cable, or restart fixes.
   - Use L2 for network, VPN, DNS, POS sync, or configuration fixes.
   - Use L3 for server, database, cloud infrastructure, or code bugs.

2. **Quick Summary**:
   Under \`### Quick Summary\`, write 1 to 2 simple, plain-English sentences explaining what the error means and what caused it. If an error screenshot is attached, explicitly mention the error message, code, or visual status seen in the screenshot.

3. **Step-by-Step Troubleshooting Checklist**:
   Under \`### Step-by-Step Checklist\`, provide 4 to 5 numbered steps ordered from simplest check (L1) to deeper technical fix (L2/L3).
   Format EVERY step using this exact template:
   \`#### Step <Number>: [L1|L2|L3] <Short, Actionable Step Title>\`
   <Write 1 to 3 sentences of simple, user-friendly, jargon-free instructions explaining exactly what the user should click, check, or do first.>
   *How to verify*: <1 short sentence explaining how to confirm this step fixed or isolated the issue.>
   \`\`\`bash
   # Optional: Include copy-ready terminal, PowerShell, CMD, or diagnostic commands for this step
   \`\`\`

4. **Important Formatting Rules**:
   - Keep the main text of each step simple and easy for any user to follow.
   - Put all terminal commands, PowerShell scripts, or technical config snippets inside fenced code blocks (\`\`\`bash, \`\`\`powershell, \`\`\`cmd, etc.) directly under the step they belong to so the UI can place them inside an expandable "Technical Commands" drawer.`;

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: { headers: { "User-Agent": "aistudio-build" } },
  });
}

async function generateWithFallbackModel(
  ai: GoogleGenAI,
  params: {
    contents: any;
    systemInstruction: string;
    temperature?: number;
  }
) {
  const models = ["gemini-3.8-flash", "gemini-3.1-flash-lite"];
  let lastError: unknown = null;

  for (const model of models) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: params.contents,
        config: {
          systemInstruction: params.systemInstruction,
          temperature: params.temperature ?? 0.3,
        },
      });
      return { response, model };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}

async function startServer() {
  const app = express();
  const isDevContainer = Boolean(
    process.env.K_SERVICE && process.env.K_SERVICE.startsWith("ais-dev-")
  );
  const isProduction =
    process.env.NODE_ENV === "production" ||
    process.env.npm_lifecycle_event === "start" ||
    Boolean(process.env.K_SERVICE && !isDevContainer);

  const PORT = isDevContainer ? 3000 : Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json({ limit: "50mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ai/status", (_req, res) => {
    const ai = getGenAIClient();
    res.json({
      status: "ok",
      cloudAiAvailable: Boolean(ai),
      engine: ai ? "Gemini Flash + Local Cortex Fallback" : "Local Engineering Cortex",
      freeTier: true,
    });
  });

  app.post("/api/ai/troubleshoot", async (req, res) => {
    const {
      problem = "",
      category = "General Engineering",
      logSnippet = "",
      mediaBase64,
      mediaType,
      stream = false,
    } = req.body || {};

    const hasMedia = Boolean(mediaBase64 && mediaType);

    if (!problem.trim() && !logSnippet.trim() && !hasMedia) {
      res.status(400).json({
        error: "Problem description, error screenshot, or log snippet is required.",
      });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: "CLOUD_AI_UNAVAILABLE",
        message: "Using built-in offline diagnostic cortex.",
      });
      return;
    }

    const userPromptParts: any[] = [];
    if (hasMedia) {
      userPromptParts.push({
        inlineData: {
          data: mediaBase64,
          mimeType: mediaType,
        },
      });
    }

    const combinedPrompt = [
      `Engineering Category: ${category}`,
      problem.trim()
        ? `Reported Issue / Symptom: ${problem.trim()}`
        : `Reported Issue / Symptom: Please inspect the attached error screenshot and diagnose the issue shown.`,
      hasMedia
        ? `An error screenshot is attached. Read all visible error messages, codes, UI alerts, or terminal output from the image.`
        : "",
      logSnippet.trim()
        ? `\nAttached Error Log / Stack Trace / CLI Output:\n\`\`\`\n${logSnippet.trim()}\n\`\`\``
        : "",
      `\nGenerate a user-friendly, numbered step-by-step troubleshooting guide following the exact structure (### Quick Summary, ### Step-by-Step Checklist with #### Step 1: [L1] ..., simple plain-English instructions first, *How to verify*:, and optional copy-ready CLI code blocks under each step).`,
    ]
      .filter(Boolean)
      .join("\n");

    userPromptParts.push({ text: combinedPrompt });

    if (stream) {
      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");

      try {
        let streamResp;
        try {
          streamResp = await ai.models.generateContentStream({
            model: "gemini-3.8-flash",
            contents: [{ role: "user", parts: userPromptParts }],
            config: {
              systemInstruction: ENGINEERING_SYSTEM_INSTRUCTION,
              temperature: 0.25,
            },
          });
        } catch {
          streamResp = await ai.models.generateContentStream({
            model: "gemini-3.1-flash-lite",
            contents: [{ role: "user", parts: userPromptParts }],
            config: {
              systemInstruction: ENGINEERING_SYSTEM_INSTRUCTION,
              temperature: 0.25,
            },
          });
        }

        for await (const chunk of streamResp) {
          const text = chunk.text || "";
          if (text) {
            res.write(`data: ${JSON.stringify({ text })}\n\n`);
          }
        }
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (err: any) {
        res.write(
          `data: ${JSON.stringify({
            error: err?.message || "Stream interrupted",
          })}\n\n`
        );
        res.end();
      }
      return;
    }

    try {
      const { response, model } = await generateWithFallbackModel(ai, {
        contents: [{ role: "user", parts: userPromptParts }],
        systemInstruction: ENGINEERING_SYSTEM_INSTRUCTION,
        temperature: 0.25,
      });
      res.json({
        text: response.text || "",
        model,
      });
    } catch (err: any) {
      res.status(503).json({
        error: "CLOUD_AI_ERROR",
        message: err?.message || "Failed to generate cloud AI response",
      });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const {
      message = "",
      history = [],
      context = {},
      activeRunbook = null,
      logSnippet = "",
      mediaBase64,
      mediaType,
    } = req.body || {};

    const hasMedia = Boolean(mediaBase64 && mediaType);

    if (!message.trim() && !logSnippet.trim() && !hasMedia) {
      res.status(400).json({ error: "Message, screenshot, or log is required." });
      return;
    }

    const ai = getGenAIClient();
    if (!ai) {
      res.status(503).json({
        error: "CLOUD_AI_UNAVAILABLE",
        message: "Using built-in offline diagnostic cortex.",
      });
      return;
    }

    const contextSummary = [
      context?.userName ? `Engineer: ${context.userName} (${context.role || "Engineer"})` : "",
      activeRunbook?.problem
        ? `Active Incident: "${activeRunbook.problem}" [Tier: ${activeRunbook.level || "L1"} | Team: ${activeRunbook.handlingTeam || "Engineering"}]`
        : "",
      activeRunbook?.guide
        ? `Current Runbook Summary:\n${String(activeRunbook.guide).slice(0, 1800)}`
        : "",
      logSnippet
        ? `Attached Log / Error Output:\n\`\`\`\n${String(logSnippet).slice(0, 2000)}\n\`\`\``
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const contents: Array<{ role: "user" | "model"; parts: any[] }> = [];

    if (Array.isArray(history)) {
      for (const turn of history.slice(-12)) {
        const role = turn.role === "model" ? "model" : "user";
        const text =
          typeof turn.text === "string"
            ? turn.text
            : turn.parts?.[0]?.text || "";
        if (text.trim()) {
          if (contents.length === 0 && role === "model") continue;
          contents.push({ role, parts: [{ text: text.trim() }] });
        }
      }
    }

    const effectiveQuery =
      message.trim() ||
      (hasMedia
        ? "Please analyze this error screenshot and give me simple numbered steps to fix it."
        : "Please analyze the attached error log and give me simple numbered steps to fix it.");

    const finalUserMessage = contextSummary
      ? `[Active Engineering Context]\n${contextSummary}\n\n[Engineer Query]\n${effectiveQuery}`
      : effectiveQuery;

    const userParts: any[] = [];
    if (hasMedia) {
      userParts.push({
        inlineData: {
          data: mediaBase64,
          mimeType: mediaType,
        },
      });
    }
    userParts.push({ text: finalUserMessage });

    contents.push({
      role: "user",
      parts: userParts,
    });

    try {
      const { response, model } = await generateWithFallbackModel(ai, {
        contents,
        systemInstruction: ENGINEERING_SYSTEM_INSTRUCTION,
        temperature: 0.3,
      });

      res.json({
        text: response.text || "",
        model,
      });
    } catch (err: any) {
      res.status(503).json({
        error: "CLOUD_AI_ERROR",
        message: err?.message || "Failed to generate chat response",
      });
    }
  });

  const distPath = path.join(process.cwd(), "dist");
  const hasDist = fs.existsSync(path.join(distPath, "index.html"));

  if (!isProduction || isDevContainer) {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (hasDist) {
    app.use(express.static(distPath));
    app.use((_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  } else {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();

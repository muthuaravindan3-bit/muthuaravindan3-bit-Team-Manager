import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function test() {
  const blob = new Blob(["test"], { type: 'text/plain' });
  const file = await ai.files.upload({ file: blob, config: { mimeType: 'text/plain' } });
  console.log(file);
}
test();

import { GoogleGenAI } from "@google/genai";
const apiKey = "AIzaSyCjgg2tLtwk1cKTfGDrVVdqbd-PwQBWPdM" || process.env.Gemini_API_Key1 || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey });
async function test() {
  const blob = new Blob(["test"], { type: 'text/plain' });
  const file = await ai.files.upload({ file: blob, config: { mimeType: 'text/plain' } });
  console.log(file);
}
test();

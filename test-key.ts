import { GoogleGenAI } from "@google/genai";
const ai = new GoogleGenAI({ apiKey: "AIzaSyCjgg2tLtwk1cKTfGDrVVdqbd-PwQBWPdM" });
async function test() {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: "Hello"
    });
    console.log("Success:", !!response.text);
  } catch (e) {
    console.error("Error:", e.message);
  }
}
test();

import { GoogleGenAI } from "@google/genai";
export async function test() {
  console.log("Using API Key:", process.env.VITE_GEMINI_API_KEY || "AIzaSyCjgg2tLtwk1cKTfGDrVVdqbd-PwQBWPdM");
}

import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TroubleshootingResult {
  guide: string;
  level: "L1" | "L2" | "L3";
  handlingTeam: string;
}

export async function getTroubleshootingSteps(problem: string, mediaData?: { data: string, mimeType: string }): Promise<TroubleshootingResult> {
  const contents: any[] = [{ text: `Troubleshoot this technical problem: "${problem}". 
    Provide an extremely detailed, exhaustive step-by-step guide. 
    Break it down into:
    1. Immediate First Response Steps.
    2. Detailed Diagnosis Methods.
    3. Step-by-Step Resolution Guide.
    4. Post-Resolution Verification.
    5. Prevention Strategies for the future.
    Also determine the severity level (L1, L2, or L3) and specify which team (e.g., IT Support, Network Team, Dev Ops) should handle it.`
  }];

  if (mediaData) {
    contents.push({
      inlineData: {
        mimeType: mediaData.mimeType,
        data: mediaData.data
      }
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          guide: {
            type: Type.STRING,
            description: "Detailed step-by-step troubleshooting guide."
          },
          level: {
            type: Type.STRING,
            enum: ["L1", "L2", "L3"],
            description: "The severity level of the problem."
          },
          handlingTeam: {
            type: Type.STRING,
            description: "The team that should handle this problem."
          }
        },
        required: ["guide", "level", "handlingTeam"]
      }
    }
  });

  if (!response.text) {
    throw new Error("No response from AI");
  }

  return JSON.parse(response.text.trim()) as TroubleshootingResult;
}

export interface ExtractedShift {
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: string;
}

export async function extractShiftsFromImage(base64Image: string, teamMembers: {uid: string, name: string}[]): Promise<ExtractedShift[]> {
  const membersList = teamMembers.map(m => `${m.name} (ID: ${m.uid})`).join(", ");
  
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: base64Image
        }
      },
      {
        text: `Extract shift information from this roster image. 
        Map the names in the image to these team members: ${membersList}.
        If a name doesn't match perfectly, use the closest match from the provided list.
        Dates should be in YYYY-MM-DD format. Times should be in 24-hour HH:mm format.
        
        Mandatory Mapping Rules:
        - "1st" in image maps to "Morning" (07:30 to 16:30).
        - "2nd" in image maps to "2nd Shift" (12:30 to 20:30).
        - "3rd" in image maps to "Night" (20:30 to 07:30 [next day]).
        - "G" in image maps to "General" (09:00 to 18:00).
        - "WO" maps to "WO" type (00:00 to 00:00).
        - "CO" maps to "CO" type (00:00 to 00:00).
        - "CH" maps to "CH" type (00:00 to 00:00).
        - "AL" maps to "AL" type (00:00 to 00:00).
        
        If a year isn't specified, assume 2026.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            userName: { type: Type.STRING },
            date: { type: Type.STRING },
            startTime: { type: Type.STRING },
            endTime: { type: Type.STRING },
            type: { type: Type.STRING }
          },
          required: ["userName", "date", "startTime", "endTime", "type"]
        }
      }
    }
  });

  if (!response.text) {
    throw new Error("Failed to extract data from image");
  }

  return JSON.parse(response.text.trim()) as ExtractedShift[];
}

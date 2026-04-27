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

export async function sendChatMessage(history: Array<{role: string, parts: any[]}>, message: string): Promise<string> {
  const chat = ai.chats.create({
    model: "gemini-3.1-pro-preview",
    history: history as any,
    config: {
      systemInstruction: "You are the Team Manager AI. Assist the user with app-related questions, scheduling, and guidance. Keep it concise, friendly, and practical.",
    }
  });

  const response = await chat.sendMessage({ message });
  return response.text || "";
}

export interface ExtractedShift {
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  type: string;
}

export async function extractShiftsFromImage(base64Image: string, mimeType: string, teamMembers: {uid: string, name: string}[]): Promise<ExtractedShift[]> {
  const membersList = teamMembers.map(m => `Name: "${m.name}", ID: "${m.uid}"`).join(" | ");
  
  // Convert base64 to Blob for uploading
  const byteCharacters = atob(base64Image);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], {type: mimeType || 'image/jpeg'});

  // Upload file to Gemini File API
  let uploadedFile;
  try {
    uploadedFile = await ai.files.upload({
      file: blob, 
      config: { mimeType: mimeType || 'image/jpeg' }
    });
  } catch (err: any) {
    console.warn("Failed to upload via files API, falling back to inlineData", err);
  }
  
  const imageDataPart = uploadedFile ? {
    fileData: {
      fileUri: uploadedFile.uri,
      mimeType: uploadedFile.mimeType
    }
  } : {
    inlineData: {
      mimeType: mimeType || "image/jpeg",
      data: base64Image
    }
  };

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: [
      imageDataPart,
      {
        text: `Extract the shift roster from this image into a structured format.
        Follow these instructions exactly:
        1. Examine EVERY row (each person) and EVERY column (each date/day). Calculate dates from column headers. If year is missing, use current year.
        2. For EVERY single cell that contains a shift code, create a corresponding shift object. DO NOT summarize or group them.
        3. Do NOT skip any rows, columns, or data points. Completeness is critical.
        
        ${membersList ? `Map the names in the rows entirely to these team members using their ID: ${membersList}.` : 'No team members provided, use the names exactly as they appear in the image.'}
        If a name doesn't match perfectly, select the closest matching team member ID. If absolutely no match, set userId to "unknown".
        
        Dates MUST be in YYYY-MM-DD format.
        Times MUST be in 24-hour HH:mm format.
        
        Mapping Rules for Shift Codes:
        - "1" or "1st" or "M" -> "Morning" (07:30 to 16:30)
        - "2" or "2nd" or "A" -> "2nd Shift" (12:30 to 20:30)
        - "3" or "3rd" or "N" -> "Night" (20:30 to 07:30)
        - "G" or "Gen" or "Contract" -> "General" (09:00 to 18:00)
        - "WO" or "Off" -> "WO" (00:00 to 00:00)
        - "CO" -> "CO" (00:00 to 00:00)
        - "CH" -> "CH" (00:00 to 00:00)
        - "AL" or "Leave" -> "AL" (00:00 to 00:00)
        - Any unrecognized code -> map to the closest type based on context.
        
        If times are missing for a code, use the standard times listed above.
        
        Double check your work. EVERY valid shift assignment cell MUST result in an object.`
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          shifts: {
            description: "The complete, exhaustive list of all extracted shifts.",
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                userId: { type: Type.STRING, description: "The ID of the user" },
                userName: { type: Type.STRING },
                date: { type: Type.STRING },
                startTime: { type: Type.STRING },
                endTime: { type: Type.STRING },
                type: { type: Type.STRING }
              },
              required: ["userId", "userName", "date", "startTime", "endTime", "type"]
            }
          }
        },
        required: ["shifts"]
      }
    }
  });

  console.log("Raw Gemini Response:", response.text);

  if (!response.text) {
    throw new Error("Failed to extract data from image");
  }

  const rawText = response.text.trim();
  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    console.error("Failed to parse JSON:", rawText);
    return [];
  }
  
  let shifts: ExtractedShift[] = [];
  
  if (parsed && typeof parsed === 'object') {
    shifts = parsed.shifts || [];
  }

  console.log(`Parsed ${shifts?.length || 0} items`);
  return shifts;
}

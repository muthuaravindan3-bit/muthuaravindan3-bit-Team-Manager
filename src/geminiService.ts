
import { GoogleGenAI } from "@google/genai";

// Initialize the GoogleGenAI instance for client-side usage.
// AI Studio will automatically intercept these calls and handle the API key injection.
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Global Error Interceptor for AI calls to handle Quota Exceeded elegantly
const originalGenerateContent = ai.models.generateContent.bind(ai.models);
ai.models.generateContent = async (params: any): Promise<any> => {
  try {
    return await originalGenerateContent(params);
  } catch (err: any) {
    const errMsg = String(err?.message || err);
    if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || err?.status === 429 || errMsg.toLowerCase().includes('quota')) {
      console.warn("AI Quota Exceeded. Returning generic fallback data to prevent UI crash.", errMsg.substring(0, 50));
      
      const isJsonExpected = params?.config?.responseMimeType === 'application/json';
      
      if (!isJsonExpected) {
        return {
          text: "AI QUOTA EXCEEDED. The cortex has temporarily suspended predictive operations due to resource constraints. Please provide a new API key or wait for the quota to reset."
        };
      }

      return {
        text: JSON.stringify({
          error: "AI Quota Exceeded. Using standard operational parameters.",
          guide: "AI Quota Exceeded. Please check billing or wait.",
          level: "L1",
          handlingTeam: "Admin",
          headline: "AI Quota Exceeded: Displaying Standard Briefing",
          situationReport: "The tactical AI cortex is currently offline due to quota restrictions. Operations are running under standard parameters. Ensure all mission-critical tasks observe normal protocols.",
          riskStatus: "elevated",
          personnelStatus: "Stable",
          keyDirectives: ["Observe standard operations", "Monitor manual channels"],
          personnelMorale: "Steady",
          criticalAlerts: ["AI forecasting is temporarily suspended. Check billing limits."],
          summary: "AI Offline. Standard parameters active.",
          recommendations: ["Wait for quota reset"],
          anomalies: [],
          efficiencyScore: 50,
          riskLevel: "medium",
          workloadProjection: "stable",
          burnoutRiskTimeline: "Unknown (AI Offline)",
          resourceBottleneck: "Data Unavailable",
          strategicRecommendations: ["Monitor channels manually"],
          rationale: "AI Quota Exceeded.",
          action: "none",
          targetTab: "overview",
          explanation: "AI functionality restricted.",
          suggestedUserIds: [],
          isCrisis: false,
          impact: 0,
          shifts: [],
          conflicts: [],
          wellnessTips: ["Remember to stay hydrated.", "AI quota resets eventually.", "Breathe."],
          dailyQuote: "Perseverance is the hard work you do after you get tired of doing the hard work you already did."
        })
      };
    }
    throw err;
  }
};

// Unified response model selection
const MODEL_NAME = "gemini-3.1-pro-preview";

function parseAIJson(text?: string | null, fallback: any = {}) {
  if (!text) return fallback;
  
  let result;
  try {
    result = JSON.parse(text);
  } catch (e) {
    try {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (match && match[1]) {
        result = JSON.parse(match[1]);
      } else {
        const firstCurly = text.indexOf('{');
        const lastCurly = text.lastIndexOf('}');
        const firstSquare = text.indexOf('[');
        const lastSquare = text.lastIndexOf(']');
        
        let startIdx = -1;
        let endIdx = -1;
        
        if (firstCurly !== -1 && lastCurly !== -1 && (firstSquare === -1 || firstCurly < firstSquare)) {
           startIdx = firstCurly;
           endIdx = lastCurly + 1;
        } else if (firstSquare !== -1 && lastSquare !== -1) {
           startIdx = firstSquare;
           endIdx = lastSquare + 1;
        }
        
        if (startIdx !== -1 && endIdx !== -1) {
           result = JSON.parse(text.substring(startIdx, endIdx));
        } else {
           console.error("Failed to parse AI JSON:", text.substring(0, 50) + "...");
           return fallback;
        }
      }
    } catch (e2) {
      console.error("Failed to parse AI JSON:", text.substring(0, 50) + "...");
      return fallback;
    }
  }

  if (Array.isArray(fallback) && !Array.isArray(result)) {
    if (result && typeof result === 'object') {
      const values = Object.values(result);
      const arrayVal = values.find(v => Array.isArray(v) && v.length > 0 && typeof v[0] === 'object');
      if (arrayVal) return arrayVal;
      return fallback;
    }
    return fallback;
  }

  return result;
}

// --- Types ---
export interface TroubleshootingResult {
  guide: string;
  level: "L1" | "L2" | "L3";
  handlingTeam: string;
}

export interface ExtractedShift {
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  confidenceScore: number;
}

export interface SuggestedRosterShift {
  userId: string;
  userName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: string;
  rationale: string;
}

export interface RosterConflictFix {
  shiftId: string;
  suggestedAction: string;
  newDate: string;
  newStartTime: string;
  newEndTime: string;
  rationale: string;
}

export interface TacticalBriefing {
  headline: string;
  situationReport: string;
  riskStatus: 'low' | 'elevated' | 'critical';
  personnelStatus: string;
  keyDirectives: string[];
  personnelMorale: string;
  criticalAlerts: string[];
}

export interface OperationalInsight {
  summary: string;
  recommendations: string[];
  anomalies: string[];
  efficiencyScore: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface StrategicForecast {
  workloadProjection: 'decreasing' | 'stable' | 'increasing';
  burnoutRiskTimeline: string;
  resourceBottleneck: string;
  strategicRecommendations: string[];
}

export interface PersonnelDossier {
  summary: string;
  traits: string[];
  reliabilityScore: number;
  operationalSpecialties: string[];
  psychologicalProfile: string;
}

export interface GlobalRiskIndex {
  overallRisk: number;
  status: string;
  primaryThreats: string[];
  mitigationProtocol: string;
  readinessRating: number;
  fatigueFactor: number;
  vulnerabilityAssessment: string;
  securityStatus: string;
}

export interface AuditIntelligence {
  summary: string;
  criticalEvents: string[];
  recommendations: string[];
  threatLevel: string;
  suspiciousPatterns: string[];
}

export interface SimulationResult {
  successProbability: number;
  expectedOutcome: string;
  riskVectors: string[];
  resourceImpact: {
    degradationFactor: number;
    recommendedAssets: string[];
  };
  risks: string[];
}

export interface MissionDebrief {
  summary: string;
  keyLearning: string;
  performanceRating: number;
  tacticalRating: number;
  executiveSummary: string;
  lessonsLearned: string[];
}

export interface TacticalDirectiveResponse {
  action: string;
  details: string;
  impact: string;
  lockdownActive: boolean;
  alertLevel: 'normal' | 'elevated' | 'critical';
  systemMessage: string;
  actionTaken: string;
}

export interface BroadcastOptimizationResponse {
  refinedMessage: string;
  toneAnalysis: string;
  impactRating: number;
}

// --- Functions ---

export async function generateGeneralInsight(prompt: string) {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
  });
  return response.text;
}

export async function* troubleshootStream(problem: string, mediaData?: any, context?: string): AsyncGenerator<string, void, unknown> {
  const promptText = `
You are the elite Diagnostic Cortex AI.
Context: ${context || 'None'}
Problem: ${problem}

You must provide a highly detailed, step-by-step resolution guide specifically tailored for an L1 Support Engineer. 
The explanation should be simple to understand, avoiding overly complex L3 jargon unless fully explained.

CRITICAL: BEFORE providing the final guide, you MUST output your internal reasoning process wrapped inside <thought>...</thought> tags.

In your final output (outside thought tags), ONLY include the step-by-step solution. Do not include incident summary, root cause hypothesis, or escalation criteria.
Format the solution as a highly detailed, actionable Markdown task list using "- [ ] " for interactive checklists.
Each step must clearly state WHAT to do, HOW to do it, and HOW to verify the step was successful.
`;
  const contents = mediaData ? { parts: [{ text: promptText }, { inlineData: mediaData }] } : promptText;

  const responseStream = await ai.models.generateContentStream({
    model: MODEL_NAME, // Flash model to handle quota
    contents: contents
  });

  for await (const chunk of responseStream) {
    yield chunk.text;
  }
}

export async function* chatWithCortexStream(message: string, history: any[], context: any, enableCoT: boolean = false) {
  const modelToUse = MODEL_NAME;
  
  let formattedHistory = "";
  if (history && history.length > 0) {
    formattedHistory = "Previous Conversation:\\n" + history.map(msg => `${msg.role === 'user' ? 'User' : 'Cortex'}: ${msg.content}`).join("\\n");
  }

  const systemInstruction = `You are Diagnostic Cortex, the elite tactical AI for Team Manager support and technical resolution.
Current User: ${context?.userName || 'Operator'} (${context?.role || 'Admin'}). 
System Status: ${context?.globalSettings?.systemStatus || 'Online'}.

Operational Directives:
- Provide highly detailed, actionable technical solutions.
- Maintain a professional, tactical, and efficient tone.
${enableCoT ? '- START YOUR RESPONSE WITH A SYSTEMATIC CHAIN OF THOUGHT. Wrap your thinking process in <thought> tags before answering.' : ''}`;

  const fullPrompt = `${formattedHistory}\\n\\nUser Request:\\n${message}`;

  const responseStream = await ai.models.generateContentStream({
    model: modelToUse,
    contents: fullPrompt,
    config: {
      systemInstruction
    }
  });

  for await (const chunk of responseStream) {
    yield chunk.text;
  }
}

export async function chatWithCortex(message: string, history: any[], context: any) {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: message,
    config: {
      systemInstruction: `You are Cortex, the tactical AI for Team Manager.
      Current User: ${context.userName} (${context.role}). 
      System Status: ${context.globalSettings.systemStatus}.
      
      Operational Rules:
      - Shifts operate on a 24-hour cycle.
      - 1st Shift: 7:30 AM to 4:30 PM (9 hours).
      - 2nd Shift: 12:30 PM to 8:30 PM (8 hours).
      - 3rd Shift: 8:30 PM to 7:30 AM (11 hours).
      - General Shift: 9:00 AM to 6:00 PM (9 hours).
      
      Maintain a professional, tactical, and efficient tone.`
    }
  });
  return response.text;
}

export async function generateTacticalBriefing(data: any): Promise<TacticalBriefing> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  try {
    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: `Data: ${JSON.stringify(data)}`,
      config: {
        systemInstruction: JSON_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            headline: { type: "STRING" },
            situationReport: { type: "STRING" },
            riskStatus: { type: "STRING", enum: ['low', 'elevated', 'critical'] },
            personnelStatus: { type: "STRING" },
            keyDirectives: { type: "ARRAY", items: { type: "STRING" } },
            personnelMorale: { type: "STRING" },
            criticalAlerts: { type: "ARRAY", items: { type: "STRING" } }
          },
          required: ["headline", "situationReport", "riskStatus", "personnelStatus", "keyDirectives", "personnelMorale", "criticalAlerts"]
        }
      }
    });
    return parseAIJson(response.text, {});
  } catch (err) {
    console.error("fetch in generateTacticalBriefing failed:", err);
    throw err;
  }
}

export async function generateOperationalInsights(data: any): Promise<OperationalInsight> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Analyze: ${JSON.stringify(data)}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'OBJECT',
        properties: {
          summary: { type: 'STRING' },
          recommendations: { type: 'ARRAY', items: { type: 'STRING' } },
          anomalies: { type: 'ARRAY', items: { type: 'STRING' } },
          efficiencyScore: { type: 'NUMBER' },
          riskLevel: { type: 'STRING', enum: ['low', 'medium', 'high'] }
        },
        required: ["summary", "recommendations", "anomalies", "efficiencyScore", "riskLevel"]
      }
    }
  });
  return parseAIJson(response.text, {});
}

export async function generateStrategicForecast(data: any): Promise<StrategicForecast> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Forecast: ${JSON.stringify(data)}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'OBJECT',
        properties: {
          workloadProjection: { type: 'STRING', enum: ['decreasing', 'stable', 'increasing'] },
          burnoutRiskTimeline: { type: 'STRING' },
          resourceBottleneck: { type: 'STRING' },
          strategicRecommendations: { type: 'ARRAY', items: { type: 'STRING' } }
        },
        required: ["workloadProjection", "burnoutRiskTimeline", "resourceBottleneck", "strategicRecommendations"]
      }
    }
  });
  return parseAIJson(response.text, {});
}

export async function analyzeRotation(activePersonnel: any[], wellnessData: any[]) {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Personnel: ${JSON.stringify(activePersonnel)}, Wellness: ${JSON.stringify(wellnessData)}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'OBJECT',
        properties: {
          riskLevel: { type: 'STRING' },
          rationale: { type: 'STRING' },
          recommendations: { type: 'ARRAY', items: { type: 'OBJECT', properties: { unitName: { type: 'STRING' }, action: { type: 'STRING' }, reason: { type: 'STRING' } } } }
        }
      }
    }
  });
  return parseAIJson(response.text, {});
}

export async function interpretIntelligentCommand(command: string, context?: any) {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Command: ${command}, Context: ${JSON.stringify(context || {})}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'OBJECT',
        properties: {
          action: { type: 'STRING' },
          targetTab: { type: 'STRING' },
          explanation: { type: 'STRING' }
        }
      }
    }
  });
  return parseAIJson(response.text, {});
}

export async function analyzeAuditLogs(logs: any[], query?: string): Promise<AuditIntelligence> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Logs: ${JSON.stringify(logs)}, Query: ${query || ''}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function optimizeBroadcastMessage(msg: string, context?: any): Promise<BroadcastOptimizationResponse> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Message: ${msg}, Context: ${JSON.stringify(context || {})}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function calculateGlobalRisk(data: any): Promise<GlobalRiskIndex> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: JSON.stringify(data),
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function interpretTacticalDirective(directive: string, currentSettings?: any): Promise<TacticalDirectiveResponse> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Directive: ${directive}, Settings: ${JSON.stringify(currentSettings || {})}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export interface MissionSuggestionResponse {
  suggestedUserIds: string[];
  rationale: string;
}

export async function suggestMissionPersonnel(title: string, description: string, pool: any[]): Promise<MissionSuggestionResponse> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Title: ${title}, Mission: ${description}, Pool: ${JSON.stringify(pool)}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'OBJECT',
        properties: {
          suggestedUserIds: { type: 'ARRAY', items: { type: 'STRING' } },
          rationale: { type: 'STRING' }
        }
      }
    }
  });
  return parseAIJson(response.text, {});
}

export async function simulateMissionOutcome(missionDesc: any, team: any[]): Promise<SimulationResult> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Mission: ${JSON.stringify(missionDesc)}, Team: ${JSON.stringify(team)}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function generateMissionDebrief(missionData: any, status: string, personnel: any[]): Promise<MissionDebrief> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Mission: ${JSON.stringify(missionData)}, Status: ${status}, Personnel: ${JSON.stringify(personnel)}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function predictResourceMaintenance(resource: any, usageHistory?: any[]) {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Resource: ${JSON.stringify(resource)}, History: ${JSON.stringify(usageHistory || [])}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function extractShiftsFromCSV(csvData: string, fileName: string, users?: any[]): Promise<ExtractedShift[]> {
  const extractedShifts: ExtractedShift[] = [];
  const lines = csvData.split('\n').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = lines[i];
    // A header row usually has "1", "2", "3" next to each other
    if (row.includes('1') && row.includes('2') && row.includes('3')) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    console.error("Could not find a valid date header row in CSV");
    return extractedShifts;
  }

  const headerRow = lines[headerRowIndex];
  
  // Find month/year from lines above header or filename
  let month = 3; // base 0 for April
  let year = new Date().getFullYear();
  let foundLocalMonth = false;
  
  for (let i = 0; i <= headerRowIndex; i++) {
     const rowText = lines[i].join(' ').toLowerCase();
     const dateMatch = rowText.match(/([a-zA-Z]+)\s+(\d{4})/);
     if (dateMatch) {
        const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
        const m = monthNames.findIndex(mn => dateMatch[1].startsWith(mn));
        if (m !== -1) {
          month = m;
          year = parseInt(dateMatch[2]);
          foundLocalMonth = true;
          break;
        }
     }
  }

  if (!foundLocalMonth) {
    const dateMatch = fileName.toLowerCase().match(/([a-zA-Z]+)\s*_*(\d{4})/);
    if (dateMatch) {
       const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
       const m = monthNames.findIndex(mn => dateMatch[1].startsWith(mn));
       if (m !== -1) {
         month = m;
         year = parseInt(dateMatch[2]);
       }
    } else {
       // fallback month detection based on current time
       const today = new Date();
       month = today.getMonth();
       year = today.getFullYear();
    }
  }

  const shiftCodeToTimes: Record<string, { start: string, end: string, label: string }> = {
    '1st': { start: '06:00', end: '14:00', label: '1st Shift' },
    '2nd': { start: '14:00', end: '22:00', label: '2nd Shift' },
    '3rd': { start: '22:00', end: '06:00', label: '3rd Shift' },
    'g': { start: '09:00', end: '18:00', label: 'General' },
    'general': { start: '09:00', end: '18:00', label: 'General' }
  };

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 2) continue;

    // Use the first non-empty cell as name, or let's assume it's in the first 2 columns.
    // Generally name is in col 0 or 1. Let's find the first cell in headerRow that is "1", the name is before that.
    const firstDayIndex = headerRow.findIndex(h => h === '1');
    if (firstDayIndex === -1) continue;

    let rawName = "";
    for (let c = 0; c < firstDayIndex; c++) {
      if (row[c]) rawName += row[c] + " ";
    }
    rawName = rawName.trim();
    
    if (!rawName || rawName.toLowerCase().includes("name") || rawName.toLowerCase().includes("total")) continue; 
    
    const user = users?.find(u => {
      const checkName = String(u.name || u.displayName || "").toLowerCase();
      if (!checkName) return false;
      return checkName === rawName.toLowerCase() || rawName.toLowerCase().includes(checkName);
    });
    
    const userName = user?.name || user?.displayName || rawName;
    const finalUserId = user?.uid || user?.id || rawName;

    for (let col = firstDayIndex; col < Math.min(row.length, headerRow.length); col++) {
      const dayStr = String(headerRow[col]).trim();
      const shiftCode = String(row[col]).trim().toLowerCase();
      
      const dayNum = parseInt(dayStr);
      if (isNaN(dayNum) || !shiftCode || ['wo', 'co', 'ch'].includes(shiftCode) || shiftCode === '-' || shiftCode === '') continue;

      const formattedMonth = String(month + 1).padStart(2, '0');
      const formattedDay = String(dayNum).padStart(2, '0');
      const dateString = `${year}-${formattedMonth}-${formattedDay}`;

      const mapping = shiftCodeToTimes[shiftCode] || { start: '09:00', end: '17:00', label: shiftCode.toUpperCase() };

      extractedShifts.push({
        userId: finalUserId,
        userName,
        date: dateString,
        startTime: mapping.start,
        endTime: mapping.end,
        type: mapping.label,
        confidenceScore: user ? 0.95 : 0.6
      });
    }
  }

  return extractedShifts;
}

export async function extractShiftsFromImage(imageB64: string, mimeType: string, users?: any[]): Promise<ExtractedShift[]> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME, // Use flash to avoid strict rate limits of pro
    contents: { parts: [
      { inlineData: { data: imageB64, mimeType: mimeType } }, 
      { text: `You are an expert OCR system. Extract the entire shift roster grid from this image exactly as it appears.
The image contains a large table of employees and their daily shifts for a month.

CRITICAL INSTRUCTIONS:
1. Identify the Month and Year from the sheet header (e.g. "APRIL 2026").
2. Do not skip any employee rows. Do not stop early. Extract data for every single employee name you see.
3. For each employee row, extract their shift code for EVERY day of the month (columns 1 to 30/31).
4. Return a compressed JSON object with the "monthYear" and a 2D array "grid".
5. The first row in "grid" MUST be the header row containing the numbers "1", "2", "3", etc.
6. Subsequent rows in "grid" MUST contain the employee's name as the first element, followed by their shift codes matching the columns.

EXPECTED JSON FORMAT:
{
  "monthYear": "April 2026",
  "grid": [
    ["Name", "1", "2", "3", "4", "5", "6", "..." ],
    ["Kural", "1st", "WO", "1st", "1st", "1st", "1st", "..."],
    ["Mamta", "2nd", "1st", "1st", "G", "WO", "G", "..."]
  ]
}` }
    ] },
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      maxOutputTokens: 8192
    }
  });

  const rawJson = parseAIJson(response.text, {});
  
  if (rawJson.error && String(rawJson.error).includes('Quota') || String(rawJson.summary).includes('Quota')) {
    throw new Error('429 Quota Exceeded: You have reached the Gemini API limit.');
  }
  
  const extractedShifts: ExtractedShift[] = [];

  if (!rawJson.grid || !Array.isArray(rawJson.grid) || rawJson.grid.length < 2) {
    console.error("Failed to extract grid correctly", rawJson);
    return extractedShifts;
  }

  const shiftCodeToTimes: Record<string, { start: string, end: string, label: string }> = {
    '1st': { start: '06:00', end: '14:00', label: '1st Shift' },
    '2nd': { start: '14:00', end: '22:00', label: '2nd Shift' },
    '3rd': { start: '22:00', end: '06:00', label: '3rd Shift' },
    'g': { start: '09:00', end: '18:00', label: 'General' },
    'general': { start: '09:00', end: '18:00', label: 'General' }
  };

  const monthYearStr = rawJson.monthYear || '';
  // Try to parse 'April 2026' into a baseline date
  let month = 3; // base 0, April
  let year = new Date().getFullYear();
  const dateMatch = monthYearStr.match(/([a-zA-Z]+)\s+(\d{4})/);
  if (dateMatch) {
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const m = monthNames.findIndex(mn => dateMatch[1].toLowerCase().startsWith(mn));
    if (m !== -1) month = m;
    year = parseInt(dateMatch[2]);
  }

  const headerRow = rawJson.grid[0];
  
  for (let i = 1; i < rawJson.grid.length; i++) {
    const row = rawJson.grid[i];
    if (!row || row.length < 2) continue;
    
    // First cell is name
    const rawName = String(row[0]).trim();
    if (!rawName || rawName.toLowerCase().includes("name")) continue; 
    
    const user = users?.find(u => {
      const checkName = String(u.name || u.displayName || "").toLowerCase();
      if (!checkName) return false;
      return checkName === rawName.toLowerCase() || rawName.toLowerCase().includes(checkName);
    });
    const userName = user?.name || user?.displayName || rawName;
    const finalUserId = user?.uid || user?.id || rawName;

    for (let col = 1; col < Math.min(row.length, headerRow.length); col++) {
      const dayStr = String(headerRow[col]).trim();
      const shiftCode = String(row[col]).trim().toLowerCase();
      
      const dayNum = parseInt(dayStr);
      if (isNaN(dayNum)) continue;

      if (!shiftCode || ['wo', 'co', 'ch'].includes(shiftCode)) {
        continue;
      }

      const mapping = shiftCodeToTimes[shiftCode] || { start: '09:00', end: '17:00', label: shiftCode.toUpperCase() };
      
      const formattedMonth = (month + 1).toString().padStart(2, '0');
      const formattedDay = dayNum.toString().padStart(2, '0');
      const dateStr = `${year}-${formattedMonth}-${formattedDay}`;

      extractedShifts.push({
        userId: finalUserId,
        userName,
        date: dateStr,
        startTime: mapping.start,
        endTime: mapping.end,
        type: mapping.label,
        confidenceScore: 0.95
      });
    }
  }

  return extractedShifts;
}

export async function suggestTeamRoster(reqs: any, employees: any[], constraints?: any): Promise<SuggestedRosterShift[]> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Reqs: ${JSON.stringify(reqs)}, Employees: ${JSON.stringify(employees)}, Constraints: ${JSON.stringify(constraints || {})}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, []);
}

export async function suggestConflictFixes(proposedRoster: any[], historicalData: any[]): Promise<RosterConflictFix[]> {
  const promptText = `
Analyze the proposed roster against constraints and historical data to identify conflicts (e.g., overlapping shifts, consecutive shift violations, missing high-risk roles). Suggest actionable fixes.

Proposed Roster: ${JSON.stringify(proposedRoster)}
Historical Data: ${JSON.stringify(historicalData)}

Return a list of RosterConflictFix objects. If there are no conflicts, return an empty array.
`;
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: promptText,
    config: { 
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            shiftId: { type: 'STRING' },
            suggestedAction: { type: 'STRING' },
            newDate: { type: 'STRING' },
            newStartTime: { type: 'STRING' },
            newEndTime: { type: 'STRING' },
            rationale: { type: 'STRING' }
          },
          required: ["shiftId", "suggestedAction", "newDate", "newStartTime", "newEndTime", "rationale"]
        }
      }
    }
  });
  return parseAIJson(response.text, []);
}

export async function suggestShiftSwaps(myShifts: any[], availableSwaps: any[], myPreferences?: any) {
  const promptText = `
Given a user's current shifts, an array of available shift swap requests from other users, and the user's preferences, identify the best potential swap matches.
Provide a rationale for why a swap is beneficial (e.g., aligns with their preferred date/type, reduces fatigue, avoids consecutive shifts).

My Shifts: ${JSON.stringify(myShifts)}
Available Swaps: ${JSON.stringify(availableSwaps)}
My Preferences: ${JSON.stringify(myPreferences || {})}

Return a JSON array of objects with the following schema:
[
  {
    "swapRequestId": "string",
    "matchScore": number (0-100),
    "rationale": "string explanation of why this is a good match"
  }
]
`;
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: promptText,
    config: { 
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            swapRequestId: { type: 'STRING' },
            matchScore: { type: 'NUMBER' },
            rationale: { type: 'STRING' }
          },
          required: ["swapRequestId", "matchScore", "rationale"]
        }
      }
    }
  });
  return parseAIJson(response.text, []);
}

export async function generatePersonnelDossier(user: any, context?: any): Promise<PersonnelDossier> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `User: ${JSON.stringify(user)}, Context: ${JSON.stringify(context || {})}`,
    config: { systemInstruction: JSON_INSTRUCTION, responseMimeType: "application/json" }
  });
  return parseAIJson(response.text, {});
}

export async function troubleshootIssue(issue: string, context?: any) {
  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Troubleshoot: ${issue}, Context: ${JSON.stringify(context || {})}`
  });
  return response.text;
}

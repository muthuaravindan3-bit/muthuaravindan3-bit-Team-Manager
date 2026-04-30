import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Unified response model selection
const MODEL_NAME = "gemini-3-flash-preview";

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
      const arrayVal = values.find(v => Array.isArray(v));
      if (arrayVal) return arrayVal;
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

export async function getTroubleshootingSteps(problem: string, mediaData?: any, context?: string): Promise<TroubleshootingResult> {
  const promptText = `
You are the elite technical support AI. Provide a highly detailed, professional troubleshooting guide for the support team.
Context: ${context || 'None'}
Problem: ${problem}

Output a strictly formatted markdown guide in the 'guide' field. Include:
1. Incident Summary (Brief)
2. Symptom Analysis
3. Root Cause Hypothesis
4. Immediate Action Plan (Step-by-step resolution)
5. Escalation Criteria
`;
  const contents = mediaData ? { parts: [{ text: promptText }, mediaData] } : promptText;
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: contents,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          guide: { type: Type.STRING },
          level: { type: Type.STRING, enum: ["L1", "L2", "L3"] },
          handlingTeam: { type: Type.STRING }
        },
        required: ["guide", "level", "handlingTeam"]
      }
    }
  });
  return parseAIJson(response.text, {});
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

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: `Data: ${JSON.stringify(data)}`,
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: { type: Type.STRING },
          situationReport: { type: Type.STRING },
          riskStatus: { type: Type.STRING, enum: ['low', 'elevated', 'critical'] },
          personnelStatus: { type: Type.STRING },
          keyDirectives: { type: Type.ARRAY, items: { type: Type.STRING } },
          personnelMorale: { type: Type.STRING },
          criticalAlerts: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["headline", "situationReport", "riskStatus", "personnelStatus", "keyDirectives", "personnelMorale", "criticalAlerts"]
      }
    }
  });
  return parseAIJson(response.text, {});
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
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
          anomalies: { type: Type.ARRAY, items: { type: Type.STRING } },
          efficiencyScore: { type: Type.NUMBER },
          riskLevel: { type: Type.STRING, enum: ['low', 'medium', 'high'] }
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
        type: Type.OBJECT,
        properties: {
          workloadProjection: { type: Type.STRING, enum: ['decreasing', 'stable', 'increasing'] },
          burnoutRiskTimeline: { type: Type.STRING },
          resourceBottleneck: { type: Type.STRING },
          strategicRecommendations: { type: Type.ARRAY, items: { type: Type.STRING } }
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
        type: Type.OBJECT,
        properties: {
          riskLevel: { type: Type.STRING },
          rationale: { type: Type.STRING },
          recommendations: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { unitName: { type: Type.STRING }, action: { type: Type.STRING }, reason: { type: Type.STRING } } } }
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
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING },
          targetTab: { type: Type.STRING },
          explanation: { type: Type.STRING }
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
        type: Type.OBJECT,
        properties: {
          suggestedUserIds: { type: Type.ARRAY, items: { type: Type.STRING } },
          rationale: { type: Type.STRING }
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

export async function extractShiftsFromImage(imageB64: string, mimeType: string, users?: any[]): Promise<ExtractedShift[]> {
  const JSON_INSTRUCTION = "Return ONLY valid JSON. Do not include any explanations, markdown formatting (unless requested), or conversational text.";

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: { parts: [{ inlineData: { data: imageB64, mimeType: mimeType } }, { text: `Extract shifts. Users: ${JSON.stringify(users || [])}` }] },
    config: {
      systemInstruction: JSON_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            userId: { type: Type.STRING },
            userName: { type: Type.STRING },
            date: { type: Type.STRING },
            startTime: { type: Type.STRING },
            endTime: { type: Type.STRING },
            type: { type: Type.STRING },
            confidenceScore: { type: Type.NUMBER }
          },
          required: ["userId", "userName", "date", "startTime", "endTime", "type", "confidenceScore"]
        }
      }
    }
  });
  return parseAIJson(response.text, []);
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
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            shiftId: { type: Type.STRING },
            suggestedAction: { type: Type.STRING },
            newDate: { type: Type.STRING },
            newStartTime: { type: Type.STRING },
            newEndTime: { type: Type.STRING },
            rationale: { type: Type.STRING }
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
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            swapRequestId: { type: Type.STRING },
            matchScore: { type: Type.NUMBER },
            rationale: { type: Type.STRING }
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

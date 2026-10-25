import React from 'react';

export interface ScreenshotAttachment {
  base64Data: string;
  mimeType: string;
  dataUrl: string;
  name: string;
  width: number;
  height: number;
  sizeKb: number;
}

export interface ParsedCommandBlock {
  language: string;
  code: string;
}

export interface ParsedTroubleshootingStep {
  stepNumber: number;
  tier: 'L1' | 'L2' | 'L3';
  title: string;
  simpleInstruction: string;
  verification?: string;
  commands: ParsedCommandBlock[];
}

export interface ParsedRunbook {
  summary: string;
  steps: ParsedTroubleshootingStep[];
  extraCommands: ParsedCommandBlock[];
}

/**
 * Compresses and converts an image File/Blob into a base64 payload suitable for
 * Gemini multimodal vision analysis while keeping network payloads fast.
 */
export async function processScreenshotFile(file: File): Promise<ScreenshotAttachment> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP, or GIF).');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.onload = () => {
      const rawDataUrl = String(reader.result || '');
      const img = new Image();
      img.onerror = () => reject(new Error('Could not decode screenshot image.'));
      img.onload = () => {
        const maxDim = 1280;
        let targetWidth = img.naturalWidth || img.width || 800;
        let targetHeight = img.naturalHeight || img.height || 600;

        if (targetWidth > maxDim || targetHeight > maxDim) {
          if (targetWidth >= targetHeight) {
            targetHeight = Math.round((targetHeight * maxDim) / targetWidth);
            targetWidth = maxDim;
          } else {
            targetWidth = Math.round((targetWidth * maxDim) / targetHeight);
            targetHeight = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          const base64Data = rawDataUrl.split(',')[1] || '';
          resolve({
            base64Data,
            mimeType: file.type || 'image/png',
            dataUrl: rawDataUrl,
            name: file.name || 'error-screenshot.png',
            width: targetWidth,
            height: targetHeight,
            sizeKb: Math.max(1, Math.round(file.size / 1024)),
          });
          return;
        }

        ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
        const outputMime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
        const compressedDataUrl = canvas.toDataURL(outputMime, 0.86);
        const base64Data = compressedDataUrl.split(',')[1] || '';
        const approxBytes = Math.round((base64Data.length * 3) / 4);

        resolve({
          base64Data,
          mimeType: outputMime,
          dataUrl: compressedDataUrl,
          name: file.name || `screenshot-${Date.now()}.png`,
          width: targetWidth,
          height: targetHeight,
          sizeKb: Math.max(1, Math.round(approxBytes / 1024)),
        });
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Extracts an image from a Ctrl+V / Cmd+V paste event if the clipboard contains a screenshot.
 */
export async function extractScreenshotFromClipboard(
  e: React.ClipboardEvent
): Promise<ScreenshotAttachment | null> {
  const items = e.clipboardData?.items;
  if (!items) return null;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const file = item.getAsFile();
      if (file) {
        const namedFile = new File(
          [file],
          file.name && file.name !== 'image.png'
            ? file.name
            : `pasted-screenshot-${new Date().toTimeString().slice(0, 8).replace(/:/g, '')}.png`,
          { type: file.type }
        );
        return processScreenshotFile(namedFile);
      }
    }
  }
  return null;
}

function extractCodeBlocks(raw: string): {
  cleanedText: string;
  commands: ParsedCommandBlock[];
} {
  const commands: ParsedCommandBlock[] = [];
  const codeRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
  const cleanedText = raw
    .replace(codeRegex, (_match, lang, code) => {
      const trimmedCode = String(code || '').trim();
      if (trimmedCode) {
        commands.push({
          language: String(lang || 'cli').trim() || 'cli',
          code: trimmedCode,
        });
      }
      return '';
    })
    .trim();

  return { cleanedText, commands };
}

function parseStepBlock(
  rawHeadingAndBody: string,
  fallbackIndex: number
): ParsedTroubleshootingStep | null {
  const lines = rawHeadingAndBody
    .split('\n')
    .map((l) => l.trim())
    .filter((l, idx) => idx === 0 || l.length > 0);

  if (lines.length === 0) return null;

  const firstLine = lines[0];
  const bodyRaw = lines.slice(1).join('\n');

  let tier: 'L1' | 'L2' | 'L3' = 'L1';
  const tierMatch = firstLine.match(/\[(L1|L2|L3)\]/i);
  if (tierMatch) {
    tier = tierMatch[1].toUpperCase() as 'L1' | 'L2' | 'L3';
  } else if (fallbackIndex === 3) {
    tier = 'L2';
  } else if (fallbackIndex >= 4) {
    tier = 'L3';
  }

  const cleanTitle = firstLine
    .replace(/^#{1,6}\s*/i, '')
    .replace(/^Step\s*\d+\s*[:.\-–—]?\s*/i, '')
    .replace(/\[(L1|L2|L3)\]\s*[:.\-–—]?\s*/gi, '')
    .replace(/\*\*/g, '')
    .trim();

  const { cleanedText, commands } = extractCodeBlocks(bodyRaw);

  let verification: string | undefined;
  const instructionLines: string[] = [];

  for (const line of cleanedText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const verifyMatch = trimmed.match(
      /^(?:\*|_|\*\*|-\s*)?(?:How to verify|Verification)\s*(?:\*|_|\*\*)?\s*:\s*(.+)$/i
    );
    if (verifyMatch) {
      verification = verifyMatch[1].replace(/^\*+|\*+$/g, '').trim();
    } else {
      instructionLines.push(
        trimmed
          .replace(/^-\s*\[\s*[xX ]?\s*\]\s*/, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
      );
    }
  }

  const simpleInstruction =
    instructionLines.join(' ').trim() ||
    cleanTitle ||
    'Follow this step to verify and resolve the issue.';

  return {
    stepNumber: fallbackIndex,
    tier,
    title: cleanTitle || `Step ${fallbackIndex}`,
    simpleInstruction,
    verification,
    commands,
  };
}

/**
 * Parses a raw AI troubleshooting guide into a user-friendly summary + numbered checklist
 * with simple instructions and expandable technical/CLI commands.
 * Supports both `#### Step N:` sections and legacy `- [ ] **[L1] Title**: ...` checklists.
 */
export function parseRunbookGuide(guideMarkdown: string): ParsedRunbook {
  if (!guideMarkdown || !guideMarkdown.trim()) {
    return { summary: '', steps: [], extraCommands: [] };
  }

  const cleaned = guideMarkdown
    .replace(/\[TIER:\s*(L1|L2|L3)\]\s*\[TEAM:\s*([^\]]+)\]/gi, '')
    .trim();

  // 1. Check for `#### Step 1:` or `### Step 1:` style headings
  const stepHeadingRegex = /(?:^|\n)#{2,5}\s*Step\s+\d+\s*[:.\-–—]?/gi;
  if (stepHeadingRegex.test(cleaned)) {
    const parts = cleaned.split(/(?=(?:^|\n)#{2,5}\s*Step\s+\d+\s*[:.\-–—]?)/i);
    const introRaw = parts[0] || '';
    const stepRawBlocks = parts.slice(1);

    const { cleanedText: cleanIntro, commands: introCommands } =
      extractCodeBlocks(introRaw);

    const summary = cleanIntro
      .replace(/#{1,5}\s*Quick Summary/gi, '')
      .replace(/#{1,5}\s*Step-by-Step[^\n]*/gi, '')
      .replace(/#{1,5}\s*Root Cause[^\n]*/gi, '')
      .trim();

    const steps: ParsedTroubleshootingStep[] = [];
    stepRawBlocks.forEach((block, idx) => {
      const parsed = parseStepBlock(block.trim(), idx + 1);
      if (parsed) {
        steps.push(parsed);
      }
    });

    return {
      summary,
      steps,
      extraCommands: introCommands,
    };
  }

  // 2. Fallback parser for legacy `- [ ] **[L1] Title**: description *Verification*: ...`
  const { cleanedText: withoutCode, commands: globalCommands } =
    extractCodeBlocks(cleaned);

  const lines = withoutCode.split('\n');
  const summaryLines: string[] = [];
  const legacySteps: ParsedTroubleshootingStep[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^#{1,5}\s+/.test(trimmed)) continue;

    const bulletMatch = trimmed.match(
      /^(?:-\s*\[\s*[xX ]?\s*\]|\d+\.)\s*(.+)$/
    );
    if (bulletMatch) {
      const content = bulletMatch[1].trim();
      let tier: 'L1' | 'L2' | 'L3' = 'L1';
      const tierMatch = content.match(/\[(L1|L2|L3)\]/i);
      if (tierMatch) {
        tier = tierMatch[1].toUpperCase() as 'L1' | 'L2' | 'L3';
      }

      const verifySplit = content.split(/\*+(?:Verification|How to verify)\*+\s*:\s*/i);
      const mainPart = verifySplit[0]
        .replace(/\[(L1|L2|L3)\]\s*/gi, '')
        .trim();
      const verification = verifySplit[1]?.trim();

      let title = `Step ${legacySteps.length + 1}`;
      let simpleInstruction = mainPart;

      const boldTitleMatch = mainPart.match(/^\*\*(.+?)\*\*\s*[:.\-–—]?\s*(.*)$/);
      if (boldTitleMatch) {
        title = boldTitleMatch[1].replace(/\[(L1|L2|L3)\]\s*/gi, '').trim();
        simpleInstruction = boldTitleMatch[2].trim() || title;
      }

      legacySteps.push({
        stepNumber: legacySteps.length + 1,
        tier,
        title,
        simpleInstruction: simpleInstruction.replace(/\*\*(.*?)\*\*/g, '$1'),
        verification,
        commands: [],
      });
    } else {
      summaryLines.push(trimmed.replace(/^-\s*/, '').replace(/\*\*(.*?)\*\*/g, '$1'));
    }
  }

  // Attach global commands to the most relevant step or keep in extraCommands
  if (legacySteps.length > 0 && globalCommands.length > 0) {
    globalCommands.forEach((cmd, idx) => {
      const targetStepIndex = Math.min(idx, legacySteps.length - 1);
      legacySteps[targetStepIndex].commands.push(cmd);
    });
    return {
      summary: summaryLines.slice(0, 3).join(' '),
      steps: legacySteps,
      extraCommands: [],
    };
  }

  return {
    summary: summaryLines.slice(0, 3).join(' '),
    steps: legacySteps,
    extraCommands: globalCommands,
  };
}

export type StepOutcome = 'pending' | 'fixed' | 'failed';

export function generateIncidentTicketNumber(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `INC-2026-${num}`;
}

export function detectCurrentShiftLabel(): string {
  const now = new Date();
  const timeVal = now.getHours() + now.getMinutes() / 60;
  if (timeVal >= 7.5 && timeVal < 12.5) return '1st Shift (07:30–16:30)';
  if (timeVal >= 12.5 && timeVal < 20.5) return '2nd Shift (12:30–20:30)';
  return '3rd Shift (20:30–07:30)';
}

export interface HandoverTicketFormatInput {
  ticketNumber: string;
  title: string;
  summary: string;
  tier: 'L1' | 'L2' | 'L3';
  team: string;
  status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  creatorName: string;
  shiftType: string;
  hasScreenshot?: boolean;
  steps: ParsedTroubleshootingStep[];
  stepOutcomes: Record<number, StepOutcome>;
  checkedSteps: Record<number, boolean>;
  resolutionNotes?: string;
}

export function formatIncidentTicketOutput(
  input: HandoverTicketFormatInput,
  format: 'markdown' | 'slack' | 'jira'
): string {
  const testedSteps = input.steps.filter(
    (s) =>
      input.checkedSteps[s.stepNumber] ||
      input.stepOutcomes[s.stepNumber] === 'fixed' ||
      input.stepOutcomes[s.stepNumber] === 'failed'
  );

  const stepLines = (testedSteps.length > 0 ? testedSteps : input.steps).map(
    (s) => {
      const outcome = input.stepOutcomes[s.stepNumber];
      const tag =
        outcome === 'fixed'
          ? '[FIXED ISSUE]'
          : outcome === 'failed'
          ? '[TRIED - DID NOT FIX]'
          : input.checkedSteps[s.stepNumber]
          ? '[CHECKED]'
          : '[PENDING]';
      return `- Step ${s.stepNumber} (${s.tier}) ${tag}: ${s.title}`;
    }
  );

  const fixedStep = input.steps.find(
    (s) => input.stepOutcomes[s.stepNumber] === 'fixed'
  );

  if (format === 'slack') {
    return [
      `*[${input.ticketNumber}] ${input.tier} Incident Handover — ${input.title}*`,
      `• *Status*: ${input.status.toUpperCase()} | *Assigned Queue*: ${input.team}`,
      `• *Shift*: ${input.shiftType} | *Reported By*: ${input.creatorName}`,
      `• *Evidence*: ${input.hasScreenshot ? 'Error Screenshot Attached' : 'Symptom & CLI Triage'}`,
      `• *Summary*: ${input.summary || input.title}`,
      `*Triage Steps Executed*:`,
      ...stepLines.map((l) => `  ${l}`),
      fixedStep
        ? `• *Verified Fix*: Step ${fixedStep.stepNumber} — ${fixedStep.title}`
        : `• *Next Action*: Escalate to ${input.team} (${input.tier}) for deeper investigation.`,
      input.resolutionNotes ? `• *Engineer Notes*: ${input.resolutionNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  if (format === 'jira') {
    return [
      `h2. [${input.ticketNumber}] ${input.title}`,
      `*Severity Tier*: ${input.tier}`,
      `*Handling Team*: ${input.team}`,
      `*Incident Status*: ${input.status.toUpperCase()}`,
      `*Shift Block*: ${input.shiftType}`,
      `*Reporter*: ${input.creatorName}`,
      ``,
      `h3. Root Cause & Summary`,
      `${input.summary || input.title}`,
      ``,
      `h3. Step-by-Step Triage Telemetry`,
      ...stepLines,
      ``,
      fixedStep
        ? `h3. Verified Resolution\nResolved via Step ${fixedStep.stepNumber}: ${fixedStep.title}`
        : `h3. Escalation Action Required\nL1 checks completed without full mitigation. Handing over to ${input.team}.`,
      input.resolutionNotes ? `\n*Additional Notes*: ${input.resolutionNotes}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  return [
    `## [${input.ticketNumber}] ${input.title}`,
    `- **Escalation Tier**: \`${input.tier}\` · **Queue**: **${input.team}**`,
    `- **Status**: \`${input.status.toUpperCase()}\` · **Shift**: ${input.shiftType}`,
    `- **Engineer**: ${input.creatorName} · **Attachment**: ${
      input.hasScreenshot ? 'Error Screenshot Included' : 'Standard Telemetry'
    }`,
    ``,
    `### Summary`,
    `${input.summary || input.title}`,
    ``,
    `### Triage Checklist Progress`,
    ...stepLines,
    ``,
    fixedStep
      ? `### Verified Resolution\nConfirmed fixed at **Step ${fixedStep.stepNumber}: ${fixedStep.title}**.`
      : `### Handover & Next Steps\nRequires follow-up by **${input.team}** on the Live Shift Handover Board.`,
    input.resolutionNotes ? `\n**Engineer Notes**: ${input.resolutionNotes}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

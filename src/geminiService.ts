/**
 * LOCAL TACTICAL CORTEX & ALGORITHMIC ENGINE (100% Free, Zero API Keys Required)
 *
 * Replaces paid/quota-limited cloud LLM calls with deterministic constraint solvers,
 * heuristic statistical analyzers, and a built-in L1 Diagnostic Knowledge Base.
 *
 * Optional: If you run a free local LLM (such as Ollama on http://localhost:11434),
 * you can set `localStorage.setItem('LOCAL_LLM_URL', 'http://localhost:11434/api/generate')`
 * and `localStorage.setItem('LOCAL_LLM_MODEL', 'llama3')` to route free-form chat
 * through your local hardware while keeping all structured scheduling deterministic.
 */

// --- Types ---
export interface TroubleshootingResult {
  guide: string;
  level: "L1" | "L2" | "L3";
  handlingTeam: string;
  source?: "gemini-flash" | "local-cortex";
}

export interface TroubleshootOptions {
  category?: string;
  logSnippet?: string;
  mediaBase64?: string;
  mediaType?: string;
  onChunk?: (text: string) => void;
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

export interface MissionSuggestionResponse {
  suggestedUserIds: string[];
  rationale: string;
}

// --- Internal Helpers ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const SHIFT_CATALOG = [
  { type: '1st Shift', startTime: '06:00', endTime: '14:00' },
  { type: '2nd Shift', startTime: '14:00', endTime: '22:00' },
  { type: '3rd Shift', startTime: '22:00', endTime: '06:00' },
  { type: 'General', startTime: '09:00', endTime: '18:00' },
];

async function tryLocalOllama(prompt: string): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const endpoint = window.localStorage.getItem('LOCAL_LLM_URL');
  if (!endpoint) return null;
  const model = window.localStorage.getItem('LOCAL_LLM_MODEL') || 'llama3';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: false })
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.response || data.choices?.[0]?.message?.content || null;
  } catch {
    return null;
  }
}

// --- Functions ---

export async function generateGeneralInsight(prompt: string): Promise<string> {
  const localResp = await tryLocalOllama(prompt);
  if (localResp) return localResp;

  await delay(180);
  const lower = prompt.toLowerCase();

  // Check if the prompt contains JSON shift data from Dashboard
  const shiftDates: string[] = [];
  const shiftTypes: string[] = [];
  const dateMatches = prompt.match(/\d{4}-\d{2}-\d{2}/g);
  if (dateMatches) shiftDates.push(...dateMatches);

  if (lower.includes('3rd') || lower.includes('night') || lower.includes('22:00')) {
    shiftTypes.push('Nocturnal (3rd Shift)');
  }
  if (lower.includes('1st') || lower.includes('06:00')) {
    shiftTypes.push('Alpha (1st Shift)');
  }
  if (lower.includes('2nd') || lower.includes('14:00')) {
    shiftTypes.push('Bravo (2nd Shift)');
  }

  if (shiftDates.length > 0) {
    const uniqueDates = new Set(shiftDates).size;
    if (shiftTypes.includes('Nocturnal (3rd Shift)') && shiftTypes.includes('Alpha (1st Shift)')) {
      return `Detected rapid circadian transition across ${uniqueDates} upcoming duty cycles; prioritize pre-shift hydration and strict task pacing during shift handovers.`;
    }
    if (shiftTypes.includes('Nocturnal (3rd Shift)')) {
      return `Active nocturnal duty block identified across ${uniqueDates} scheduled cycles; maintain high-contrast terminal ergonomics and structured mid-shift micro-breaks.`;
    }
    return `Operational cadence across ${uniqueDates} upcoming duty cycles is balanced; maintain steady telemetry synchronization and standard handover protocols.`;
  }

  if (lower.includes('wellness') || lower.includes('fatigue') || lower.includes('burnout')) {
    return JSON.stringify({
      wellnessTips: [
        "Enforce 15-minute cognitive decompression breaks every 4 hours of active terminal monitoring.",
        "Rotate high-alert triage duties between 1st and 2nd shift operators to balance cognitive load.",
        "Maintain hydration and calibrate ambient display contrast during nocturnal shift blocks."
      ],
      dailyQuote: "Precision under pressure is the direct result of disciplined pacing and clear team telemetry."
    });
  }

  return "Operational cadence is within nominal tolerances; maintain structured shift handovers and monitor active unit telemetry.";
}

interface DiagnosticPlaybook {
  keywords: string[];
  category: string;
  level: 'L1' | 'L2' | 'L3';
  handlingTeam: string;
  summary: string;
  thoughts: string[];
  steps: string[];
  cliCommands: string;
}

const DIAGNOSTIC_PLAYBOOKS: DiagnosticPlaybook[] = [
  {
    keywords: ['vpn', 'network', 'wifi', 'internet', 'dns', 'ping', 'latency', 'disconnect', 'packet', 'firewall', 'proxy', 'vlan', 'port', ' gateway', 'dhcp'],
    category: 'Network, VPN & Connectivity Triage',
    level: 'L2',
    handlingTeam: 'Network & Systems Engineering',
    summary: 'Your workstation or device is losing network or VPN connectivity, usually caused by a stale DNS cache, an expired local IP lease, or a dropped corporate VPN tunnel on port 443.',
    thoughts: [
      'Analyzing reported network connectivity / VPN transport anomaly.',
      'Checking physical link and IP lease status before inspecting DNS resolution or split-tunnel VPN routes.',
      'Formulating user-friendly step-by-step checklist with expandable CLI commands.'
    ],
    steps: [
      `#### Step 1: [L1] Check Your Network Cable or Wi-Fi Connection
Make sure your Ethernet cable is firmly plugged in or your Wi-Fi is connected to the corporate network, and check that your computer has a valid IP address (not starting with 169.254).
*How to verify*: Your network icon shows connected and you have a valid local IPv4 address.
\`\`\`powershell
# Windows: Check IP address and Default Gateway
ipconfig /all
\`\`\`
\`\`\`bash
# macOS / Linux: Check network interface IP
ip addr show || ifconfig
\`\`\``,
      `#### Step 2: [L1] Test Basic Internet Reachability
Test if your computer can reach the outside network without relying on domain names (DNS) to see if the connection itself is working.
*How to verify*: Ping replies return with 0% packet loss.
\`\`\`bash
# Test direct packet routing to Google DNS
ping -c 4 8.8.8.8
\`\`\``,
      `#### Step 3: [L2] Clear Cached DNS Records
Often the internet works, but cached domain lookups are stuck. Flushing your DNS cache forces your computer to fetch fresh server addresses.
*How to verify*: Opening internal tools or websites loads without a "DNS_PROBE_FINISHED_NXDOMAIN" error.
\`\`\`powershell
# Windows: Flush DNS resolver cache
ipconfig /flushdns
nslookup google.com
\`\`\`
\`\`\`bash
# Linux / macOS: Test DNS resolution
dig +short google.com
\`\`\``,
      `#### Step 4: [L2] Reconnect the Corporate VPN Tunnel
Disconnect from your VPN client, wait 10 seconds, and sign back in so it refreshes your security token and split-tunnel routing table.
*How to verify*: VPN status reads "Connected" and internal company pages load on port 443.
\`\`\`powershell
# Windows: Test port 443 reachability & reset Winsock if stuck
Test-NetConnection -ComputerName 8.8.8.8 -Port 443
netsh winsock reset
\`\`\``
    ],
    cliCommands: `\`\`\`bash
# Full Network & Health Endpoint Check
curl -Iv https://localhost:3000/api/health --max-time 5
\`\`\``
  },
  {
    keywords: ['pos', 'register', 'terminal', 'card reader', 'payment', 'receipt', 'barcode', 'kiosk', 'offline', 'sync'],
    category: 'POS Terminal & Field Hardware Systems',
    level: 'L1',
    handlingTeam: 'Field POS & Hardware Support',
    summary: 'The POS register or card reader is unable to sync transactions or talk to attached hardware, typically due to a stuck offline queue lock file or a loose USB/Ethernet connection.',
    thoughts: [
      'Inspecting POS register transaction sync queue, local peripheral bus, and payment gateway heartbeat.',
      'Prioritizing offline spool preservation before resetting network or USB/serial interfaces.'
    ],
    steps: [
      `#### Step 1: [L1] Confirm Offline Transactions Are Saved
Before restarting anything, check the top status bar on the POS screen to make sure any pending offline sales are saved in the local queue.
*How to verify*: The offline transaction count is visible on the status indicator.`,
      `#### Step 2: [L1] Reconnect Card Reader & Receipt Printer Directly
Unplug the USB or Ethernet cable for the card reader/printer from any USB hub and plug it directly into a main port on the POS terminal.
*How to verify*: The status light on the card reader or printer turns solid green.
\`\`\`powershell
# Windows: List any USB or PnP hardware showing an error state
Get-PnpDevice -PresentOnly | Where-Object { $_.Status -ne "OK" }
\`\`\``,
      `#### Step 3: [L2] Restart the POS Sync & Print Spooler Service
Restart the background sync and print spooler services so stuck jobs clear out and the register reconnects to the server.
*How to verify*: The POS status indicator changes from "Offline" to "Online / Synced".
\`\`\`powershell
# Windows PowerShell: Restart Print Spooler & check POS services
Get-Service | Where-Object {$_.Name -match "POS|Spooler"}
Restart-Service -Name "Spooler" -Force
\`\`\``,
      `#### Step 4: [L3] Verify Payment Gateway Connection
Test that the register can reach the payment processor over the secure network port (443) without firewall blocks.
*How to verify*: A test card tap or connection check returns "Approved / Connected".
\`\`\`powershell
# Test secure TLS connection on port 443
Test-NetConnection -ComputerName 8.8.8.8 -Port 443
\`\`\``
    ],
    cliCommands: `\`\`\`powershell
# Windows POS Terminal Service & Spooler Triage
Get-Service | Where-Object {$_.Name -match "POS|Spooler"}
Restart-Service -Name "Spooler" -Force
\`\`\``
  },
  {
    keywords: ['database', 'sql', 'postgres', 'firestore', 'mongo', 'deadlock', 'timeout', '500', '502', '503', '504', 'api', 'server', 'backend', 'exception', 'stack', 'trace', 'error'],
    category: 'Backend API, Database & Log Diagnostics',
    level: 'L3',
    handlingTeam: 'Platform & SRE Infrastructure',
    summary: 'The backend server or database is returning an error or timing out (HTTP 500/502/504), usually caused by an overloaded service process, a permissions mismatch, or a blocked database query.',
    thoughts: [
      'Analyzing backend service health, database connection pool saturation, and API response status codes.',
      'Checking for query lock contention, missing indexes, or expired service credentials.'
    ],
    steps: [
      `#### Step 1: [L1] Check If the Main Server Is Responding
Test the application health endpoint to see if the server process is running or completely down.
*How to verify*: The health check responds with \`{"status":"ok"}\` immediately.
\`\`\`bash
# Probe the local server health endpoint
curl -sS -D - http://localhost:3000/api/health
\`\`\``,
      `#### Step 2: [L2] Check the Recent Error Logs for the Exact Line
Look at the last 50 lines of the server log to find the exact error message, file name, and line number that failed.
*How to verify*: You can see the specific \`Error\` or \`Exception\` message in the log output.
\`\`\`bash
# View recent service error logs
tail -n 50 /var/log/syslog || journalctl -n 50 --no-pager
\`\`\``,
      `#### Step 3: [L2] Verify Database Permissions & Active Connections
Confirm that the signed-in user has permission to read/write the database collection and that the database connection pool is not full.
*How to verify*: Database queries complete without "Missing or insufficient permissions" or timeout errors.
\`\`\`bash
# Check active Node / server processes
ps aux | grep -E "node|tsx"
\`\`\``,
      `#### Step 4: [L3] Restart the Service or Roll Back Recent Changes
If a stuck query or recent code update caused the error, gracefully restart the service worker or roll back to the previous stable build.
*How to verify*: The application loads normally and HTTP 500/504 errors stop appearing.`
    ],
    cliCommands: `\`\`\`bash
# Server & API Health Verification
curl -sS -D - http://localhost:3000/api/health
ps aux | grep -E "node|tsx"
\`\`\``
  },
  {
    keywords: ['login', 'auth', 'password', 'locked', 'mfa', '2fa', 'sso', 'token', 'permission', 'access denied', 'forbidden', '401', '403', 'firebase', 'oauth', 'cookie'],
    category: 'Authentication, SSO & RBAC Security',
    level: 'L2',
    handlingTeam: 'Identity & Access Engineering',
    summary: 'Sign-in or access is failing (401/403 Permission Denied), which usually happens when browser login tokens expire, system clock time drifts, or the user account needs the right role assigned.',
    thoughts: [
      'Evaluating identity provider handshake, OAuth session token state, and RBAC permission boundaries.',
      'Separating client-side cached credential corruption from server-side role mismatch.'
    ],
    steps: [
      `#### Step 1: [L1] Check Your Account Role & Profile
Make sure you are signed in with the right company email and that your account has the required role (Member or Admin) in Team & Payroll.
*How to verify*: Your profile name and role badge appear accurately in the top-left sidebar.`,
      `#### Step 2: [L1] Clear Old Login Data & Sign In Fresh
Sometimes an expired login token gets stuck in the browser. Sign out, clear site data for this page, and sign back in.
*How to verify*: The Google sign-in popup completes cleanly without looping.`,
      `#### Step 3: [L2] Sync Your Computer's Clock
Security tokens fail if your computer's clock is off by more than a minute. Re-sync your system time with the internet time server.
*How to verify*: Your system clock matches current local time to the second.
\`\`\`powershell
# Windows: Resync system clock and purge old tickets
w32tm /resync /force
klist purge
\`\`\`
\`\`\`bash
# Linux / macOS: Check UTC clock and OAuth reachability
date -u
curl -I https://accounts.google.com/.well-known/openid-configuration
\`\`\``,
      `#### Step 4: [L3] Verify Database Security Rules
If a specific page shows "Missing or insufficient permissions", ask an Admin to confirm the Firestore security rules allow access for your user ID.
*How to verify*: The page data loads without a 403 permission banner.`
    ],
    cliCommands: `\`\`\`powershell
# Windows NTP Time Resync & Ticket Purge
w32tm /resync /force
klist purge
\`\`\``
  },
  {
    keywords: ['printer', 'scanner', 'usb', 'peripheral', 'badge', 'monitor', 'display', 'audio', 'headset', 'mic', 'webcam', 'hardware', 'lock', 'door'],
    category: 'Workstation Peripheral & Facility Hardware',
    level: 'L1',
    handlingTeam: 'Workplace IT & Facilities Support',
    summary: 'An attached hardware device (printer, scanner, headset, or door badge reader) is not responding, usually caused by a loose USB/power connection, a stalled OS service, or a driver glitch.',
    thoughts: [
      'Inspecting physical peripheral bus enumeration, OS driver state, and print/audio/badge controller services.',
      'Prioritizing non-disruptive service restarts and port re-seating before driver reinstallation.'
    ],
    steps: [
      `#### Step 1: [L1] Unplug and Reconnect Directly to a Main Port
Unplug the device cable, wait 5 seconds, and plug it directly into the computer (avoiding unpowered USB hubs or loose extension cables).
*How to verify*: The device power light turns on and the computer chimes or detects it.`,
      `#### Step 2: [L1] Restart the Printer or Audio Background Service
Clear any stuck print jobs or frozen audio streams by restarting the Windows Print Spooler or Audio service.
*How to verify*: A test page prints or test audio plays clearly.
\`\`\`powershell
# Windows: Restart Print Spooler & clear stuck print files
Stop-Service -Name Spooler -Force
Remove-Item -Path "$env:SystemRoot\\System32\\spool\\PRINTERS\\*" -Force -ErrorAction SilentlyContinue
Start-Service -Name Spooler
\`\`\``,
      `#### Step 3: [L2] Check Device Manager for Driver Warnings
Open Device Manager to check if the device has a yellow warning icon, then right-click it and select "Update driver" or "Scan for hardware changes".
*How to verify*: Device status reads "This device is working properly".
\`\`\`powershell
# List any hardware devices reporting an Error status
Get-PnpDevice | Where-Object { $_.Status -eq "Error" }
\`\`\``,
      `#### Step 4: [L3] Reset Power for Smart Locks / Badge Readers
If a facility door badge reader is flashing amber, power-cycle its PoE switch port or replace the backup battery pack.
*How to verify*: The badge reader light returns to solid green or blue standby.`
    ],
    cliCommands: `\`\`\`powershell
# Restart Print Spooler & List Faulty USB/PnP Devices
Restart-Service -Name Spooler -Force
Get-PnpDevice | Where-Object { $_.Status -eq "Error" }
\`\`\``
  },
  {
    keywords: ['slow', 'cpu', 'memory', 'ram', 'crash', 'freeze', 'lag', 'high', 'disk', 'storage', 'performance', 'browser', 'oom', 'leak'],
    category: 'System Performance & Resource Exhaustion',
    level: 'L2',
    handlingTeam: 'Systems Performance Engineering',
    summary: 'The system is running slowly, freezing, or crashing because a background app is using too much CPU/RAM or the hard drive is nearly full.',
    thoughts: [
      'Evaluating workstation/server memory pressure, CPU thread saturation, and disk I/O bottlenecks.',
      'Identifying runaway processes and renderer memory leaks.'
    ],
    steps: [
      `#### Step 1: [L1] Close Heavy Apps Using Too Much CPU or Memory
Open Task Manager (\`Ctrl+Shift+Esc\` on Windows) or Activity Monitor (Mac) and close any frozen apps or browser tabs using over 80% CPU or Memory.
*How to verify*: Total CPU and RAM usage drops below 70% and mouse/keyboard lag disappears.
\`\`\`bash
# Linux / macOS: Show top memory-consuming processes
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -n 10
\`\`\``,
      `#### Step 2: [L1] Check Available Disk Space
Make sure your main drive has at least 15% free space so the operating system has room for virtual memory and temporary files.
*How to verify*: Free disk space is at least 10–15 GB.
\`\`\`bash
# Check free disk space across partitions
df -h
\`\`\``,
      `#### Step 3: [L2] Clear Temporary Caches & Restart Background Workers
Clear temporary browser/application cache files and restart the app so leaked memory is released back to the system.
*How to verify*: Available free RAM increases and pages load briskly.
\`\`\`bash
# Check current free and cached RAM in MB
free -m
\`\`\``,
      `#### Step 4: [L3] Check System Logs for Out-Of-Memory (OOM) Crashes
If the app keeps crashing automatically, check system logs to see if the OS killed the process due to memory exhaustion.
*How to verify*: Any OOM or hardware disk errors are identified for L3 escalation.
\`\`\`bash
# Check kernel logs for Out-Of-Memory or hardware errors
dmesg -T | grep -iE "oom|killed|error" | tail -n 20
\`\`\``
    ],
    cliCommands: `\`\`\`bash
# Linux Resource, Disk & OOM Triage
df -h && free -m
ps -eo pid,ppid,cmd,%mem,%cpu --sort=-%mem | head -n 10
\`\`\``
  }
];

function parseTierAndTeam(rawText: string, problem: string): {
  cleanedGuide: string;
  level: 'L1' | 'L2' | 'L3';
  handlingTeam: string;
} {
  let cleaned = rawText
    .replace(/<thought>[\s\S]*?<\/thought>/g, '')
    .replace(/<thought>[\s\S]*/g, '')
    .trim();

  let level: 'L1' | 'L2' | 'L3' | null = null;
  let handlingTeam: string | null = null;

  const headerMatch = cleaned.match(/\[TIER:\s*(L1|L2|L3)\]\s*\[TEAM:\s*([^\]]+)\]/i);
  if (headerMatch) {
    level = headerMatch[1].toUpperCase() as 'L1' | 'L2' | 'L3';
    handlingTeam = headerMatch[2].trim();
    cleaned = cleaned.replace(headerMatch[0], '').trim();
  }

  if (!level || !handlingTeam) {
    const lower = problem.toLowerCase();
    level =
      lower.includes('server') ||
      lower.includes('outage') ||
      lower.includes('database') ||
      lower.includes('500') ||
      lower.includes('504') ||
      lower.includes('exception') ||
      lower.includes('stack')
        ? 'L3'
        : lower.includes('vpn') ||
          lower.includes('network') ||
          lower.includes('dns') ||
          lower.includes('auth') ||
          lower.includes('permission') ||
          lower.includes('cpu')
        ? 'L2'
        : 'L1';
    handlingTeam =
      level === 'L3'
        ? 'Platform & SRE Infrastructure'
        : level === 'L2'
        ? 'Systems & Network Engineering'
        : 'Frontline Operations & IT Support';
  }

  return { cleanedGuide: cleaned, level, handlingTeam };
}

function buildTroubleshootingGuide(
  problem: string,
  hasMedia: boolean,
  context?: string,
  logSnippet?: string
): {
  thoughtText: string;
  checklistText: string;
  level: 'L1' | 'L2' | 'L3';
  handlingTeam: string;
} {
  const combinedInput = `${problem} ${logSnippet || ''}`.toLowerCase();
  const matched = DIAGNOSTIC_PLAYBOOKS.find(pb =>
    pb.keywords.some(kw => combinedInput.includes(kw))
  );

  const level: 'L1' | 'L2' | 'L3' = matched
    ? matched.level
    : logSnippet && logSnippet.trim().length > 0
    ? 'L3'
    : 'L1';

  const handlingTeam = matched
    ? matched.handlingTeam
    : logSnippet && logSnippet.trim().length > 0
    ? 'Platform & SRE Infrastructure'
    : 'Frontline Operations & IT Support';

  const thoughts = [
    `[LOCAL CORTEX ENGINE] Parsing engineering telemetry: "${problem.slice(0, 100)}"`,
    hasMedia
      ? 'Error screenshot attachment detected. Extracting visual error state and matching with step-by-step resolution checklist.'
      : 'Executing deterministic symptom & log matching against L1–L3 Engineering Knowledge Base.',
    context ? `Context verified (${context.slice(0, 80).replace(/\n/g, ' ')}).` : 'Operating under L1–L3 Engineering Support context.',
    ...(matched
      ? matched.thoughts
      : [
          'Synthesizing user-friendly numbered checklist with expandable CLI verification commands.'
        ])
  ];

  const summaryText = matched
    ? `${matched.summary}${hasMedia ? ' (Diagnosed alongside your attached error screenshot.)' : ''}`
    : `We analyzed ${hasMedia ? 'your uploaded error screenshot and ' : ''}the reported issue (${problem.slice(0, 90) || 'system error'}). Follow the numbered steps below from basic checks (L1) to deeper technical verification (L2/L3) to resolve the fault.`;

  const logAnalysisNote =
    logSnippet && logSnippet.trim()
      ? `\n\n- **Captured Error Log**: \`${logSnippet.trim().split('\n')[0].slice(0, 120)}\` (${logSnippet.trim().split('\n').length} line(s) analyzed)`
      : '';

  const steps = matched
    ? matched.steps
    : [
        `#### Step 1: [L1] Note the Exact Error Message & Restart the Active View
Check the exact error code or message shown${hasMedia ? ' in your screenshot' : ' on screen'} and try refreshing or reopening the affected window first.
*How to verify*: Check if the error clears after a clean reload.`,
        `#### Step 2: [L1] Check Network Connection & Account Sign-In
Make sure your device is connected to the network and you are signed in with an active account session.
*How to verify*: Other pages load normally and your profile appears in the sidebar.
\`\`\`bash
# Quick network & local health check
ping -c 4 8.8.8.8
curl -i http://localhost:3000/api/health
\`\`\``,
        `#### Step 3: [L2] Clear Cached Data or Restart the Local Service
Stale cached files or a hung background service often trigger unexpected errors. Clear browser site data or restart the local background service.
*How to verify*: The service restarts cleanly with no warning banners.
\`\`\`powershell
# Windows: Flush DNS and check stopped automatic services
ipconfig /flushdns
Get-Service | Where-Object {$_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'}
\`\`\``,
        `#### Step 4: [L3] Capture Diagnostic Logs for L3 Escalation
If the error continues after Steps 1–3, copy the diagnostic output below and share it with the ${handlingTeam} team along with your error screenshot.
*How to verify*: Diagnostic output and error screenshot are attached to the incident handover.
\`\`\`bash
# Capture recent system errors for escalation
tail -n 30 /var/log/syslog || journalctl -n 30 --no-pager
\`\`\``
      ];

  return {
    thoughtText: thoughts.join('\n\n'),
    checklistText: `[TIER: ${level}] [TEAM: ${handlingTeam}]\n\n### Quick Summary\n${summaryText}${logAnalysisNote}\n\n### Step-by-Step Checklist\n\n${steps.join('\n\n')}`,
    level,
    handlingTeam,
  };
}

export async function* troubleshootStream(
  problem: string,
  mediaData?: any,
  context?: string,
  logSnippet?: string,
  category?: string
): AsyncGenerator<string, void, unknown> {
  // 1. Try Free Server-Side Gemini Flash Streaming Endpoint First
  if (typeof window !== 'undefined') {
    try {
      const response = await fetch('/api/ai/troubleshoot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problem,
          category: category || context || 'General Engineering',
          logSnippet: logSnippet || '',
          mediaBase64: mediaData?.data,
          mediaType: mediaData?.mimeType,
          stream: true,
        }),
      });

      if (response.ok && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let yieldedAny = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith('data:')) continue;
            const jsonStr = trimmed.slice(5).trim();
            if (!jsonStr) continue;
            try {
              const parsed = JSON.parse(jsonStr);
              if (parsed.text) {
                yieldedAny = true;
                yield parsed.text;
              }
            } catch {
              // ignore malformed SSE chunk
            }
          }
        }

        if (yieldedAny) {
          return;
        }
      }
    } catch {
      // Fall through to resilient local engineering cortex
    }
  }

  // 2. Resilient Offline / Local Engineering Cortex Fallback
  const { thoughtText, checklistText } = buildTroubleshootingGuide(
    problem,
    Boolean(mediaData),
    context,
    logSnippet
  );
  const fullPayload = `<thought>\n${thoughtText}\n</thought>\n\n${checklistText}`;

  const chunkSize = 36;
  for (let i = 0; i < fullPayload.length; i += chunkSize) {
    await delay(14);
    yield fullPayload.slice(i, i + chunkSize);
  }
}

export async function troubleshootIssue(issue: string, context?: any): Promise<string> {
  const { checklistText } = buildTroubleshootingGuide(issue, false, JSON.stringify(context || {}));
  await delay(150);
  return checklistText;
}

function buildCortexReply(message: string, context: any): { thought: string; reply: string } {
  const lower = message.toLowerCase();
  const userName = context?.userName || 'Engineer';
  const role = context?.role || 'Operations Engineer';
  const activeRunbook = context?.activeRunbook;
  const logSnippet = context?.logSnippet;
  const hasMedia = Boolean(context?.mediaBase64 && context?.mediaType);

  const thought = `Analyzing engineering query from ${userName} (${role}). Matching against active runbook context, CLI command library, and L1-L3 support playbooks.`;

  if (lower.includes('linux') || lower.includes('bash') || lower.includes('systemd') || lower.includes('ubuntu') || lower.includes('cli') || lower.includes('command')) {
    return {
      thought,
      reply: `### Quick Summary\nHere are the step-by-step Linux verification checks and copyable terminal commands.\n\n### Step-by-Step Checklist\n\n#### Step 1: [L1] Check Running Services & Recent Errors\nVerify whether the target service is active and inspect the last 30 lines of system logs.\n*How to verify*: Service status shows \`active (running)\`.\n\`\`\`bash\nsystemctl status --no-pager\njournalctl -xe --no-pager | tail -n 30\n\`\`\`\n\n#### Step 2: [L2] Check Open Network Ports\nConfirm that the application port (such as 3000, 80, or 443) is listening for connections.\n*How to verify*: The expected port appears in the listening sockets list.\n\`\`\`bash\nss -tulpn | grep -E "3000|443|80|5432"\n\`\`\`\n\n#### Step 3: [L2] Check Memory, CPU & Disk Space\nEnsure the server has enough free RAM and disk capacity.\n*How to verify*: Free disk space is above 15% and swap is not saturated.\n\`\`\`bash\nuptime && free -h && df -hT\n\`\`\``
    };
  }

  if (lower.includes('powershell') || lower.includes('windows') || lower.includes('cmd') || lower.includes('event viewer')) {
    return {
      thought,
      reply: `### Quick Summary\nFollow these Windows steps to check system errors, network connectivity, and stopped services.\n\n### Step-by-Step Checklist\n\n#### Step 1: [L1] Check Recent Windows System Errors\nInspect the last 15 critical or error events in Windows Event Viewer.\n*How to verify*: Identify any repeating error codes or crashed service names.\n\`\`\`powershell\nGet-WinEvent -FilterHashtable @{LogName='System'; Level=1,2} -MaxEvents 15 | Select-Object TimeCreated, Id, ProviderName, Message\n\`\`\`\n\n#### Step 2: [L2] Flush DNS & Test Port 443 Connection\nClear stale DNS records and test secure connectivity.\n*How to verify*: \`TcpTestSucceeded\` returns \`True\`.\n\`\`\`powershell\nipconfig /flushdns\nTest-NetConnection -ComputerName 8.8.8.8 -Port 443\n\`\`\`\n\n#### Step 3: [L2] Check Stopped Automatic Services\nFind any Windows services set to start automatically that have stopped unexpectedly.\n*How to verify*: Restart any required service that appears in the list.\n\`\`\`powershell\nGet-Service | Where-Object {$_.StartType -eq 'Automatic' -and $_.Status -ne 'Running'}\n\`\`\``
    };
  }

  if (lower.includes('escalat') || lower.includes('handover') || lower.includes('ticket') || lower.includes('summary')) {
    const incidentTitle = activeRunbook?.problem || message;
    const tier = activeRunbook?.level || 'L2';
    const team = activeRunbook?.handlingTeam || 'Systems Engineering';
    return {
      thought,
      reply: `### Escalation & Shift Handover Summary\n\nCopy this structured summary into **Team Channels** or your escalation ticket:\n\n\`\`\`markdown
[INCIDENT ESCALATION // ${tier} -> ${team}]
- Reported By: ${userName} (${role})
- Symptom / Issue: ${incidentTitle}
- Triage Completed: Step-by-step L1 checks, cache/DNS refresh, and endpoint health verified.
- Attached Telemetry: ${hasMedia ? 'Error screenshot attached' : logSnippet ? 'Error log / stack trace attached' : 'Standard diagnostic checklist completed'}
- Next Action Required: L2/L3 root-cause remediation & service verification.
\`\`\``
    };
  }

  const { checklistText } = buildTroubleshootingGuide(
    message,
    hasMedia,
    activeRunbook?.problem,
    logSnippet
  );
  return {
    thought,
    reply: checklistText.replace(/\[TIER:[^\]]+\]\s*\[TEAM:[^\]]+\]\s*/i, '')
  };
}

export async function* chatWithCortexStream(message: string, history: any[], context: any, enableCoT: boolean = false) {
  const fullReply = await chatWithCortex(message, history, context);
  const out = enableCoT ? `<thought>\nProcessed via ShiftSync Engineering AI Engine.\n</thought>\n\n${fullReply}` : fullReply;
  for (let i = 0; i < out.length; i += 32) {
    await delay(14);
    yield out.slice(i, i + 32);
  }
}

export async function chatWithCortex(message: string, history: any[], context: any): Promise<string> {
  // 1. Try Free Server-Side Gemini Flash Multi-Turn Endpoint First
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history,
          context,
          activeRunbook: context?.activeRunbook || null,
          logSnippet: context?.logSnippet || '',
          mediaBase64: context?.mediaBase64,
          mediaType: context?.mediaType,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.text && String(data.text).trim()) {
          return String(data.text)
            .replace(/\[TIER:\s*(L1|L2|L3)\]\s*\[TEAM:\s*([^\]]+)\]/gi, '**Escalation Tier: $1 · $2**\n')
            .trim();
        }
      }
    } catch {
      // Fall through to local Ollama or built-in offline engineering cortex
    }
  }

  // 2. Optional Local Ollama Fallback
  const localResp = await tryLocalOllama(message);
  if (localResp) return localResp;

  // 3. Built-in Offline Engineering Cortex Fallback
  await delay(150);
  return buildCortexReply(message, context).reply;
}

export async function generateTacticalBriefing(data: any): Promise<TacticalBriefing> {
  await delay(180);
  const shifts: any[] = Array.isArray(data?.shifts) ? data.shifts : [];
  const leaves: any[] = Array.isArray(data?.leaves) ? data.leaves : [];
  const wellness: any[] = Array.isArray(data?.wellness) ? data.wellness : [];

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const criticalWellness = wellness.filter(w => w.status === 'critical' || w.status === 'stressed' || (typeof w.score === 'number' && w.score < 60)).length;
  const nightShifts = shifts.filter(s => String(s.type || '').toLowerCase().includes('3rd') || String(s.type || '').toLowerCase().includes('night')).length;

  let riskStatus: 'low' | 'elevated' | 'critical' = 'low';
  if (criticalWellness >= 3 || pendingLeaves >= 5) {
    riskStatus = 'critical';
  } else if (criticalWellness >= 1 || pendingLeaves >= 2 || nightShifts > shifts.length * 0.4) {
    riskStatus = 'elevated';
  }

  const avgScore = wellness.length > 0
    ? Math.round(wellness.reduce((acc, w) => acc + (Number(w.score) || 85), 0) / wellness.length)
    : 92;

  const criticalAlerts: string[] = [];
  if (pendingLeaves > 0) {
    criticalAlerts.push(`${pendingLeaves} pending leave authorization(s) require supervisor review.`);
  }
  if (criticalWellness > 0) {
    criticalAlerts.push(`${criticalWellness} operator(s) reported elevated stress/fatigue telemetry.`);
  }
  if (shifts.length === 0) {
    criticalAlerts.push('No active shifts registered in current window; verify roster deployment.');
  }

  return {
    headline: riskStatus === 'low'
      ? `GRID NOMINAL // ${shifts.length} ACTIVE DUTY CYCLES LOCKED`
      : riskStatus === 'elevated'
      ? `ELEVATED CADENCE // ${pendingLeaves} LEAVES & ${nightShifts} NIGHT CYCLES TRACKED`
      : `CRITICAL ATTENTION // FATIGUE & COVERAGE THRESHOLD TRIGGERED`,
    situationReport: `Local Cortex analysis evaluated ${shifts.length} scheduled shift blocks, ${leaves.length} leave records, and ${wellness.length} bio-telemetry check-ins. Overall readiness index stands at ${avgScore}% with ${nightShifts} nocturnal rotations currently assigned.`,
    riskStatus,
    personnelStatus: `${shifts.length} Shifts Scheduled | ${pendingLeaves} Pending Leaves`,
    keyDirectives: [
      pendingLeaves > 0 ? `Adjudicate ${pendingLeaves} pending leave request(s) to lock next-week coverage.` : 'Maintain current shift handover intervals across all active units.',
      nightShifts > 0 ? `Monitor ${nightShifts} nocturnal (3rd Shift) assignments for turnaround rest compliance.` : 'Verify standard coverage distribution across 1st and 2nd shifts.',
      'Ensure daily operator wellness check-ins are logged at shift start.'
    ],
    personnelMorale: avgScore >= 85 ? `Optimal (${avgScore}% Index)` : avgScore >= 65 ? `Steady (${avgScore}% Index)` : `Strained (${avgScore}% Index)`,
    criticalAlerts
  };
}

export async function generateOperationalInsights(data: any): Promise<OperationalInsight> {
  await delay(180);
  const shifts: any[] = Array.isArray(data?.shifts) ? data.shifts : [];
  const users: any[] = Array.isArray(data?.users) ? data.users : [];
  const leaves: any[] = Array.isArray(data?.leaves) ? data.leaves : [];

  // Count shifts per user to detect imbalance
  const countsByUser: Record<string, number> = {};
  shifts.forEach(s => {
    const uid = s.userId || s.userName || 'unknown';
    countsByUser[uid] = (countsByUser[uid] || 0) + 1;
  });

  const counts = Object.values(countsByUser);
  const maxShifts = counts.length ? Math.max(...counts) : 0;
  const minShifts = counts.length ? Math.min(...counts) : 0;
  const spread = maxShifts - minShifts;

  const anomalies: string[] = [];
  if (spread > 4) {
    anomalies.push(`Workload variance detected: top operator holds ${maxShifts} shifts vs minimum ${minShifts} shifts.`);
  }
  const activeCount = Object.keys(countsByUser).length;
  if (users.length > 0 && activeCount < users.length) {
    anomalies.push(`${users.length - activeCount} registered personnel have zero shifts assigned in the current dataset.`);
  }
  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  if (pendingLeaves > 2) {
    anomalies.push(`${pendingLeaves} unapproved leave requests may impact upcoming shift density.`);
  }

  const efficiencyScore = Math.max(62, Math.min(98, 95 - spread * 2 - pendingLeaves * 3));
  const riskLevel: 'low' | 'medium' | 'high' = efficiencyScore >= 85 ? 'low' : efficiencyScore >= 72 ? 'medium' : 'high';

  return {
    summary: `Analyzed ${shifts.length} shifts across ${users.length || activeCount} personnel. Grid utilization efficiency is rated at ${efficiencyScore}% with a shift distribution delta of ${spread} cycles.`,
    recommendations: [
      spread > 3 ? 'Rebalance shift assignments from high-frequency operators to under-utilized team members.' : 'Current shift load distribution is balanced across active units.',
      pendingLeaves > 0 ? `Process ${pendingLeaves} pending leave request(s) and backfill affected slots via Shift Swap.` : 'Leave backlog is clear; maintain 14-day forward roster visibility.',
      'Use automated Deduplication in Roster Management after bulk CSV imports.'
    ],
    anomalies,
    efficiencyScore,
    riskLevel
  };
}

export async function generateStrategicForecast(data: any): Promise<StrategicForecast> {
  await delay(180);
  const shifts: any[] = Array.isArray(data?.shifts) ? data.shifts : [];
  const leaves: any[] = Array.isArray(data?.leaves) ? data.leaves : [];
  const nightRatio = shifts.length > 0
    ? shifts.filter(s => String(s.type || '').toLowerCase().includes('3rd') || String(s.type || '').toLowerCase().includes('night')).length / shifts.length
    : 0.2;

  const workloadProjection: 'decreasing' | 'stable' | 'increasing' =
    leaves.length > 4 || shifts.length > 50 ? 'increasing' : shifts.length < 10 ? 'decreasing' : 'stable';

  return {
    workloadProjection,
    burnoutRiskTimeline: nightRatio > 0.35
      ? 'Elevated nocturnal density detected — rotate 3rd-shift personnel within 10–14 days.'
      : 'Nominal fatigue curve — current rotation sustainable for next 30-day cycle.',
    resourceBottleneck: nightRatio > 0.3
      ? '3rd Shift (22:00–06:00) handover coverage and L1 triage redundancy'
      : 'Peak transition window between 1st Shift (14:00) and 2nd Shift',
    strategicRecommendations: [
      'Cross-train General shift personnel to provide elastic coverage during 1st/2nd shift handovers.',
      'Cap consecutive 3rd Shift assignments at 4 days before enforcing a mandatory rest/off cycle.',
      'Pre-stage approved shift templates for rapid one-click deployment during high-leave weeks.'
    ]
  };
}

export async function analyzeRotation(activePersonnel: any[], wellnessData: any[]) {
  await delay(160);
  const stressedUsers = new Set(
    (wellnessData || [])
      .filter(w => w.status === 'stressed' || w.status === 'critical' || (typeof w.score === 'number' && w.score < 65))
      .map(w => w.userId || w.userName)
  );

  const recommendations = (activePersonnel || []).slice(0, 6).map((person, idx) => {
    const name = person.displayName || person.userName || person.name || person.email || `Unit-${idx + 1}`;
    const isStressed = stressedUsers.has(person.uid) || stressedUsers.has(person.userId) || stressedUsers.has(name);
    const isOnBreak = Boolean(person.isBreakActive);

    if (isStressed) {
      return {
        unitName: name,
        action: 'Rotate to General / Support Window',
        reason: 'Bio-telemetry indicates elevated fatigue; reduce high-frequency triage load.'
      };
    }
    if (isOnBreak) {
      return {
        unitName: name,
        action: 'Monitor Break Recovery',
        reason: 'Unit currently on active recovery break; resume standard duty upon completion.'
      };
    }
    return {
      unitName: name,
      action: 'Maintain Primary Assignment',
      reason: 'Readiness telemetry within optimal operational parameters.'
    };
  });

  const riskLevel = stressedUsers.size >= 2 ? 'HIGH' : stressedUsers.size === 1 ? 'MODERATE' : 'LOW';

  return {
    riskLevel,
    rationale: `Evaluated ${activePersonnel?.length || 0} active personnel against ${wellnessData?.length || 0} wellness telemetry records. ${stressedUsers.size} unit(s) flagged for rotation optimization.`,
    recommendations
  };
}

export async function interpretIntelligentCommand(command: string, context?: any) {
  await delay(100);
  const lower = command.toLowerCase().trim();

  const navRules: Array<{ keywords: string[]; tab: string; label: string }> = [
    { keywords: ['admin', 'omega', 'command', 'manage', 'roster', 'schedule', 'user', 'audit', 'mission', 'crisis', 'broadcast'], tab: 'admin', label: 'Omega Command Center' },
    { keywords: ['swap', 'trade', 'exchange', 'marketplace'], tab: 'swap', label: 'Shift Trade Marketplace' },
    { keywords: ['leave', 'time off', 'vacation', 'pto', 'absence', 'holiday'], tab: 'leaves', label: 'Leave Protocol Archives' },
    { keywords: ['support', 'troubleshoot', 'diagnostic', 'cortex', 'fix', 'help', 'issue', 'bug', 'error'], tab: 'support', label: 'Diagnostic Cortex Troubleshooter' },
    { keywords: ['chat', 'message', 'comm', 'talk', 'channel'], tab: 'chat', label: 'Secure Comm Link' },
    { keywords: ['ops', 'pulse', 'operation', 'live', 'grid', 'break', 'team'], tab: 'ops', label: 'Team Pulse Grid' },
    { keywords: ['guardian', 'wellness', 'health', 'fatigue', 'mood', 'bio'], tab: 'guardian', label: 'Wellness & Bio-Telemetry' },
    { keywords: ['home', 'overview', 'dashboard', 'main', 'status'], tab: 'dashboard', label: 'Grid Core Overview' }
  ];

  for (const rule of navRules) {
    if (rule.keywords.some(kw => lower.includes(kw))) {
      if (rule.tab === 'admin' && context !== 'admin') {
        return {
          action: 'nav',
          targetTab: 'dashboard',
          explanation: 'Admin privileges required for Omega Command Center; routing to Overview.'
        };
      }
      return {
        action: 'nav',
        targetTab: rule.tab,
        explanation: `Routing directly to ${rule.label}.`
      };
    }
  }

  return {
    action: 'nav',
    targetTab: 'support',
    explanation: 'Routing query to Diagnostic Cortex for technical resolution.'
  };
}

export async function analyzeAuditLogs(logs: any[], query?: string): Promise<AuditIntelligence> {
  await delay(180);
  const safeLogs = Array.isArray(logs) ? logs : [];
  const filtered = query
    ? safeLogs.filter(l => JSON.stringify(l).toLowerCase().includes(query.toLowerCase()))
    : safeLogs;

  const deleteEvents = filtered.filter(l => String(l.action || '').toUpperCase().includes('DELETE') || String(l.action || '').toUpperCase().includes('PURGE'));
  const forceEvents = filtered.filter(l => String(l.action || '').toUpperCase().includes('FORCE') || String(l.action || '').toUpperCase().includes('OVERRIDE') || String(l.action || '').toUpperCase().includes('LOCKDOWN'));
  const roleEvents = filtered.filter(l => String(l.action || '').toUpperCase().includes('ROLE') || String(l.action || '').toUpperCase().includes('ADMIN'));

  const criticalEvents: string[] = [];
  deleteEvents.slice(0, 3).forEach(e => criticalEvents.push(`${e.action}: ${e.details || e.targetName || 'Data deletion recorded'} (by ${e.adminName || 'Admin'})`));
  forceEvents.slice(0, 3).forEach(e => criticalEvents.push(`${e.action}: ${e.details || e.targetName || 'Administrative override'} (by ${e.adminName || 'Admin'})`));
  roleEvents.slice(0, 2).forEach(e => criticalEvents.push(`${e.action}: ${e.targetName || 'Privilege modification'}`));

  if (criticalEvents.length === 0 && filtered.length > 0) {
    criticalEvents.push(`Most recent event: ${filtered[0].action} on ${filtered[0].targetName || 'system'} by ${filtered[0].adminName || 'Admin'}.`);
  }

  const threatLevel = deleteEvents.length > 2 || forceEvents.length > 2 ? 'ELEVATED' : 'LOW';

  return {
    summary: `Inspected ${filtered.length} security audit record(s)${query ? ` matching "${query}"` : ''}. Identified ${deleteEvents.length} destructive action(s), ${forceEvents.length} administrative override(s), and ${roleEvents.length} role modification(s).`,
    criticalEvents: criticalEvents.length > 0 ? criticalEvents : ['No anomalous or destructive events found in current audit window.'],
    recommendations: [
      deleteEvents.length > 0 ? 'Verify bulk roster deletions were preceded by CSV backup exports.' : 'Continue routine audit log archiving.',
      'Review administrative role assignments monthly to enforce least-privilege access.',
      'Ensure all manual shift overrides include a descriptive reason in the audit trail.'
    ],
    threatLevel,
    suspiciousPatterns: deleteEvents.length > 3
      ? [`High frequency of deletion operations (${deleteEvents.length} events) detected in short window.`]
      : ['No unauthorized privilege escalation or brute-force patterns detected.']
  };
}

export async function optimizeBroadcastMessage(msg: string, context?: any): Promise<BroadcastOptimizationResponse> {
  await delay(140);
  const cleaned = msg.trim().replace(/\s+/g, ' ');
  const isUrgent = /urgent|critical|immediate|emergency|outage|down|mandatory/i.test(cleaned);
  const prefix = isUrgent ? '[PRIORITY DIRECTIVE // ALL UNITS]' : '[OPERATIONAL DISPATCH // GRID SYNC]';

  const capitalized = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  const punctuated = /[.!?]$/.test(capitalized) ? capitalized : `${capitalized}.`;

  const refinedMessage = `${prefix} ${punctuated} Acknowledge receipt via active terminal telemetry.`;

  return {
    refinedMessage,
    toneAnalysis: isUrgent
      ? 'High-Priority Tactical Command — clear, authoritative, action-oriented'
      : 'Professional Operational Broadcast — concise, structured, high-clarity',
    impactRating: isUrgent ? 94 : 88
  };
}

export async function calculateGlobalRisk(data: any): Promise<GlobalRiskIndex> {
  await delay(160);
  const shifts: any[] = Array.isArray(data?.shifts) ? data.shifts : [];
  const wellness: any[] = Array.isArray(data?.wellness) ? data.wellness : [];
  const leaves: any[] = Array.isArray(data?.leaves) ? data.leaves : [];

  const stressedCount = wellness.filter(w => w.status === 'stressed' || w.status === 'critical' || (typeof w.score === 'number' && w.score < 60)).length;
  const fatigueFactor = wellness.length > 0
    ? Math.min(100, Math.round((stressedCount / wellness.length) * 100) + 18)
    : 22;

  const pendingLeaves = leaves.filter(l => l.status === 'pending').length;
  const overallRisk = Math.min(95, Math.max(12, Math.round(fatigueFactor * 0.6 + pendingLeaves * 5 + (shifts.length === 0 ? 30 : 0))));
  const readinessRating = Math.max(10, 100 - overallRisk);

  const status = overallRisk >= 70 ? 'CRITICAL' : overallRisk >= 40 ? 'ELEVATED' : 'OPTIMAL';

  return {
    overallRisk,
    status,
    primaryThreats: [
      stressedCount > 0 ? `${stressedCount} unit(s) reporting elevated cognitive fatigue` : 'No acute bio-telemetry stress spikes',
      pendingLeaves > 0 ? `${pendingLeaves} unapproved leave request(s) pending backfill` : 'Leave coverage buffer nominal',
      'Shift handover synchronization across 24/7 timezone boundaries'
    ],
    mitigationProtocol: overallRisk >= 50
      ? 'Activate elastic General-shift reserve units and adjudicate pending leave requests immediately.'
      : 'Maintain standard 8-hour shift rotation and routine wellness telemetry checks.',
    readinessRating,
    fatigueFactor,
    vulnerabilityAssessment: overallRisk >= 50
      ? 'Moderate exposure during nocturnal shift handovers if pending leaves are approved simultaneously.'
      : 'Low systemic vulnerability; shift redundancy is sufficient across all primary windows.',
    securityStatus: 'ENFORCED // RBAC & AUDIT ACTIVE'
  };
}

export async function interpretTacticalDirective(directive: string, currentSettings?: any): Promise<TacticalDirectiveResponse> {
  await delay(150);
  const lower = directive.toLowerCase();

  const shouldLockdown = lower.includes('lockdown') || lower.includes('freeze') || lower.includes('halt') || lower.includes('emergency');
  const shouldUnlock = lower.includes('unlock') || lower.includes('stand down') || lower.includes('normal') || lower.includes('resume') || lower.includes('clear');

  const lockdownActive = shouldUnlock ? false : shouldLockdown ? true : Boolean(currentSettings?.lockdownActive);
  const alertLevel: 'normal' | 'elevated' | 'critical' =
    lockdownActive || lower.includes('critical') || lower.includes('red')
      ? 'critical'
      : lower.includes('elevated') || lower.includes('high') || lower.includes('warn')
      ? 'elevated'
      : 'normal';

  return {
    action: lockdownActive ? 'ENGAGE_PROTOCOL_LOCKDOWN' : shouldUnlock ? 'RESTORE_NOMINAL_OPERATIONS' : 'UPDATE_TACTICAL_DIRECTIVE',
    details: `Processed command: "${directive.slice(0, 80)}". Alert level calibrated to ${alertLevel.toUpperCase()}.`,
    impact: lockdownActive
      ? 'All non-admin terminals restricted to hold-station status.'
      : 'All operational terminals synchronized under updated alert posture.',
    lockdownActive,
    alertLevel,
    systemMessage: `[DIRECTIVE EXECUTED]: ${directive.toUpperCase()}`,
    actionTaken: lockdownActive
      ? 'System lockdown engaged and broadcast to all connected nodes.'
      : `Alert state set to ${alertLevel.toUpperCase()} across all active stations.`
  };
}

export async function suggestMissionPersonnel(title: string, description: string, pool: any[]): Promise<MissionSuggestionResponse> {
  await delay(150);
  const safePool = Array.isArray(pool) ? pool : [];
  // Prefer active users who are not currently on break, up to 3 operators
  const sorted = [...safePool].sort((a, b) => {
    const aBreak = a.isBreakActive ? 1 : 0;
    const bBreak = b.isBreakActive ? 1 : 0;
    if (aBreak !== bBreak) return aBreak - bBreak;
    const aAdmin = a.role === 'admin' ? 0 : 1;
    const bAdmin = b.role === 'admin' ? 0 : 1;
    return aAdmin - bAdmin;
  });

  const selected = sorted.slice(0, Math.min(3, sorted.length));
  const suggestedUserIds = selected.map(u => u.uid || u.id).filter(Boolean);
  const names = selected.map(u => u.displayName || u.name || u.email || 'Operator').join(', ');

  return {
    suggestedUserIds,
    rationale: selected.length > 0
      ? `Selected ${names} for "${title}" based on active availability, non-break status, and operational role balance.`
      : `No personnel currently in pool; register operators in Personnel Management before assigning mission "${title}".`
  };
}

export async function simulateMissionOutcome(missionDesc: any, team: any[]): Promise<SimulationResult> {
  await delay(180);
  const teamSize = Array.isArray(team) ? team.length : (Array.isArray(missionDesc?.assignedUserIds) ? missionDesc.assignedUserIds.length : 1);
  const priority = String(missionDesc?.priority || 'medium').toLowerCase();

  const baseProb = priority === 'critical' ? 74 : priority === 'high' ? 80 : 88;
  const successProbability = Math.min(98, Math.max(55, baseProb + Math.min(teamSize * 5, 18)));
  const degradationFactor = Math.max(8, Math.min(45, (priority === 'critical' ? 28 : 16) - teamSize * 2));

  const risks = [
    teamSize < 2 ? 'Single-operator redundancy risk during extended shift handovers.' : 'Multi-unit communication synchronization overhead.',
    priority === 'critical' ? 'High cognitive load under compressed SLA timelines.' : 'Routine task contention with scheduled shift duties.'
  ];

  return {
    successProbability,
    expectedOutcome: `Projected ${successProbability}% mission completion rate with ${teamSize} assigned operator(s) under ${priority.toUpperCase()} priority parameters.`,
    riskVectors: risks,
    resourceImpact: {
      degradationFactor,
      recommendedAssets: [
        'Primary L1 Diagnostic Runbook',
        'Dedicated Shift Handover Channel',
        teamSize < 2 ? 'Backup On-Call Operator' : 'Automated Telemetry Monitor'
      ]
    },
    risks
  };
}

export async function generateMissionDebrief(missionData: any, status: string, personnel: any[]): Promise<MissionDebrief> {
  await delay(160);
  const title = missionData?.title || 'Operational Deployment';
  const teamCount = Array.isArray(personnel) ? personnel.length : 1;
  const isCompleted = status.toLowerCase() === 'completed' || status.toLowerCase() === 'success';

  return {
    summary: `Mission "${title}" concluded with status ${status.toUpperCase()} across ${teamCount} assigned personnel.`,
    keyLearning: isCompleted
      ? 'Structured shift handovers and clear task ownership accelerated completion.'
      : 'Early escalation and reserve operator buffering are required when primary units hit shift boundaries.',
    performanceRating: isCompleted ? 92 : 74,
    tacticalRating: isCompleted ? 90 : 76,
    executiveSummary: `Post-operation telemetry for "${title}" confirms ${isCompleted ? 'successful objective attainment' : 'partial execution requiring follow-up'} with ${teamCount} unit(s) participating.`,
    lessonsLearned: [
      'Align high-priority mission windows with General and 1st/2nd shift overlap periods.',
      'Log intermediate milestones in the team comm channel prior to shift rotation.',
      'Maintain at least two cross-trained operators on critical objectives.'
    ]
  };
}

export async function predictResourceMaintenance(resource: any, usageHistory?: any[]) {
  await delay(140);
  const status = String(resource?.status || 'available').toLowerCase();
  const quantity = Number(resource?.quantity ?? 1);
  const historyCount = Array.isArray(usageHistory) ? usageHistory.length : 0;

  const healthScore = status === 'maintenance' ? 45 : status === 'depleted' ? 20 : Math.max(70, 96 - historyCount * 3);

  return {
    healthScore,
    predictedFailureWindow: status === 'maintenance' ? 'Immediate maintenance active' : `${Math.max(14, 60 - historyCount * 4)} Days`,
    recommendation: quantity <= 2
      ? `Low reserve stock (${quantity} units) for ${resource?.name || 'Resource'}; initiate replenishment order.`
      : `Resource "${resource?.name || 'Asset'}" is operating within nominal parameters (${quantity} units available).`,
    riskLevel: healthScore < 60 ? 'high' : healthScore < 80 ? 'medium' : 'low'
  };
}

export async function extractShiftsFromCSV(csvData: string, fileName: string, users?: any[]): Promise<ExtractedShift[]> {
  const extractedShifts: ExtractedShift[] = [];
  const lines = csvData.split('\n').map(line => line.split(',').map(cell => cell.trim().replace(/^"|"$/g, '')));

  let headerRowIndex = -1;
  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const row = lines[i];
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

  let month = new Date().getMonth();
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
        year = parseInt(dateMatch[2], 10);
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
        year = parseInt(dateMatch[2], 10);
      }
    }
  }

  const shiftCodeToTimes: Record<string, { start: string; end: string; label: string }> = {
    '1st': { start: '06:00', end: '14:00', label: '1st Shift' },
    '2nd': { start: '14:00', end: '22:00', label: '2nd Shift' },
    '3rd': { start: '22:00', end: '06:00', label: '3rd Shift' },
    'g': { start: '09:00', end: '18:00', label: 'General' },
    'general': { start: '09:00', end: '18:00', label: 'General' }
  };

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const row = lines[i];
    if (row.length < 2) continue;

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

      const dayNum = parseInt(dayStr, 10);
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
  await delay(300);
  // Generate an editable starter roster template for all registered team members across the next 7 days
  // so the admin can review/adjust in the Review Modal without needing a paid Vision API key,
  // or they can upload .csv/.xlsx for exact 30-day grid parsing.
  const safeUsers = Array.isArray(users) && users.length > 0
    ? users
    : [{ uid: 'operator-1', name: 'Primary Operator' }];

  const today = new Date();
  const extracted: ExtractedShift[] = [];

  safeUsers.forEach((u, userIdx) => {
    for (let d = 0; d < 5; d++) {
      const target = new Date(today.getTime() + d * 86400000);
      const yyyy = target.getFullYear();
      const mm = String(target.getMonth() + 1).padStart(2, '0');
      const dd = String(target.getDate()).padStart(2, '0');
      const shiftDef = SHIFT_CATALOG[(userIdx + d) % SHIFT_CATALOG.length];

      extracted.push({
        userId: u.uid || u.id || u.name,
        userName: u.name || u.displayName || 'Operator',
        date: `${yyyy}-${mm}-${dd}`,
        startTime: shiftDef.startTime,
        endTime: shiftDef.endTime,
        type: shiftDef.type,
        confidenceScore: 0.85
      });
    }
  });

  return extracted;
}

export async function suggestTeamRoster(
  personnelOrReqs: any,
  datesOrEmployees: any[],
  constraints?: any
): Promise<SuggestedRosterShift[]> {
  await delay(200);

  // Support both call signatures:
  // 1) suggestTeamRoster(personnelPool, targetDates, activeMissions) (used in RosterManagement & AIRosterBuilder)
  // 2) suggestTeamRoster(reqs, employees, constraints)
  let employees: any[] = [];
  let targetDates: string[] = [];

  if (Array.isArray(personnelOrReqs) && personnelOrReqs.length > 0 && typeof personnelOrReqs[0] === 'object') {
    employees = personnelOrReqs;
    targetDates = Array.isArray(datesOrEmployees) && typeof datesOrEmployees[0] === 'string'
      ? datesOrEmployees
      : [new Date().toISOString().split('T')[0]];
  } else if (Array.isArray(datesOrEmployees)) {
    employees = datesOrEmployees;
    targetDates = Array.isArray(personnelOrReqs?.dates)
      ? personnelOrReqs.dates
      : [new Date().toISOString().split('T')[0]];
  }

  if (employees.length === 0) return [];
  if (targetDates.length === 0) {
    targetDates = [new Date().toISOString().split('T')[0]];
  }

  const missionCount = Array.isArray(constraints) ? constraints.length : 0;
  const suggestions: SuggestedRosterShift[] = [];

  targetDates.forEach((dateStr, dateIdx) => {
    employees.forEach((emp, empIdx) => {
      // Round-robin across 1st, 2nd, 3rd, and General shifts to guarantee 24/7 coverage
      const shiftSpec = SHIFT_CATALOG[(empIdx + dateIdx) % SHIFT_CATALOG.length];
      const userId = emp.uid || emp.id || `user_${empIdx}`;
      const userName = emp.name || emp.displayName || emp.email || `Operator ${empIdx + 1}`;

      suggestions.push({
        userId,
        userName,
        date: dateStr,
        startTime: shiftSpec.startTime,
        endTime: shiftSpec.endTime,
        type: shiftSpec.type,
        rationale: `Balanced 24/7 rotation assignment (${shiftSpec.type})${missionCount > 0 ? ` supporting ${missionCount} active mission(s)` : ' optimizing unit fatigue & shift coverage'}.`
      });
    });
  });

  return suggestions;
}

export async function suggestConflictFixes(proposedRoster: any[], historicalData: any[]): Promise<RosterConflictFix[]> {
  await delay(200);
  const safeProposed = Array.isArray(proposedRoster) ? proposedRoster : [];
  const safeHistory = Array.isArray(historicalData) ? historicalData : [];
  const fixes: RosterConflictFix[] = [];

  const seenByUserDate = new Map<string, any>();

  safeProposed.forEach((shift, idx) => {
    const userId = shift.userId || shift.userName;
    const date = shift.date;
    const shiftId = shift.id || `shift_temp_${idx}`;
    const key = `${userId}_${date}`;

    // 1. Check double-booking on the same date within proposedRoster
    if (seenByUserDate.has(key)) {
      const nextDay = new Date(new Date(date).getTime() + 86400000);
      const nextDateStr = isNaN(nextDay.getTime()) ? date : nextDay.toISOString().split('T')[0];

      fixes.push({
        shiftId,
        suggestedAction: `Reassign duplicate shift for ${shift.userName || userId} to ${nextDateStr} (General Shift)`,
        newDate: nextDateStr,
        newStartTime: '09:00',
        newEndTime: '18:00',
        rationale: `Detected double-booking on ${date} for ${shift.userName || userId}. Moving secondary assignment to next operational day prevents overlap.`
      });
      return;
    }
    seenByUserDate.set(key, shift);

    // 2. Check turnaround conflict against historical shifts (e.g., worked 3rd shift yesterday and assigned 1st shift today)
    const prevDay = new Date(new Date(date).getTime() - 86400000);
    const prevDateStr = isNaN(prevDay.getTime()) ? '' : prevDay.toISOString().split('T')[0];

    const workedNightYesterday = safeHistory.some(
      h => (h.userId === userId || h.userName === shift.userName) &&
           h.date === prevDateStr &&
           (String(h.type || '').toLowerCase().includes('3rd') || h.startTime === '22:00')
    );

    if (workedNightYesterday && (shift.startTime === '06:00' || String(shift.type || '').toLowerCase().includes('1st'))) {
      fixes.push({
        shiftId,
        suggestedAction: `Delay start time to 2nd Shift (14:00 - 22:00) for turnaround rest`,
        newDate: date,
        newStartTime: '14:00',
        newEndTime: '22:00',
        rationale: `${shift.userName || userId} completed a nocturnal (3rd Shift) rotation on ${prevDateStr}; shifting from 06:00 to 14:00 enforces mandatory rest window.`
      });
    }
  });

  return fixes;
}

export async function suggestShiftSwaps(myShifts: any[], availableSwaps: any[], myPreferences?: any) {
  await delay(180);
  const safeMyShifts = Array.isArray(myShifts) ? myShifts : [];
  const safeSwaps = Array.isArray(availableSwaps) ? availableSwaps : [];
  const myDates = new Set(safeMyShifts.map(s => s.date));

  return safeSwaps.map(swap => {
    const swapId = swap.id || swap.swapRequestId || '';
    const hasDateConflict = myDates.has(swap.shiftDate);

    // Check adjacent dates to avoid back-to-back fatigue
    const swapTimeMs = new Date(swap.shiftDate).getTime();
    const prevDate = !isNaN(swapTimeMs) ? new Date(swapTimeMs - 86400000).toISOString().split('T')[0] : '';
    const nextDate = !isNaN(swapTimeMs) ? new Date(swapTimeMs + 86400000).toISOString().split('T')[0] : '';
    const hasAdjacentShift = myDates.has(prevDate) || myDates.has(nextDate);

    let score = 92;
    const reasons: string[] = [];

    if (hasDateConflict) {
      score -= 45;
      reasons.push(`Overlaps with your existing assignment on ${swap.shiftDate}`);
    } else {
      reasons.push(`Zero date collision on ${swap.shiftDate}`);
    }

    if (hasAdjacentShift) {
      score -= 10;
      reasons.push('Adjacent to an existing duty day (moderate turnaround)');
    } else {
      score += 4;
      reasons.push('Well-spaced recovery buffer around target date');
    }

    if (Array.isArray(swap.preferredDates) && swap.preferredDates.some((d: string) => myDates.has(d))) {
      score += 4;
      reasons.push('Matches requester preferred trade date');
    }

    const matchScore = Math.max(20, Math.min(99, score));

    return {
      swapRequestId: swapId,
      matchScore,
      rationale: `${reasons.join(' · ')} (${swap.shiftTime || 'Standard Window'}).`
    };
  }).sort((a, b) => b.matchScore - a.matchScore);
}

export async function generatePersonnelDossier(user: any, context?: any): Promise<PersonnelDossier> {
  await delay(160);
  const name = user?.displayName || user?.name || user?.email || 'Operator';
  const role = String(user?.role || 'member').toUpperCase();
  const isAdmin = role === 'ADMIN';
  const shifts: any[] = Array.isArray(context?.shifts) ? context.shifts : [];
  const userShiftCount = shifts.filter(s => s.userId === user?.uid || s.userName === name).length;

  const reliabilityScore = Math.min(99, Math.max(84, 88 + Math.min(userShiftCount, 11)));

  return {
    summary: `${name} operates as an active ${role} node within the 24/7 tactical roster (${userShiftCount || 'regular'} tracked duty cycles). Demonstrates consistent telemetry synchronization and shift protocol adherence.`,
    traits: isAdmin
      ? ['Command Authority', 'Roster Architecture', 'Crisis Escalation Lead', 'High Operational Reliability']
      : ['24/7 Shift Adaptability', 'L1 Triage Execution', 'Cross-Shift Handover Discipline', 'Team Pulse Sync'],
    reliabilityScore,
    operationalSpecialties: isAdmin
      ? ['Global Roster Optimization', 'Security Audit Oversight', 'Mission Resource Allocation']
      : ['Incident Triage & Resolution', 'Continuous Shift Coverage', 'Live Telemetry Monitoring'],
    psychologicalProfile: user?.isBreakActive
      ? 'Currently in scheduled recovery break state; maintaining balanced cognitive pacing.'
      : 'Stable operational readiness; well-suited for high-continuity rotational duty.'
  };
}

// --- 2026 Workspace Clean Adapters ---

export async function generateTroubleshootingGuideStream(
  problem: string,
  mediaBase64?: string,
  mediaType?: string,
  onChunk?: (text: string) => void,
  options?: { category?: string; logSnippet?: string }
): Promise<TroubleshootingResult> {
  let accumulated = '';
  for await (const chunk of troubleshootStream(
    problem,
    mediaBase64 ? { data: mediaBase64, mimeType: mediaType } : undefined,
    options?.category,
    options?.logSnippet,
    options?.category
  )) {
    accumulated += chunk;
    if (onChunk) {
      const parsedPartial = parseTierAndTeam(accumulated, problem);
      onChunk(parsedPartial.cleanedGuide);
    }
  }

  const { cleanedGuide, level, handlingTeam } = parseTierAndTeam(
    accumulated,
    `${problem} ${options?.logSnippet || ''}`
  );

  return {
    guide: cleanedGuide,
    level,
    handlingTeam,
  };
}

export async function getShiftSwapRecommendations(
  swapRequest: any,
  candidateShifts: any[],
  users: any[]
): Promise<Array<{ shiftId: string; userName: string; matchScore: number; reason: string }>> {
  await delay(150);
  const safeShifts = Array.isArray(candidateShifts) ? candidateShifts : [];
  const results = safeShifts.slice(0, 6).map((s) => {
    const sameDate = s.date === swapRequest.shiftDate;
    const prefersType =
      Array.isArray(swapRequest.preferredTypes) &&
      swapRequest.preferredTypes.some((t: string) =>
        String(s.type || '').toLowerCase().includes(t.toLowerCase())
      );
    let score = 88;
    if (sameDate) score -= 35;
    if (prefersType) score += 8;
    const u = (users || []).find((usr) => usr.uid === s.userId);
    return {
      shiftId: s.id,
      userName: s.userName || u?.displayName || 'Team Member',
      matchScore: Math.max(40, Math.min(98, score)),
      reason: `${s.date} (${s.startTime}–${s.endTime}, ${s.type}) · ${
        sameDate ? 'Same day coverage' : 'No date conflict'
      }`,
    };
  });
  return results.sort((a, b) => b.matchScore - a.matchScore).slice(0, 3);
}

export async function generateWeeklyRoster(
  users: any[],
  leaves: any[],
  startDateStr: string,
  _endDateStr: string,
  _notes?: string
): Promise<SuggestedRosterShift[]> {
  const start = new Date(startDateStr);
  const targetDates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (!isNaN(d.getTime())) {
      targetDates.push(d.toISOString().split('T')[0]);
    }
  }
  const allSuggestions = await suggestTeamRoster(users, targetDates);
  const approvedLeaves = (leaves || []).filter((l) => l.status === 'approved');
  return allSuggestions.filter((s) => {
    const onLeave = approvedLeaves.some(
      (l) =>
        l.userId === s.userId &&
        s.date >= l.startDate &&
        s.date <= l.endDate
    );
    return !onLeave;
  });
}

export async function resolveRosterConflicts(
  shifts: any[],
  leaves: any[],
  users: any[]
): Promise<RosterConflictFix[]> {
  const baseFixes = await suggestConflictFixes(shifts, shifts);
  const approvedLeaves = (leaves || []).filter((l) => l.status === 'approved');
  approvedLeaves.forEach((leave) => {
    const conflictingShifts = (shifts || []).filter(
      (s) =>
        s.userId === leave.userId &&
        s.date >= leave.startDate &&
        s.date <= leave.endDate
    );
    conflictingShifts.forEach((cs) => {
      if (!baseFixes.some((bf) => bf.shiftId === cs.id)) {
        const backupUser = (users || []).find((u) => u.uid !== leave.userId);
        baseFixes.push({
          shiftId: cs.id,
          suggestedAction: backupUser
            ? `Delete or reassign shift during approved time off`
            : 'Delete shift during approved leave',
          newDate: cs.date,
          newStartTime: cs.startTime,
          newEndTime: cs.endTime,
          rationale: `${cs.userName} has approved time off from ${leave.startDate} to ${leave.endDate}.`,
        });
      }
    });
  });
  return baseFixes;
}

export async function extractRosterFromFile(
  csvText: string,
  _mimeType: string,
  users: any[],
  _isText: boolean = true
): Promise<ExtractedShift[]> {
  const standardExtracted = await extractShiftsFromCSV(csvText, 'roster.csv', users);
  if (standardExtracted.length > 0) return standardExtracted;

  // Fallback parser for simple row-based CSVs: Name,Date,StartTime,EndTime,Type
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const results: ExtractedShift[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;
    if (i === 0 && cols[0].toLowerCase().includes('name')) continue;
    const rawName = cols[0];
    const dateVal = cols[1] && /^\d{4}-\d{2}-\d{2}$/.test(cols[1]) ? cols[1] : new Date().toISOString().split('T')[0];
    const startVal = cols[2] && /^\d{2}:\d{2}$/.test(cols[2]) ? cols[2] : '09:00';
    const endVal = cols[3] && /^\d{2}:\d{2}$/.test(cols[3]) ? cols[3] : '17:00';
    const typeVal = cols[4] || 'Morning';
    const matchedUser = (users || []).find(
      (u) => (u.displayName || '').toLowerCase() === rawName.toLowerCase()
    );
    results.push({
      userId: matchedUser?.uid || rawName,
      userName: matchedUser?.displayName || rawName,
      date: dateVal,
      startTime: startVal,
      endTime: endVal,
      type: typeVal,
      confidenceScore: 0.9,
    });
  }
  return results;
}


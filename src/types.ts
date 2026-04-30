export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  employeeId?: string;
  role: 'admin' | 'member';
  isBreakActive?: boolean;
  activeBreakLogId?: string;
  breakStartTime?: number | null;
  lastLocation?: {
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  timezone?: string;
}

export interface Shift {
  id: string;
  userId: string;
  userName: string;
  startTime: string;
  endTime: string;
  date: string;
  type: string;
  updatedAt?: number;
}

export interface LeaveRequest {
  id: string;
  userId: string;
  userName: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface BreakLog {
  id: string;
  userId: string;
  userName?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  path: Array<{
    latitude: number;
    longitude: number;
    timestamp: number;
  }>;
}

export interface TroubleshootingGuide {
  id: string;
  userId: string;
  problem: string;
  level: 'L1' | 'L2' | 'L3';
  handlingTeam: string;
  guide: string;
  createdAt: number;
}

export interface GlobalSettings {
  maxBreakDurationMinutes: number;
  defaultHourlyRate: number;
  defaultTimezone?: string;
  lockdownActive?: boolean;
  alertLevel?: 'normal' | 'elevated' | 'critical';
}

export interface ShiftTemplate {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  type: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminName: string;
  action: string;
  targetId: string;
  targetName: string;
  timestamp: number;
  details?: string;
}

export interface Announcement {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  createdAt: number;
  priority: 'low' | 'high' | 'urgent';
}

export interface Mission {
  id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'failed' | 'aborted';
  priority: 'low' | 'high' | 'critical';
  assignedTo: string[]; // User UIDs
  location?: { lat: number; lng: number; label: string };
  deadline: number;
  createdAt: number;
  type: 'recon' | 'security' | 'logistics' | 'emergency';
}

export interface ShiftSwapRequest {
  id: string;
  requesterId: string;
  requesterName: string;
  shiftId: string;
  shiftDate: string;
  shiftTime: string;
  preferredDates?: string[];
  preferredTypes?: string[];
  targetUserId?: string;
  status: 'pending' | 'accepted' | 'approved' | 'rejected' | 'cancelled';
  createdAt: number;
}

export interface WellnessCheck {
  id: string;
  userId: string;
  userName: string;
  status: 'optimal' | 'stable' | 'stressed' | 'critical';
  score: number;
  notes?: string;
  timestamp: number;
}

export interface PerformanceMetric {
  id: string;
  userId: string;
  efficiency: number;
  attendance: number;
  compliance: number;
  month: string;
}

export interface Resource {
  id: string;
  name: string;
  type: 'equipment' | 'vehicle' | 'drone' | 'comms';
  status: 'available' | 'deployed' | 'maintenance' | 'critical';
  serialNumber: string;
  lastMaintained: number;
  health: number;
  notes?: string;
  location?: string;
}

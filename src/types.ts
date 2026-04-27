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
  defaultHourlyRate?: number;
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

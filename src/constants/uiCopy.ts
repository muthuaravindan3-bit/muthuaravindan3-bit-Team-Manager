/** Shared plain-English labels. Stored Firebase values remain unchanged. */
export const UI_COPY = {
  modules: { dashboard: 'Overview', schedule: 'Schedule', requests: 'Requests', operations: 'Team', support: 'Support', admin: 'Admin' },
  status: { pending: 'Waiting for review', accepted: 'Waiting for approval', approved: 'Approved', rejected: 'Declined', cancelled: 'Cancelled', open: 'Open', investigating: 'In progress', mitigated: 'Monitoring', resolved: 'Resolved' },
  actions: { save: 'Save changes', review: 'Review changes', retry: 'Try again', close: 'Close', cancel: 'Cancel', cover: 'Find cover', leave: 'Request time off', swap: 'Swap shifts' },
  views: { dashboard: ['summary', 'attention', 'activity', 'roster'], schedule: ['week', 'list', 'mine'], requests: ['swaps', 'leaves'], operations: ['directory', 'tracker', 'breaks', 'handover'], support: ['troubleshooter', 'chat', 'handover'], admin: ['planner', 'approvals', 'team', 'settings'] }
} as const;

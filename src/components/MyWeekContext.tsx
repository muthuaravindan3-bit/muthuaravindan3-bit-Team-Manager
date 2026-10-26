import { useAuth } from '../AuthContext';
import { useOverviewRecords } from '../hooks/useOverviewRecords';
import { Button, Feedback, StatusBadge } from './ui/WorkspaceUI';
import { UI_COPY } from '../constants/uiCopy';
export function MyWeekContext({ start, end, onTimeOff }: { start: string; end: string; onTimeOff: () => void }) {
  const { user } = useAuth();
  const data = useOverviewRecords();
  const leaves = data.leaves.filter((leave) => leave.userId === user?.uid && leave.startDate && leave.endDate && leave.startDate <= end && leave.endDate >= start);
  return <section className="ui-card mb-6"><h2>Time off this week</h2>{data.error && <Feedback message="Time off could not be loaded." onRetry={data.retry} />}{data.hasUpdates && <Button variant="secondary" onClick={data.review}>Review updates</Button>}{leaves.map((leave) => <div className="ui-record" key={leave.id}><span>{leave.startDate} to {leave.endDate}</span><StatusBadge>{UI_COPY.status[leave.status]}</StatusBadge></div>)}{!leaves.length && <p className="text-sm text-main-text-muted">{data.loading ? 'Loading time off…' : 'No time off requests overlap this week.'}</p>}<div className="ui-actions"><Button variant="secondary" onClick={onTimeOff}>Request time off</Button></div></section>;
}

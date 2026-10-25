import { AttentionInbox } from '../components/AttentionInbox';
import { OperationalOverview } from '../components/OperationalOverview';
import { useAttentionQueue } from '../hooks/useAttentionQueue';
import { useOverview } from '../hooks/useOverview';

export function OverviewWorkspace() { return <OperationalOverview {...useOverview()} />; }
export function NeedsAttentionWorkspace() { return <AttentionInbox {...useAttentionQueue()} />; }
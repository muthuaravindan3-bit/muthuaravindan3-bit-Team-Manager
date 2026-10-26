import { Button } from './WorkspaceUI';
export function ReviewUpdates({ hasUpdates, review }: { hasUpdates: boolean; review: () => void }) {
  return hasUpdates ? <div className="ui-feedback ui-feedback-info" role="status"><p>The records have changed. Your current view is kept until you review the updates.</p><Button variant="secondary" onClick={review}>Review updates</Button></div> : null;
}

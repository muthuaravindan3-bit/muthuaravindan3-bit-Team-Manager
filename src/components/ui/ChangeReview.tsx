import { ScenePanel } from '../scenes/ScenePanel';
import type { useChangeReview } from '../../hooks/useChangeReview';
import { Button, Dialog, Feedback } from './WorkspaceUI';

export function ChangeReview({ state }: { state: ReturnType<typeof useChangeReview> }) {
  return <>{state.error && !state.review && <Feedback message={state.error} />}{state.success && <div className="ui-feedback ui-feedback-success" role="status"><p>Your changes are saved.</p>{state.success && <ScenePanel compact kind="check" title={state.approvalSuccess ? "Approval saved" : "Changes saved"} description="The action completed successfully." />}<Button variant="ghost" onClick={state.dismiss}>Dismiss</Button></div>}{state.review && <Dialog title="Review changes" description="Check the people and records affected before saving." onClose={state.close}><div className="space-y-3">{state.review.lines.map((line, index) => <p key={index}>{line}</p>)}</div>{state.error && <Feedback message={state.error} onRetry={() => { void state.confirm(); }} />}<div className="ui-actions"><Button variant="secondary" disabled={state.busy} onClick={state.close}>Keep editing</Button><Button disabled={state.busy} onClick={() => { void state.confirm(); }}>{state.busy ? 'Saving…' : 'Save changes'}</Button></div></Dialog>}</>;
}

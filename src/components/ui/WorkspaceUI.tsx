import { useId } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { AlertCircle, ArrowRight, Inbox, X } from 'lucide-react';
import { useModalFocus } from '../../hooks/useModalFocus';

export interface PageAction { label: string; onClick: () => void; isDisabled?: boolean }
export function Button({ variant = 'primary', className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }) {
  return <button type="button" className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}
export function PageHeader({ title, description, eyebrow, action, children }: { title: string; description: string; eyebrow?: string; action?: PageAction; children?: ReactNode }) {
  return <header className="ui-page-header"><div>{eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}<h1>{title}</h1><p className="ui-page-description">{description}</p></div>{action && <Button onClick={action.onClick} disabled={action.isDisabled}>{action.label}<ArrowRight size={16} /></Button>}{children}</header>;
}
export function StatusBadge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) { return <span className={`ui-status ui-status-${tone}`}>{children}</span>; }
export function FormField({ label, error, hint, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }) {
  const descriptionId = `${props.id}-description`;
  return <div className="ui-form-field"><label htmlFor={props.id}>{label}</label><input {...props} className="input-field" aria-invalid={Boolean(error)} aria-describedby={error || hint ? descriptionId : undefined} />{(error || hint) && <p id={descriptionId} className={error ? 'text-error' : 'text-main-text-muted'}>{error ?? hint}</p>}</div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: PageAction }) { return <div className="ui-empty"><Inbox size={32} /><h2>{title}</h2><p>{description}</p>{action && <Button onClick={action.onClick}>{action.label}</Button>}</div>; }
export function Feedback({ message, tone = 'error', onRetry }: { message: string; tone?: 'error' | 'success' | 'info'; onRetry?: () => void }) { return <div className={`ui-feedback ui-feedback-${tone}`} role={tone === 'error' ? 'alert' : 'status'}><AlertCircle size={18} /><p>{message}</p>{onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}</div>; }
export function Skeleton({ label = 'Loading content' }: { label?: string }) { return <div aria-label={label} role="status" className="ui-skeleton-grid">{[0, 1, 2].map((index) => <div key={index} className="ui-skeleton" />)}</div>; }
export function Dialog({ title, description, children, onClose }: { title: string; description?: string; children: ReactNode; onClose: () => void }) {
  const ref = useModalFocus<HTMLDivElement>(true, onClose);
  const titleId = useId();
  return <div className="ui-dialog-backdrop" onClick={onClose}><div className="ui-dialog" ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} data-focus-scope="modal" tabIndex={-1} onClick={(event) => event.stopPropagation()}><header><div><h2 id={titleId}>{title}</h2>{description && <p>{description}</p>}</div><Button variant="ghost" aria-label="Close dialog" onClick={onClose}><X size={20} /></Button></header>{children}</div></div>;
}

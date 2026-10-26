import { useState } from 'react';
import { z } from 'zod';
import { usePreference } from '../hooks/usePreference';
import { Button, Dialog, FormField } from './ui/WorkspaceUI';

const viewsSchema = z.array(z.object({ name: z.string().min(1).max(40), filters: z.record(z.string().max(200)) })).max(10);
type SavedView = z.infer<typeof viewsSchema>[number];
export function SavedViews({ scope, filters, onApply }: { scope: string; filters: SavedView['filters']; onApply: (filters: SavedView['filters']) => void }) {
  const [views, setViews] = usePreference(`shiftsync-saved-views-${scope}-v1`, [], viewsSchema);
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [touched, setTouched] = useState(false);
  const duplicate = views.some((view) => view.name.toLowerCase() === name.trim().toLowerCase());
  const valid = name.trim().length > 0 && name.trim().length <= 40 && !duplicate && views.length < 10;
  return <div className="ui-saved-views" aria-label="Saved views">{views.map((view) => <Button variant="secondary" key={view.name} onClick={() => onApply(view.filters)}>{view.name}</Button>)}<Button variant="ghost" disabled={views.length >= 10} title={views.length >= 10 ? 'You have saved 10 views' : 'Save these filters on this device'} onClick={() => setIsOpen(true)}>Save current view</Button>{isOpen && <Dialog title="Save this view" description="Keep these filters on this device so you can use them again." onClose={() => setIsOpen(false)}><form onSubmit={(event) => { event.preventDefault(); if (!valid) return; setViews([...views, { name: name.trim(), filters }]); setName(''); setTouched(false); setIsOpen(false); }}><FormField id="saved-view-name" label="View name" value={name} maxLength={40} onBlur={() => setTouched(true)} onChange={(event) => setName(event.target.value)} error={touched && !valid ? duplicate ? 'Choose a different name.' : 'Enter a name, up to 40 characters.' : undefined} /><div className="ui-actions"><Button variant="secondary" onClick={() => setIsOpen(false)}>Cancel</Button><Button type="submit" disabled={!valid}>Save view</Button></div></form></Dialog>}</div>;
}

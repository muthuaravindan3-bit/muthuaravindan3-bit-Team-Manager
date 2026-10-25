import { ArrowRight, CheckCircle2, Search, ShieldCheck, AlertTriangle, X, Inbox, ArrowUpRight } from 'lucide-react';
import type { useAttentionQueue } from '../hooks/useAttentionQueue';
import { ATTENTION_COPY as copy } from '../constants/attentionCopy';
import type { AttentionCategory } from '../types/attention';

type AttentionInboxProps = ReturnType<typeof useAttentionQueue>;

/** Presentational operations inbox; all mutations use the existing review panels. */
export function AttentionInbox(props: AttentionInboxProps) {
  const nextItem = props.openItems[0];
  return <div className="attention-inbox">
    <header className="attention-heading">
      <div><p className="attention-eyebrow">{copy.eyebrow}</p><h1>{copy.title}</h1><p className="attention-intro">{copy.description}</p></div>
      <div className="attention-summary"><span className="attention-live-dot" /><strong>{props.openItems.length}</strong> open <span className="attention-summary-divider">/</span><span>{props.criticalCount} urgent</span></div>
    </header>
    <section className="attention-next" aria-label="Recommended next action">
      <div className="attention-next-icon">{nextItem ? <AlertTriangle size={24} /> : <ShieldCheck size={24} />}</div>
      <div className="attention-next-copy"><p className="attention-eyebrow">{nextItem ? copy.next : copy.allClear}</p><h2>{nextItem?.title ?? copy.allClearDetail}</h2><p>{nextItem?.context ?? copy.doneDetail}</p></div>
      <button className="attention-button attention-primary" onClick={() => nextItem ? props.openItem(nextItem) : props.openSchedule()}>{nextItem ? copy.start : copy.schedule}<ArrowUpRight size={16} /></button>
    </section>
    <section className="attention-queue" aria-label="Attention queue">
      <div className="attention-toolbar">
        <div className="attention-status" role="group" aria-label="Item status">
          <button aria-pressed={props.status === 'open'} onClick={() => props.setStatus('open')}>{copy.open}<span>{props.openItems.length}</span></button>
          <button aria-pressed={props.status === 'completed'} onClick={() => props.setStatus('completed')}>{copy.completed}<span>{props.completedCount}</span></button>
        </div>
        <div className="attention-search"><Search size={16} /><label className="sr-only" htmlFor="attention-search">{copy.search}</label><input id="attention-search" type="search" maxLength={160} placeholder={copy.searchHint} value={props.query} onChange={(event) => props.setQuery(event.target.value)} />{props.query && <button aria-label="Clear search" onClick={() => props.setQuery('')}><X size={16} /></button>}</div>
      </div>
      <div className="attention-filters" role="group" aria-label="Filter by category">
        {(Object.keys(copy.categories) as AttentionCategory[]).map((category) => <button key={category} aria-pressed={props.category === category} onClick={() => props.setCategory(category)}>{copy.categories[category]}<span>{props.counts[category]}</span></button>)}
      </div>
      <div className="attention-list-heading"><span role="status" aria-live="polite">{copy.resultCount(props.visibleItems.length)}</span><span>Priority order <ArrowRight size={12} /></span></div>
      <div className="attention-items">
        {props.visibleItems.map((item) => <article key={item.id} className={`attention-item attention-priority-${item.priority}`}>
          <div className="attention-item-icon">{item.status === 'completed' ? <CheckCircle2 size={20} /> : item.priority === 'critical' ? <AlertTriangle size={20} /> : <Inbox size={20} />}</div>
          <div className="attention-item-copy"><div className="attention-item-meta"><span>{copy.categories[item.category]}</span><span>·</span><span className="attention-reference">{item.id}</span><span className="attention-priority-label">{copy.priorities[item.priority]}</span></div><h3>{item.title}</h3><p>{item.description}</p><div className="attention-item-context">{item.context}</div></div>
          <button className="attention-button attention-item-action" onClick={() => props.openItem(item)} aria-label={`${item.action}: ${item.id}`}>{item.action}<ArrowRight size={16} /></button>
        </article>)}
      </div>
      {props.visibleItems.length === 0 && <div className="attention-empty"><div className="attention-empty-icon">{props.query || props.category !== 'all' ? <Search size={32} /> : <CheckCircle2 size={32} />}</div><h2>{props.query || props.category !== 'all' ? copy.emptyTitle : copy.doneTitle}</h2><p>{props.query || props.category !== 'all' ? copy.emptyDetail : copy.doneDetail}</p><button className="attention-button attention-primary" onClick={props.query || props.category !== 'all' ? props.clearFilters : props.openSchedule}>{props.query || props.category !== 'all' ? copy.clear : copy.schedule}<ArrowRight size={16} /></button></div>}
    </section>
  </div>;
}

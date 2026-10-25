import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { Send, MessageSquare } from 'lucide-react';
import { safeFormat } from '../utils/dateUtils';

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: number;
  role?: string;
}

export default function TeamChat() {
  const { user, profile, isAdmin } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() } as ChatMessage)
        );
        setMessages(list);
        setTimeout(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      },
      (err) => handleFirestoreError(err, OperationType.LIST, 'messages')
    );

    return () => unsub();
  }, [user]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Team Member',
        text,
        timestamp: Date.now(),
        role: isAdmin ? 'admin' : 'member',
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'messages');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-surface-2 border border-main-border rounded-xl flex flex-col h-[560px] overflow-hidden">
      <div className="px-5 py-3.5 border-b border-main-border flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-main-text">
            Team Channel
          </h2>
          <p className="text-xs text-main-text-muted">
            Real-time updates, shift handoffs, and quick questions for everyone on duty.
          </p>
        </div>
        <span className="font-mono text-xs tabular-nums text-main-text-muted">
          {messages.length} messages
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <MessageSquare className="w-8 h-8 text-main-text-disabled mb-2" />
            <p className="text-sm font-semibold text-main-text">
              Start the conversation
            </p>
            <p className="text-xs text-main-text-muted mt-1 max-w-xs">
              Post shift handoff notes or ask a teammate a question.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.userId === user?.uid;
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-main-text-muted mb-1 px-1">
                  <span className="font-semibold text-main-text">
                    {isMe ? 'You' : msg.userName}
                  </span>
                  {msg.role === 'admin' && (
                    <span className="text-primary">· Manager</span>
                  )}
                  <span>·</span>
                  <span className="font-mono tabular-nums">
                    {safeFormat(msg.timestamp, 'HH:mm')}
                  </span>
                </div>
                <div
                  className={`max-w-md px-3.5 py-2.5 rounded-xl text-sm leading-relaxed ${
                    isMe
                      ? 'bg-primary text-primary-text font-medium'
                      : 'bg-surface-1 border border-main-border text-main-text'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={handleSend}
        className="p-3 border-t border-main-border bg-surface-1/60 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write a message to the team..."
          className="input-field py-2"
        />
        <button
          type="submit"
          disabled={!input.trim() || sending}
          className="btn-primary flex items-center gap-1.5 py-2 px-4"
        >
          <Send className="w-4 h-4" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
}

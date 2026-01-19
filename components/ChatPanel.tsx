'use client';

import { FormEvent, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ChatMessage {
  id: string;
  author: 'user' | 'agent';
  text: string;
  ts: number;
}

const defaultBaseUrl = 'https://grestok-campus-connect-agent-323291789059.asia-south1.run.app';

export function ChatPanel() {
  const { idToken, user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const endpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? defaultBaseUrl;
    return base.replace(/\/$/, '') + '/grestok-agent/';
  }, []);

  const uploadEndpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? defaultBaseUrl;
    return base.replace(/\/$/, '') + '/grestok-agent/upload';
  }, []);

  const sessionId = useMemo(() => {
    const namespace = process.env.NEXT_PUBLIC_AGENT_SESSION_NAMESPACE ?? 'local-test';
    return `${namespace}-${user?.uid ?? 'guest'}`;
  }, [user?.uid]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    const prompt = input.trim();
    setInput('');
    setError(null);
    const tempId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;
    setMessages(prev => [
      ...prev,
      { id: tempId, author: 'user', text: prompt, ts: Date.now() },
      { id: `${tempId}-pending`, author: 'agent', text: 'Thinking…', ts: Date.now() },
    ]);
    setIsSending(true);

    try {
      let response: Response;
      if (attachedFile) {
        const formData = new FormData();
        formData.append('message', prompt);
        formData.append('session_id', sessionId);
        formData.append('file', attachedFile);
        response = await fetch(uploadEndpoint, {
          method: 'POST',
          headers: idToken ? { Authorization: `Bearer ${idToken}` } : undefined,
          body: formData,
        });
      } else {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (idToken) {
          headers.Authorization = `Bearer ${idToken}`;
        }
        response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: prompt, session_id: sessionId }),
        });
      }

      if (!response.ok) {
        throw new Error(`Agent error ${response.status}`);
      }

      const raw = await response.text();
      let replyText = raw;
      try {
        const data = JSON.parse(raw) as {
          reply?: string;
          response?: string;
          message?: string;
          [key: string]: unknown;
        };
        replyText =
          data.response ??
          data.reply ??
          data.message ??
          // fallback to JSON pretty print
          JSON.stringify(data, null, 2);
      } catch {
        // fallback to raw text
      }

      setMessages(prev =>
        prev.map(msg =>
          msg.id === `${tempId}-pending`
            ? { ...msg, text: replyText, ts: Date.now() }
            : msg,
        ),
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      setError('Unable to reach the Grestok agent. Confirm your token + endpoint.');
      setMessages(prev => prev.filter(msg => msg.id !== `${tempId}-pending`));
    } finally {
      setIsSending(false);
    }

    setAttachedFile(null);
  };

  const formattedMessage = (text: string) => {
    const chunks = formatMessageChunks(text);
    return chunks.map((chunk, index) => {
      if (chunk.type === 'list') {
        return (
          <ul key={`${chunk.type}-${index}`} style={{ margin: '0.35rem 0', paddingLeft: '1.25rem' }}>
            {chunk.items.map((item, itemIndex) => (
              <li key={itemIndex} style={{ marginBottom: '0.2rem' }}>
                {item}
              </li>
            ))}
          </ul>
        );
      }
      return (
        <p key={`${chunk.type}-${index}`} style={{ margin: '0.35rem 0' }}>
          {chunk.text}
        </p>
      );
    });
  };

  return (
    <section
      style={{
        background: 'rgba(255, 255, 255, 0.02)',
        borderRadius: '20px',
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: '540px',
      }}
    >
      <header style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Chat with Grestok Navigator</h2>
      </header>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        {messages.length === 0 ? (
          <p style={{ color: 'var(--text-muted)' }}>
            Ask about programs, funding, or what to do next. Your Firebase identity is already attached.
          </p>
        ) : (
          messages.map(message => (
            <div
              key={message.id}
              style={{
                alignSelf: message.author === 'user' ? 'flex-end' : 'flex-start',
                background: message.author === 'user' ? 'var(--accent)' : 'rgba(255, 255, 255, 0.05)',
                color: message.author === 'user' ? '#032025' : 'var(--text)',
                padding: '0.85rem 1rem',
                borderRadius: '16px',
                maxWidth: '85%',
                whiteSpace: 'normal',
              }}
            >
              {formattedMessage(message.text)}
            </div>
          ))
        )}
      </div>
      <form onSubmit={handleSubmit} style={{ padding: '1.25rem', borderTop: '1px solid var(--border)' }}>
        {error ? (
          <p style={{ color: '#ff8b94', margin: '0 0 0.5rem' }}>{error}</p>
        ) : null}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={event => {
                const file = event.target.files?.[0] ?? null;
                setAttachedFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={iconButtonStyles}
              title="Attach docs"
            >
              📎
            </button>
            <button type="button" style={iconButtonStyles} title="Start voice (coming soon)">
              🎤
            </button>
          </div>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Share your goals or ask the agent anything"
            style={{
              flex: 1,
              borderRadius: '999px',
              border: '1px solid var(--border)',
              padding: '0.85rem 1.25rem',
              background: 'rgba(255, 255, 255, 0.03)',
              color: 'var(--text)',
            }}
          />
          <button
            type="submit"
            disabled={isSending}
            style={{
              border: 'none',
              borderRadius: '999px',
              padding: '0.85rem 1.5rem',
              background: isSending ? 'var(--text-muted)' : 'var(--accent)',
              color: '#041414',
              fontWeight: 600,
              cursor: isSending ? 'not-allowed' : 'pointer',
            }}
          >
            {isSending ? 'Sending…' : 'Send'}
          </button>
        </div>
        {attachedFile ? (
          <p style={{ margin: '0.6rem 0 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Attached: {attachedFile.name}
          </p>
        ) : null}
      </form>
    </section>
  );
}

type MessageChunk =
  | { type: 'paragraph'; text: string }
  | {
      type: 'list';
      items: string[];
    };

function formatMessageChunks(text: string): MessageChunk[] {
  const lines = text.split('\n');
  const chunks: MessageChunk[] = [];
  let currentParagraph: string[] = [];
  let currentList: string[] | null = null;

  const flushParagraph = () => {
    if (currentParagraph.length) {
      chunks.push({ type: 'paragraph', text: currentParagraph.join(' ') });
      currentParagraph = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.length) {
      chunks.push({ type: 'list', items: currentList });
      currentList = null;
    }
  };

  lines.forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      return;
    }
    if (/^[-*•]/.test(line)) {
      flushParagraph();
      if (!currentList) {
        currentList = [];
      }
      currentList.push(line.replace(/^[-*•]\s?/, '').trim());
    } else {
      flushList();
      currentParagraph.push(line);
    }
  });

  flushParagraph();
  flushList();
  return chunks;
}

const iconButtonStyles: CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  background: 'rgba(255, 255, 255, 0.03)',
  color: 'var(--text)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '1.1rem',
};

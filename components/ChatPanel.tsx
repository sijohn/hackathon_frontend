'use client';

import { FormEvent, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  const [pendingMessageId, setPendingMessageId] = useState<string | null>(null);

  const endpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? defaultBaseUrl;
    return base.replace(/\/$/, '') + '/grestok-agent/';
  }, []);

  const uploadEndpoint = useMemo(() => {
    const base = process.env.NEXT_PUBLIC_AGENT_BASE_URL ?? defaultBaseUrl;
    return base.replace(/\/$/, '') + '/grestok-agent/upload';
  }, []);

  // State to hold the real agent session ID
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize Session on mount or when user changes
  useEffect(() => {
    const initSession = async () => {
      if (!user) return;
      try {
        console.log('Initializing Agent Session for', user.email);
        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: user.email })
        });

        if (res.ok) {
          const data = await res.json();
          console.log('Session Init Response:', data);

          // Extract session_id from response
          // Adjust this based on actual response structure from Vertex AI
          // If response is { session_id: "..." } or { output: { session_id: "..." } }
          // Recursively look for session_id or id if needed, but 'session_id' is standard expectation
          const extractSessionId = (value: unknown): string | null => {
            if (!value || typeof value !== 'object') return null;
            const obj = value as Record<string, unknown>;
            const direct =
              (typeof obj.session_id === 'string' && obj.session_id) ||
              (typeof obj.sessionId === 'string' && obj.sessionId) ||
              (typeof obj.id === 'string' && obj.id);
            if (direct) return direct;

            const session = obj.session as Record<string, unknown> | undefined;
            if (session) {
              if (typeof session.id === 'string' && session.id) return session.id;
              if (typeof session.name === 'string' && session.name) {
                const name = session.name;
                if (name.includes('/sessions/')) {
                  return name.split('/').pop() || name;
                }
                return name;
              }
            }

            for (const val of Object.values(obj)) {
              const nested = extractSessionId(val);
              if (nested) return nested;
            }
            return null;
          };

          const sid = extractSessionId(data);

          if (sid) {
            setSessionId(sid);
          } else {
            console.warn('No session_id found in response', data);
          }
        } else {
          console.error('Session creation failed', res.status);
        }
      } catch (e) {
        console.error('Failed to init session', e);
      }
    };

    initSession();
  }, [user]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!input.trim()) {
      return;
    }

    if (!sessionId) {
      setError('Connecting to agent... please wait.');
      // Optionally retry init or just wait
      return;
    }

    const prompt = input.trim();
    setInput('');
    setError(null);
    const tempId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    // Optimistically add user message
    const userMsg: ChatMessage = { id: tempId, author: 'user', text: prompt, ts: Date.now() };
    const pendingId = `${tempId}-pending`;
    const pendingMsg: ChatMessage = { id: pendingId, author: 'agent', text: 'Thinking...', ts: Date.now() };

    setMessages(prev => [...prev, userMsg, pendingMsg]);
    setPendingMessageId(pendingId);
    setIsSending(true);

    try {
      const tRequestStart = performance.now();
      // Prepare messages context (optional, but good for history if needed by backend, though backend currently just takes last message)
      const currentMessages = [...messages, userMsg];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}), // Optional if API route handles auth via cookie or headers
        },
        body: JSON.stringify({
          message: prompt,
          messages: currentMessages.map(m => ({ role: m.author, content: m.text })),
          session_id: sessionId,
          user_id: user?.email || '',
          user_display_name: user?.displayName || 'Guest',
          user_email: user?.email || '',
        }),
      });

      if (!response.ok) {
        throw new Error(`Agent error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantMessage = '';
      let buffer = '';
      let firstChunkAt: number | null = null;
      let firstRenderAt: number | null = null;
      let parseMs = 0;
      const statusForFunctionCall = (name: string): string => {
        const normalized = name.toLowerCase();
        if (normalized.includes('ircc_score') || normalized.includes('recommendation'))
          return 'Analyzing your CRS score...';
        if (normalized.includes('ircc') || normalized.includes('url_search'))
          return 'Searching IRCC sources...';
        if (normalized.includes('rag') || normalized.includes('search')) return 'Searching sources...';
        if (normalized.includes('policy') || normalized.includes('immigration')) return 'Checking policy details...';
        if (normalized.includes('form') || normalized.includes('application')) return 'Reviewing application steps...';
        return 'Working on it...';
      };
      const extractFunctionCallName = (payload: unknown): string | null => {
        if (!payload || typeof payload !== 'object') return null;
        const obj = payload as Record<string, unknown>;
        const findInParts = (parts: Array<Record<string, unknown>> | undefined): string | null => {
          if (!parts) return null;
          for (const p of parts) {
            const fc = p.function_call as Record<string, unknown> | undefined;
            if (fc && typeof fc.name === 'string' && fc.name) return fc.name;
            const fr = p.function_response as Record<string, unknown> | undefined;
            if (fr && typeof fr.name === 'string' && fr.name) return fr.name;
          }
          return null;
        };

        const outputObj = obj.output as Record<string, unknown> | undefined;
        const outputContent = outputObj?.content as Record<string, unknown> | undefined;
        const nameFromOutput = findInParts(outputContent?.parts as Array<Record<string, unknown>> | undefined);
        if (nameFromOutput) return nameFromOutput;

        const content = obj.content as Record<string, unknown> | undefined;
        const nameFromContent = findInParts(content?.parts as Array<Record<string, unknown>> | undefined);
        if (nameFromContent) return nameFromContent;

        const candidates = (obj.candidates as Array<Record<string, unknown>> | undefined) ?? [];
        for (const c of candidates) {
          const cContent = c.content as Record<string, unknown> | undefined;
          const cName = findInParts(cContent?.parts as Array<Record<string, unknown>> | undefined);
          if (cName) return cName;
        }
        return null;
      };
      const extractText = (payload: unknown): string => {
        if (!payload || typeof payload !== 'object') return '';
        const obj = payload as Record<string, unknown>;
        if (typeof obj.output === 'string') return obj.output;
        const outputObj = obj.output as Record<string, unknown> | undefined;
        if (outputObj) {
          if (typeof outputObj === 'string') return outputObj;
          const content = outputObj.content as Record<string, unknown> | undefined;
          const parts = (content?.parts as Array<Record<string, unknown>> | undefined) ?? [];
          const text = parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('');
          if (text) return text;
        }
        const content = obj.content as Record<string, unknown> | undefined;
        const parts = (content?.parts as Array<Record<string, unknown>> | undefined) ?? [];
        const text = parts.map(p => (typeof p.text === 'string' ? p.text : '')).join('');
        if (text) return text;
        const candidates = (obj.candidates as Array<Record<string, unknown>> | undefined) ?? [];
        for (const c of candidates) {
          const cContent = c.content as Record<string, unknown> | undefined;
          const cParts = (cContent?.parts as Array<Record<string, unknown>> | undefined) ?? [];
          const cText = cParts.map(p => (typeof p.text === 'string' ? p.text : '')).join('');
          if (cText) return cText;
        }
        return '';
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!firstChunkAt) {
          firstChunkAt = performance.now();
          console.log('Client first chunk (ms):', firstChunkAt - tRequestStart);
        }
        const chunk = decoder.decode(value, { stream: true });
        buffer += chunk;

        // Agent Engine streams JSON lines like {"output": "Hello"}; buffer to avoid partial JSON.
        while (true) {
          const newlineIndex = buffer.indexOf('\n');
          if (newlineIndex === -1) break;
          const rawLine = buffer.slice(0, newlineIndex);
          buffer = buffer.slice(newlineIndex + 1);
          const line = rawLine.trim();
          if (!line) continue;
          try {
            const tParseStart = performance.now();
            // Remove "data: " prefix if present (standard SSE)
            const jsonStr = line.startsWith('data:') ? line.slice(5).trimStart() : line;
            if (jsonStr.trim() === '[DONE]') continue;

            const data = JSON.parse(jsonStr);
            const chunkText = extractText(data);
            if (!chunkText) {
              const fnName = extractFunctionCallName(data);
              if (fnName && assistantMessage.length === 0) {
                const status = statusForFunctionCall(fnName);
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === pendingId
                      ? { ...msg, text: status, ts: Date.now() }
                      : msg
                  )
                );
              }
            }
            if (chunkText) {
              assistantMessage += chunkText;

              setMessages(prev =>
                prev.map(msg =>
                  msg.id === pendingId
                    ? { ...msg, text: assistantMessage, ts: Date.now() }
                    : msg
                )
              );
              if (!firstRenderAt) {
                firstRenderAt = performance.now();
                console.log('Client first render (ms):', firstRenderAt - tRequestStart);
              }
            }
            parseMs += performance.now() - tParseStart;
          } catch (e) {
            console.warn('Failed to parse SSE chunk', line, e);
          }
        }
      }

      const tail = buffer.trim();
      if (tail) {
        try {
          const tParseStart = performance.now();
          const jsonStr = tail.startsWith('data:') ? tail.slice(5).trimStart() : tail;
          if (jsonStr.trim() !== '[DONE]') {
            const data = JSON.parse(jsonStr);
            const chunkText = extractText(data);
            if (!chunkText) {
              const fnName = extractFunctionCallName(data);
              if (fnName && assistantMessage.length === 0) {
                const status = statusForFunctionCall(fnName);
                setMessages(prev =>
                  prev.map(msg =>
                    msg.id === pendingId
                      ? { ...msg, text: status, ts: Date.now() }
                      : msg
                  )
                );
              }
            }
            if (chunkText) {
              assistantMessage += chunkText;
              setMessages(prev =>
                prev.map(msg =>
                  msg.id === pendingId
                    ? { ...msg, text: assistantMessage, ts: Date.now() }
                    : msg
                )
              );
              if (!firstRenderAt) {
                firstRenderAt = performance.now();
                console.log('Client first render (ms):', firstRenderAt - tRequestStart);
              }
            }
          }
          parseMs += performance.now() - tParseStart;
        } catch (e) {
          console.warn('Failed to parse trailing SSE chunk', buffer, e);
        }
      }
      const tEnd = performance.now();
      console.log('Client stream timing (ms):', {
        to_first_chunk: firstChunkAt ? firstChunkAt - tRequestStart : null,
        to_first_render: firstRenderAt ? firstRenderAt - tRequestStart : null,
        total: tEnd - tRequestStart,
        parse_ms: Math.round(parseMs),
      });

    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(err);
      let errorMessage = 'Unable to reach the Grestok agent. Please try again.';
      if (err instanceof Error && err.message.includes('Agent error')) {
        errorMessage = err.message; // Propagate the status code error
      }
      setError(errorMessage);
      setMessages(prev => prev.filter(msg => msg.id !== pendingId));
    } finally {
      setIsSending(false);
      setPendingMessageId(null);
    }

    // Clear attachment if any (ignoring file upload for now as we switched to streaming API which handles text)
    setAttachedFile(null);
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
            Ask about Canada Express entry immigration program or what to do next.
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
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  ul: ({ node, ...props }) => (
                    <ul style={{ margin: '0.35rem 0', paddingLeft: '1.25rem' }} {...props} />
                  ),
                  li: ({ node, ...props }) => (
                    <li style={{ marginBottom: '0.2rem' }} {...props} />
                  ),
                  p: ({ node, ...props }) => (
                    <p style={{ margin: '0.35rem 0' }} {...props} />
                  ),
                  strong: ({ node, ...props }) => (
                    <strong style={{ fontWeight: 600, color: message.author === 'user' ? 'inherit' : '#fff' }} {...props} />
                  ),
                }}
              >
                {message.text}
              </ReactMarkdown>
              {message.author === 'agent' &&
              message.id === pendingMessageId &&
              (message.text === 'Thinking...' || message.text.endsWith('...')) ? (
                <span style={{ display: 'inline-flex', gap: '6px', marginTop: '0.35rem' }}>
                  <span className="typing-dot" />
                  <span className="typing-dot typing-dot-delay1" />
                  <span className="typing-dot typing-dot-delay2" />
                </span>
              ) : null}
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
      <style jsx>{`
        .typing-dot {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          display: inline-block;
          animation: typingPulse 1.2s infinite ease-in-out;
        }
        .typing-dot-delay1 {
          animation-delay: 0.2s;
        }
        .typing-dot-delay2 {
          animation-delay: 0.4s;
        }
        @keyframes typingPulse {
          0%,
          80%,
          100% {
            transform: scale(0.8);
            opacity: 0.4;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </section>
  );
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

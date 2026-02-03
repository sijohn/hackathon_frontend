# Chat Agent Prompt + Formatting Notes (Frontend Reference)

This document captures the exact behavior in the current frontend so the coding agent can mirror it in the real app with the same backend.

## 1) Prefix prompt sent to backend

**None.** The frontend sends the user's trimmed input directly as `message` with no additional prefix, system prompt, or wrapper text.

- Source: `components/ChatPanel.tsx` trims the input (`const prompt = input.trim()`) and sends it as `message` in both JSON and multipart requests.
- Payload shape:
  - JSON: `{ "message": "<trimmed user input>", "session_id": "<namespace-uid>" }`
  - FormData: `message`, `session_id`, and `file` (when uploading)

There is no concatenation, prefix/suffix, or prompt template applied in the frontend.

## 2) Response formatting for markdown display

The response text is rendered as Markdown using `react-markdown` with GitHub-Flavored Markdown enabled:

- **Renderer**: `ReactMarkdown`
- **Plugin**: `remark-gfm` (enables tables, task lists, strikethrough, etc.)
- **Custom component styling**:
  - `ul`: `margin: '0.35rem 0'`, `paddingLeft: '1.25rem'`
  - `li`: `marginBottom: '0.2rem'`
  - `p`: `margin: '0.35rem 0'`
  - `strong`: `fontWeight: 600`, `color: '#fff'` for agent messages; `inherit` for user messages

Additional behavior before rendering:

- The HTTP response is read as text.
- If the text parses as JSON, the display text is selected in this priority order:  
  `response` → `reply` → `message` → fallback to `JSON.stringify(data, null, 2)`.
- If parsing fails, the raw response text is displayed as-is.

Source: `components/ChatPanel.tsx`.

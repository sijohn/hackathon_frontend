# Grestok CampusConnect Frontend

Simple, intuitive Next.js 14 app that mirrors the CampusConnect story:

- Firebase email/password auth (hackathon users provisioned manually)
- Dashboard with profile context + chat surface
- Chat POSTs to `/grestok-agent/` with the Firebase JWT in the `Authorization` header, matching the provided curl examples
- Ready for Firebase Hosting deploy (run `npm run build && npm run start` locally or `firebase deploy` once hosting is configured)

## Getting started

```bash
cd frontend
cp .env.example .env.local # fill in Firebase + agent values
npm install
npm run dev
```

### Required env
| Variable | Description |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_*` | Firebase web SDK config from the console |
| `NEXT_PUBLIC_AGENT_BASE_URL` | Base URL for the FastAPI runner (`http://127.0.0.1:8000` or Cloud Run host) |
| `NEXT_PUBLIC_AGENT_SESSION_NAMESPACE` | Optional prefix so session IDs stay unique across users |

## Deployment

1. Build: `npm run build`
2. Configure Firebase Hosting to serve the `frontend` folder (e.g., `firebase init hosting` → set public dir to `frontend/.next`).
3. Deploy via `firebase deploy --only hosting`.

## Notable files

- `context/AuthContext.tsx` – wraps Firebase auth state + exposes login/logout/token
- `components/ChatPanel.tsx` – chat UX sending JWT-authenticated requests to `/grestok-agent/`
- `app/dashboard/page.tsx` – protected dashboard combining profile + chat
- `lib/firebase/client.ts` – bootstraps the Firebase Web SDK using env vars

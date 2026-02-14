import { GoogleAuth } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { user_id } = await req.json();

        // 1. Authenticate
        const auth = new GoogleAuth({
            projectId: 'grestok-app-dev',
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        if ('getCredentials' in client) {
            const creds = await (client as { getCredentials: () => Promise<{ client_email?: string | null; universe_domain?: string | null }> }).getCredentials();
            console.log('ADC in use (session):', {
                client_email: creds.client_email ?? null,
                universe_domain: creds.universe_domain ?? null
            });
        }
        const accessToken = await client.getAccessToken();

        // 2. Prepare Request
        const url = 'https://us-central1-aiplatform.googleapis.com/v1/projects/grestok-app-dev/locations/us-central1/reasoningEngines/5715792505295863808:query';

        const requestBody = {
            class_method: "async_create_session",
            input: {
                user_id: user_id || 'guest',
            }
        };

        // 3. Call Agent Engine
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Session Creation Error:', response.status, errorText);
            return new NextResponse(errorText, { status: response.status });
        }

        const data = await response.json();
        // Expected format varies; normalize to ensure top-level session_id is present for the client.
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

        const sessionId = extractSessionId(data);
        return NextResponse.json({
            ...data,
            ...(sessionId ? { session_id: sessionId } : {}),
        });

    } catch (error) {
        console.error('Error creating session:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), { status: 500 });
    }
}

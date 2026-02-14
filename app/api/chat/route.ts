import { GoogleAuth } from 'google-auth-library';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const tRequestStart = Date.now();
        const body = await req.json();
        const message =
            body?.message ??
            body?.messages?.slice?.(-1)?.[0]?.content ??
            body?.messages?.slice?.(-1)?.[0]?.text ??
            '';
        const session_id = body?.session_id;
        const user_id = body?.user_id ?? body?.user_email ?? '';

        // 1. Authenticate
        const auth = new GoogleAuth({
            projectId: 'grestok-app-dev',
            scopes: ['https://www.googleapis.com/auth/cloud-platform']
        });
        const client = await auth.getClient();
        if ('getCredentials' in client) {
            const creds = await (client as { getCredentials: () => Promise<{ client_email?: string | null; universe_domain?: string | null }> }).getCredentials();
            console.log('ADC in use (chat):', {
                client_email: creds.client_email ?? null,
                universe_domain: creds.universe_domain ?? null
            });
        }
        const accessToken = await client.getAccessToken();

        // 2. Prepare the Request
        const url = 'https://us-central1-aiplatform.googleapis.com/v1/projects/grestok-app-dev/locations/us-central1/reasoningEngines/5715792505295863808:streamQuery?alt=sse';

        const requestBody = {
            class_method: "async_stream_query",
            input: {
                user_id: user_id,
                session_id: session_id, // This must be the ID returned from async_create_session
                message: message
            }
        };

        // 3. Call Agent Engine with Streaming
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });
        const tResponse = Date.now();

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Vertex AI API Error:', response.status, errorText);
            return new NextResponse(errorText, {
                status: response.status,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (!response.body) {
            return new NextResponse('No response body', { status: 500 });
        }

        // 4. Stream through while measuring timing
        const reader = response.body.getReader();
        const { readable, writable } = new TransformStream();
        const writer = writable.getWriter();
        let firstChunkAt: number | null = null;
        let bytes = 0;

        (async () => {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    if (!firstChunkAt) {
                        firstChunkAt = Date.now();
                        console.log('Stream first chunk (ms):', firstChunkAt - tRequestStart);
                    }
                    if (value) bytes += value.byteLength;
                    await writer.write(value);
                }
            } catch (streamErr) {
                console.error('Stream forwarding error:', streamErr);
            } finally {
                await writer.close();
                const tEnd = Date.now();
                console.log('Stream timing (ms):', {
                    to_response: tResponse - tRequestStart,
                    to_first_chunk: firstChunkAt ? firstChunkAt - tRequestStart : null,
                    total: tEnd - tRequestStart,
                    bytes,
                });
            }
        })();

        return new NextResponse(readable, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });

    } catch (error) {
        console.error('Error in chat API:', error);
        return new NextResponse(JSON.stringify({ error: 'Internal Server Error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

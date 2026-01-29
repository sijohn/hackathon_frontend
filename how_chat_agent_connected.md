# Chatbot Connection Guide

This document outlines the connection details for the Grestok Navigator chatbot, including its URL endpoints and authentication requirements.

## API Endpoints

The chatbot communicates with the following endpoints:

| Feature | Endpoint URL | Method |
|---------|--------------|--------|
| **Chat** | `https://grestok-campus-connect-agent-323291789059.asia-south1.run.app/grestok-agent/` | `POST` |
| **File Upload** | `https://grestok-campus-connect-agent-323291789059.asia-south1.run.app/grestok-agent/upload` | `POST` |

> [!NOTE]
> The base URL can be overridden using the `NEXT_PUBLIC_AGENT_BASE_URL` environment variable.

## Authentication & Headers

To interact with the chatbot, you must provide a valid Firebase ID Token (JWT) in the `Authorization` header.

### Required Headers

```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json
```

*   **Authorization**: Specifies the user's JWT token (Firebase ID token).
*   **Content-Type**: Must be `application/json` for chat requests. For file uploads, use `multipart/form-data`.

## Request Body Structure

### Standard Chat Request

```json
{
  "message": "Your prompt here",
  "session_id": "namespace-user_uid"
}
```

*   **message**: The text input from the user.
*   **session_id**: A unique identifier for the conversation session (typically formatted as `namespace-uid`).

### File Upload Request

For file uploads (e.g., PDFs), use a `FormData` object with the following fields:

*   `message`: The associated text prompt.
*   `session_id`: The conversation session ID.
*   `file`: The file object (binary).

## Identifying the User Token

In a Firebase-enabled React application, you can retrieve the ID token as follows:

```javascript
const idToken = await firebase.auth().currentUser.getIdToken();
```

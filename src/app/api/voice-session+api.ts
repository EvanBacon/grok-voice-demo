/**
 * Mints a short-lived ephemeral token for the Grok realtime Voice Agent API.
 *
 * The browser can't safely hold the long-lived `XAI_API_KEY`, and a WebSocket
 * opened from the browser can't set an `Authorization` header. So the client
 * calls this route to get an ephemeral client secret, then opens the realtime
 * WebSocket with that short-lived credential.
 *
 * Set `XAI_API_KEY` in your environment (e.g. `.env.local`) before running.
 *
 * Docs: https://docs.x.ai/developers/model-capabilities/audio/voice
 */

// Grok's realtime model + voice can be tuned here.
const MODEL = process.env.GROK_VOICE_MODEL ?? "grok-voice-latest";
const VOICE = process.env.GROK_VOICE ?? "eve";
const INSTRUCTIONS =
  "You are a friendly, concise voice assistant. Keep replies short and " +
  "conversational since they will be spoken aloud.";

export async function GET() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return Response.json(
      { error: "Missing XAI_API_KEY on the server." },
      { status: 500 },
    );
  }

  try {
    // Mint a short-lived ephemeral token the browser uses to open the realtime
    // WebSocket without ever seeing the long-lived XAI_API_KEY.
    // https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens
    const res = await fetch("https://api.x.ai/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        expires_after: { seconds: 300 },
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      return Response.json(
        { error: `xAI session request failed (${res.status})`, detail },
        { status: 502 },
      );
    }

    const session = await res.json();

    // The response wraps the token; accept the common shapes.
    const clientSecret =
      session?.value ??
      session?.client_secret?.value ??
      session?.client_secret ??
      session?.token ??
      null;

    return Response.json({
      clientSecret,
      model: MODEL,
      voice: VOICE,
      instructions: INSTRUCTIONS,
    });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to create Grok voice session.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

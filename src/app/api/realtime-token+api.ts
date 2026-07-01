/**
 * Mints a short-lived realtime token for the Grok voice agent via the Vercel
 * AI Gateway. Replaces the hand-rolled xAI ephemeral-token route.
 *
 * The browser's `useRealtime()` hook POSTs here with its `sessionConfig` and
 * gets back `{ token, url }` for the gateway realtime WebSocket. Your provider
 * key never reaches the client.
 *
 * Set `AI_GATEWAY_API_KEY` on the server (a Vercel AI Gateway key). The xAI key
 * is configured as a bring-your-own-key credential in the AI Gateway dashboard,
 * so it no longer lives in this app.
 *
 * Docs: https://vercel.com/blog/realtime-voice-agents-on-ai-gateway
 */

import { gateway } from "@ai-sdk/gateway";

const MODEL = process.env.GROK_REALTIME_MODEL ?? "xai/grok-voice-think-fast-1.0";

// The session config the client embeds in its token request, if any. Some
// providers require the full config at token-creation time; passing it through
// keeps us compatible with those without changing the client.
type TokenSessionConfig = Parameters<
  typeof gateway.experimental_realtime.getToken
>[0]["sessionConfig"];

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "Missing AI_GATEWAY_API_KEY on the server." },
      { status: 500 },
    );
  }

  let sessionConfig: TokenSessionConfig;
  try {
    const body = await req.json();
    sessionConfig = body?.sessionConfig;
  } catch {
    // No body or invalid JSON — sessionConfig is optional, so carry on.
  }

  try {
    const { token, url, expiresAt } =
      await gateway.experimental_realtime.getToken({
        model: MODEL,
        expiresAfterSeconds: 300,
        sessionConfig,
      });

    // The hook reads `token` + `url`; this demo registers no server-side tools.
    return Response.json({ token, url, expiresAt, tools: [] });
  } catch (error) {
    return Response.json(
      {
        error: "Failed to create Grok realtime token.",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 502 },
    );
  }
}

import { xai } from "@ai-sdk/xai";
import { convertToModelMessages, streamText } from "ai";

export async function POST(req: Request) {
  const { messages, model } = await req.json();

  const result = streamText({
    model: xai(model ?? "grok-4.5"),
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse({
    onError: __DEV__ ? errorHandler : undefined,
    headers: {
      // Issue with iOS NSURLSession that requires Content-Type set in order to enable streaming.
      // https://github.com/expo/expo/issues/32950#issuecomment-2508297646
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "none",
    },
  });
}

function errorHandler(error: unknown) {
  if (error == null) return "unknown error";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return JSON.stringify(error);
}

import { corsHeaders } from "./exam-ai-access.ts";

export function examStream(work: () => Promise<unknown>) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      send({ status: "processing" });
      // Heartbeats maintain the connection; they never abort generation.
      const heartbeat = setInterval(() => send({ status: "processing" }), 10000);
      try { send({ result: await work() }); }
      catch (error) { send({ error: error instanceof Error ? error.message : String(error) }); }
      finally { clearInterval(heartbeat); controller.close(); }
    },
  }), { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "Cache-Control": "no-cache" } });
}
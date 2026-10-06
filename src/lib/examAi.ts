import { supabase } from "@/integrations/supabase/client";

export async function invokeExamAi(name: string, resultId: string) {
  const { data, error } = await supabase.functions.invoke(name, { body: { result_id: resultId } });
  if (error) {
    const context = "context" in error ? error.context : undefined;
    if (context instanceof Response) {
      const body = await context.clone().json().catch(() => null);
      throw new Error(body?.error || body?.message || error.message);
    }
    throw error;
  }
  if (data instanceof Response && data.body) {
    const reader = data.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let final: any;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      if (done && buffer.trim()) lines.push(buffer);
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const event = JSON.parse(line.slice(6));
        if (event.error) throw new Error(event.error);
        if (event.result) final = event.result;
      }
      if (done) break;
    }
    if (!final) throw new Error("AI berhenti sebelum hasil selesai. Hasil lama tetap tersimpan.");
    return final;
  }
  if (data?.error) throw new Error(data.error);
  return data;
}
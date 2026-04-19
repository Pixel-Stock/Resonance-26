import type { AnalysisResult, AIBriefing, AnalysisState } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function analyzeLog(
  file: File,
  topN: number,
  onStateChange: (state: AnalysisState) => void,
) {
  onStateChange({ phase: "uploading" });

  const formData = new FormData();
  formData.append("file", file);

  const url = `${API_URL}/api/analyze?top_n=${topN}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      body: formData,
      headers: { Accept: "text/event-stream" },
    });
  } catch {
    onStateChange({ phase: "error", message: "Cannot connect to backend. Is it running on port 8000?" });
    return;
  }

  if (!response.ok || !response.body) {
    onStateChange({ phase: "error", message: `Server error: ${response.status}` });
    return;
  }

  onStateChange({ phase: "analyzing" });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: AnalysisResult | null = null;
  let briefingChunks = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    let eventType = "";
    let dataBuffer = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
        dataBuffer = "";
      } else if (line.startsWith("data: ")) {
        dataBuffer += line.slice(6);
      } else if (line === "" && eventType && dataBuffer) {
        // End of event
        handleEvent(eventType, dataBuffer, result, briefingChunks, onStateChange, (r) => { result = r; }, (c) => { briefingChunks = c; });
        eventType = "";
        dataBuffer = "";
      }
    }

    // Handle case where event ends without trailing blank line
    if (eventType && dataBuffer) {
      handleEvent(eventType, dataBuffer, result, briefingChunks, onStateChange, (r) => { result = r; }, (c) => { briefingChunks = c; });
    }
  }
}

function handleEvent(
  eventType: string,
  dataBuffer: string,
  result: AnalysisResult | null,
  briefingChunks: string,
  onStateChange: (state: AnalysisState) => void,
  setResult: (r: AnalysisResult) => void,
  setBriefingChunks: (c: string) => void,
) {
  try {
    if (eventType === "anomalies") {
      const parsed = JSON.parse(dataBuffer) as AnalysisResult;
      setResult(parsed);
      onStateChange({ phase: "streaming_briefing", result: parsed, briefingChunks: "" });
    } else if (eventType === "briefing_chunk") {
      const newChunks = briefingChunks + dataBuffer;
      setBriefingChunks(newChunks);
      if (result) {
        onStateChange({ phase: "streaming_briefing", result, briefingChunks: newChunks });
      }
    } else if (eventType === "briefing_done") {
      const briefing = JSON.parse(dataBuffer) as AIBriefing;
      if (result) {
        onStateChange({ phase: "done", result, briefing });
      }
    } else if (eventType === "error") {
      const err = JSON.parse(dataBuffer);
      onStateChange({ phase: "error", message: err.detail || "Unknown error" });
    }
  } catch {
    // Ignore parse errors on intermediate chunks
  }
}

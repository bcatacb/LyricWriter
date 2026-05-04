/**
 * Minimal POST-SSE client. Sends JSON body, parses text/event-stream responses.
 * Events are dispatched to onEvent({ event, data }). data is parsed as JSON if possible.
 */
export async function streamSSE(url, body, { onEvent, signal, headers = {} } = {}) {
    const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", ...headers },
        body: JSON.stringify(body),
        signal,
    });
    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${text || resp.statusText}`);
    }
    if (!resp.body) throw new Error("No response body for SSE");

    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Split on SSE delimiter \n\n
        let sep;
        while ((sep = buf.indexOf("\n\n")) !== -1) {
            const raw = buf.slice(0, sep);
            buf = buf.slice(sep + 2);
            const evt = parseSSEChunk(raw);
            if (evt) onEvent?.(evt);
        }
    }
    // flush any trailing event
    if (buf.trim()) {
        const evt = parseSSEChunk(buf);
        if (evt) onEvent?.(evt);
    }
}

function parseSSEChunk(raw) {
    const lines = raw.split("\n");
    let event = "message";
    const dataLines = [];
    for (const line of lines) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
    }
    const dataStr = dataLines.join("\n");
    if (!dataStr) return null;
    let data;
    try { data = JSON.parse(dataStr); } catch { data = dataStr; }
    return { event, data };
}

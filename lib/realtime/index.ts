// lib/realtime
// A tiny, focused wrapper for OpenAI Realtime.
// Pure browser APIs + typed callbacks.

export type Role = "user" | "assistant" | "system";
export type SessionStatus = "DISCONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR";

export interface ConversationItem {
  id: string;
  role: Role;
  text: string;
  isFinal?: boolean;
  status?: "speaking" | "processing" | "final";
  timestamp: number; // Date.now()
}

export interface ToolDef {
  name: string;
  description: string;
  parameters?: Record<string, any>;
}

export interface AgentConfigInput {
  name?: string;
  instructions?: string;
  tools?: ToolDef[];
  voice?: string;
}

export interface RealtimeOptions {
  model?: string;                    // default: keep flexible
  voice?: string;                    // can be overridden per-agent
  tokenProvider?: () => Promise<string>; // returns ephemeral key
  apiBase?: string;                  // default realtime base 
  turnDetection?: null | {
    type: "server_vad";
    threshold?: number;
    prefix_padding_ms?: number;
    silence_duration_ms?: number;
    create_response?: boolean;
  };
   // control whether to append model/voice to URL
  appendModelVoiceToUrl?: boolean; // default true (safe)
  // Callbacks (all optional)
  onStatus?: (s: SessionStatus) => void;
  onConversation?: (items: ConversationItem[]) => void;
  onMessage?: (item: ConversationItem) => void;
  onVolume?: (rms: number) => void;                // assistant outbound audio
  onServerEvent?: (raw: any) => void;              // every server event
  onFunctionCall?: (call: {
    name: string; 
    call_id?: string; 
    arguments: string;
    respond: (output: any) => void;                // send function output back
  }) => void; 
}

export class WebRTCClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;

  private analyser: AnalyserNode | null = null; // assistant audio RMS
  private volumeInterval: number | null = null;

  private conv: ConversationItem[] = [];
  private status: SessionStatus = "DISCONNECTED";
  private opts: RealtimeOptions;
  private agent: AgentConfigInput = {};

  private functionRegistry: Record<string, (args: any) => Promise<any> | any> = {};
  private ephemeralUserMessageId: string | null = null;

  private normalizeTools(tools?: ToolDef[]) {
    const arr = Array.isArray(tools) ? tools : [];
    return arr.map(t => ({
      type: "function",  // <-- enforce
      name: t.name,
      description: t.description ?? "",
      parameters:
        t.parameters && typeof t.parameters === "object"
          ? t.parameters
          : { type: "object", properties: {}, additionalProperties: false },
    }));
  }

  constructor(opts: RealtimeOptions) {
    this.opts = {
      apiBase: "https://api.openai.com/v1/realtime",
      ...opts,  // <- note: if opts.turnDetection is undefined, it is not sent
    };
  }

  // ---------- Public getters ----------  
/** A read-only snapshot of the current registry (by value, not a live reference). */
public getFunctionRegistrySnapshot(): Record<string, Function> {
  // Avoid leaking the original object reference
  return { ...this.functionRegistry };
}

/** a tiny bridge on window so the UI can fetch a snapshot easily. */
public exposeRegistryToWindow(key: string = "getToolRegistrySnapshot") {
  if (typeof window !== "undefined") {
    // (a) function to fetch a snapshot
    (window as any)[key] = () => this.getFunctionRegistrySnapshot();
    // (b) optionally drop the instance itself for dev tooling
    (window as any).realtime = this;

     // DEBUG
    const now = this.getFunctionRegistrySnapshot();
    console.log("[REALTIME WebRTCClient] exposeRegistryToWindow: installed", key, "keys:", Object.keys(now));
  }
}

  getStatus() { return this.status; }
  getConversation() { return [...this.conv]; } 

  // ---------- Public callbacks setters (if you prefer setting later) ----------
  setCallbacks(partial: Partial<RealtimeOptions>) {
    this.opts = { ...this.opts, ...partial };
  }

  // ---------- Agent / Session ----------
  setAgent(agent: AgentConfigInput) {
    this.agent = { ...this.agent, ...agent };
    // if connected, immediately push session.update
    if (this.dc?.readyState === "open") this.updateSession({});
  }

 updateSession(
  partial: Partial<AgentConfigInput> & {
    voice?: string;
    tools?: ToolDef[];
    instructions?: string;
  }
) {
  this.agent = { ...this.agent, ...partial };

  // Build the session payload first
  const session: any = {
    modalities: ["text", "audio"],
    model: this.opts.model,
    instructions: this.agent.instructions ?? "",
    voice: this.agent.voice ?? this.opts.voice,
    input_audio_format: "pcm16",
    output_audio_format: "pcm16",
    input_audio_transcription: { model: "whisper-1" },
    tools: this.normalizeTools(this.agent.tools),
    tool_choice: "auto",
    temperature: 0.8,
    max_response_output_tokens: "inf",
    // ❌ DO NOT put `turn_detection` here by default.
  };

  // ✅ Only include `turn_detection` if the client explicitly set it.
  if (this.opts.turnDetection !== undefined) {
    session.turn_detection = this.opts.turnDetection;
  }

  const sessionUpdate = {
    type: "session.update",
    session,
  };

  this.send(sessionUpdate);
}

  // ---------- Register a local function (tool) ----------
registerFunction(name: string, fn: (args: any) => Promise<any> | any) {
  const existed = !!this.functionRegistry[name];
  this.functionRegistry[name] = fn;

    // DEBUG
    console.log("[WebRTCClient] registerFunction:", name,
      "existed?", existed, "size:", Object.keys(this.functionRegistry).length);

  //  mirror to a global and notify UI pages
  if (typeof window !== "undefined") {
    const w = window as any;
    w.__OPENAI_TOOL_REGISTRY = w.__OPENAI_TOOL_REGISTRY ?? {};
    w.__OPENAI_TOOL_REGISTRY[name] = fn;
    window.dispatchEvent(new CustomEvent("tool-registry-updated", { detail: { name } }));
  }
}

 /** True if a function name exists. */
  public hasFunction(name: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.functionRegistry, name);
  }

  /** List all registered function names. */
  public listFunctionNames(): string[] {
    return Object.keys(this.functionRegistry);
  }

   /**
   * Remove a function by name. Returns true if removed.
   * Also updates the window mirror and notifies listeners.
   */
  public unregisterFunction(name: string): boolean {
    const existed = this.hasFunction(name);
    if (!existed) return false;

    delete this.functionRegistry[name];

    if (typeof window !== "undefined") {
      const w = window as any;
      if (w.__OPENAI_TOOL_REGISTRY && w.__OPENAI_TOOL_REGISTRY[name]) {
        delete w.__OPENAI_TOOL_REGISTRY[name];
      }
      window.dispatchEvent(new CustomEvent("tool-registry-updated", { detail: { name, op: "unregister" } }));
    }

    console.log("[WebRTCClient] unregisterFunction:", name,
      "size:", Object.keys(this.functionRegistry).length);

    return true;
  }

   /**
   * Bulk remove by prefix (e.g., "action."). Returns count removed.
   * Optionally provide a whitelist to keep some names.
   */
  public unregisterFunctionsByPrefix(prefix: string, keep: string[] = []): number {
    const keepSet = new Set(keep);
    const toRemove = this.listFunctionNames()
      .filter(n => n.startsWith(prefix) && !keepSet.has(n));
    toRemove.forEach(n => this.unregisterFunction(n));
    return toRemove.length;
  }

  /*
   * Ask the model to call a specific tool right now (best-effort). 
   * Part of the self test check that can be executed by a user
   * This function is not strictly needed since all tools are in Function Registry
   * But this is used in deterministic self test to drive a fast reliable trugger
  */
public forceToolCall(name: string, args?: any, sayAfter?: string) {
  // (A) Prime the model with the exact arguments 
  if (args) {
    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [
          {
            type: "input_text",
            text: `Use the function ${name} with exactly this JSON: ${JSON.stringify(args)}`
          }
        ],
      },
    });
  }

  // (B) instruct model to immediately call that function
  this.send({
    type: "response.create",
    response: {
      tool_choice: {
        type: "function",   // ✅ not "tool"
        name,               // e.g. "show_component"
      },     
      instructions: sayAfter ? `After the function runs, say: ${sayAfter}` : undefined,
      metadata: { forced: true },
    },
  });
}
  /** Toggle the local microphone track on/off without renegotiation. */
  public setMicEnabled(enabled: boolean): void {
    this.micStream?.getAudioTracks().forEach(t => (t.enabled = enabled));
  }

  /** True if any local audio track is currently enabled. */
  public isMicEnabled(): boolean {
    return this.micStream?.getAudioTracks().some(t => t.enabled) ?? false;
  }
  
  public getDataChannel(): RTCDataChannel | null { return this.dc; }
  public getPeerConnection(): RTCPeerConnection | null { return this.pc; }  

  // ---------- Connect / Disconnect ----------
 public async connect({ requestMic = true }: { requestMic?: boolean } = {}) {
  // Prevent double-connect
  if (this.status !== "DISCONNECTED") return;
  this.setStatus("CONNECTING");

  try {
    // 1) Get ephemeral token (your /api/session may pass agent config through)
    const token = await (this.opts.tokenProvider?.() ?? this.defaultTokenProvider());

    // 2) (Optional) get mic
    if (requestMic) {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    }

    // 3) Create PC + DC
    this.pc = new RTCPeerConnection();
    this.dc = this.pc.createDataChannel("response");

    // DataChannel events
    this.dc.onopen = () => {
      // Mark connected
      this.setStatus("CONNECTED");
      // Push current session config immediately (safe no-op if server already set it)
      this.updateSession({});
    };
    this.dc.onclose = () => this.setStatus("DISCONNECTED");
    this.dc.onerror = () => this.setStatus("ERROR");
    this.dc.onmessage = (ev) => this.handleDataChannelMessage(ev);

    // 4) Add local mic track (if any)
    if (this.micStream) {
      const [track] = this.micStream.getTracks();
      if (track) this.pc.addTrack(track, this.micStream);
    }

    // 5) Inbound assistant audio -> play + start RMS meter
    this.pc.ontrack = (evt) => {
      if (!this.audioEl) {
        this.audioEl = document.createElement("audio");
        this.audioEl.autoplay = true;
        // Keep it simple: attach to body; you can style/hide as needed
        document.body.appendChild(this.audioEl);
      }
      this.audioEl.srcObject = evt.streams[0];
      this.setupOutboundVolumeMeter(evt.streams[0]);
      // Autoplay safety
      this.audioEl.play().catch(() => {
        // Some browsers gate autoplay; UI will typically unlock after a user gesture.
      });
    };

    // 6) Create offer & set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // 7) Build Realtime URL (two styles)
    const base = this.opts.apiBase ?? "https://api.openai.com/v1/realtime";
    //const model = this.opts.model ?? "gpt-4o-realtime-preview-2024-12-17";
    const model = this.opts.model ?? process.env.OPENAI_API_REALTIME ?? "gpt_realtime_mini"
    const voice = this.agent.voice ?? this.opts.voice ?? "alloy";

    // A) Keep params (redundant but crystal-clear)
    const urlA = `${base}?model=${encodeURIComponent(model)}&voice=${encodeURIComponent(voice)}`;
    // B) Server is source of truth (passthrough config) – no params
    const urlB = base;

    const useParams = (this.opts.appendModelVoiceToUrl ?? true);
    const url = useParams ? urlA : urlB;

    // 8) Send SDP offer to OpenAI Realtime & set remote answer
    const resp = await fetch(url, {
      method: "POST",
      body: offer.sdp!,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Realtime answer failed: ${resp.status} ${t}`);
    }

    const answerSdp = await resp.text();
    await this.pc.setRemoteDescription({ type: "answer", sdp: answerSdp });

    // If we got here, DC "open" will flip status to CONNECTED soon (above).
  } catch (err) {
    console.error("connect error", err);
    this.setStatus("ERROR");
    // ensure resources are cleaned up on failure
    this.disconnect();
    throw err;
  }
}
  /////////////////////////////////////////////////////////
  ////////////////////////////////////////////////////////

  disconnect() {
    this.clearOutboundVolumeMeter();

    if (this.dc) try { this.dc.close(); } catch {}
    if (this.pc) try { this.pc.close(); } catch {}

    this.dc = null;
    this.pc = null;

    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }

    if (this.audioEl) {
      this.audioEl.pause();
      this.audioEl.srcObject = null;
      this.audioEl.remove();
      this.audioEl = null;
    }

    this.setStatus("DISCONNECTED");
    this.ephemeralUserMessageId = null;
    this.conv = [];
    this.emitConversation();
  }

  // ---------- Messaging ----------
  sendText(text: string) {
    if (!this.dc || this.dc.readyState !== "open") return;

    const itemId = crypto.randomUUID();
    this.appendMessage({
      id: itemId,
      role: "user",
      text,
      isFinal: true,
      status: "final",
      timestamp: Date.now(),
    });

    this.send({
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    });

    this.send({ type: "response.create" });
  }

  cancelAssistantSpeech() {
    const lastAssistant = [...this.conv].reverse()
      .find(x => x.role === "assistant" && x.status !== "final");
    if (!lastAssistant) return;

    this.send({
      type: "conversation.item.truncate",
      item_id: lastAssistant.id,
      content_index: 0,
      audio_end_ms: 0,
    });
    this.send({ type: "response.cancel" });
  }

  // ---------- Push-to-talk ----------
  pttDown() {
    if (this.getStatus() !== "CONNECTED" || !this.dc || this.dc.readyState !== "open") return;
    this.cancelAssistantSpeech();
    this.send({ type: "input_audio_buffer.clear" });
  }
  pttUp() {
    if (this.getStatus() !== "CONNECTED" || !this.dc || this.dc.readyState !== "open") return;
    this.send({ type: "input_audio_buffer.commit" });
    this.send({ type: "response.create" });
  }

  // ---------- Internals ----------
  private async defaultTokenProvider(): Promise<string> {
    const r = await fetch("/api/session", { method: "POST", headers: { "Content-Type": "application/json" }});
    const j = await r.json();
    const v = j?.client_secret?.value;
    if (!v) throw new Error("No ephemeral token");
    return v;
  }

  private setStatus(s: SessionStatus) {
    this.status = s;
    this.opts.onStatus?.(s);
  }

  private send(obj: any) {
    if (!this.dc || this.dc.readyState !== "open") return;
    this.dc.send(JSON.stringify(obj));
  }

  private appendMessage(item: ConversationItem) {
    this.conv = [...this.conv, item];
    this.opts.onMessage?.(item);
    this.emitConversation();
  }

  private updateLastAssistant(delta: string, final = false) {
    const last = this.conv[this.conv.length - 1];
    if (last && last.role === "assistant" && !last.isFinal) {
      last.text += delta;
      if (final) {
        last.isFinal = true;
        last.status = "final";
      }
      this.emitConversation();
      return;
    }
    // create a new partial assistant item
    const fresh: ConversationItem = {
      id: crypto.randomUUID(),
      role: "assistant",
      text: delta,
      isFinal: final,
      status: final ? "final" : "speaking",
      timestamp: Date.now(),
    };
    this.appendMessage(fresh);
  }

  private emitConversation() {
    this.opts.onConversation?.([...this.conv]);
  }

  private ensureEphemeralUserItem() {
    if (this.ephemeralUserMessageId) return this.ephemeralUserMessageId;
    this.ephemeralUserMessageId = crypto.randomUUID();
    this.appendMessage({
      id: this.ephemeralUserMessageId,
      role: "user",
      text: "",
      isFinal: false,
      status: "speaking",
      timestamp: Date.now(),
    });
    return this.ephemeralUserMessageId;
  }

  private clearEphemeralUserItem() {
    this.ephemeralUserMessageId = null;
  }

  private handleDataChannelMessage = async (event: MessageEvent) => {
    let msg: any;
    try { msg = JSON.parse(event.data); } catch { return; }

    this.opts.onServerEvent?.(msg);

    switch (msg.type) {
      case "input_audio_buffer.speech_started": {
        this.ensureEphemeralUserItem();
        break;
      }
      case "input_audio_buffer.committed": {
        // show "processing" on ephemeral user item
        if (this.ephemeralUserMessageId) {
          this.conv = this.conv.map(x =>
            x.id === this.ephemeralUserMessageId ? { ...x, text: "Processing speech...", status: "processing" } : x
          );
          this.emitConversation();
        }
        break;
      }
      case "conversation.item.input_audio_transcription": {
        const id = this.ensureEphemeralUserItem();
        const partial = msg.transcript ?? msg.text ?? "…";
        this.conv = this.conv.map(x =>
          x.id === id ? { ...x, text: partial, status: "speaking", isFinal: false } : x
        );
        this.emitConversation();
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        if (this.ephemeralUserMessageId) {
          this.conv = this.conv.map(x =>
            x.id === this.ephemeralUserMessageId
              ? { ...x, text: msg.transcript || "", isFinal: true, status: "final" }
              : x
          );
          this.emitConversation();
          this.clearEphemeralUserItem();
        }
        break;
      }

      // Assistant (TTS) transcript deltas/done
      case "response.audio_transcript.delta": {
        this.updateLastAssistant(msg.delta || "", false);
        break;
      }
      case "response.audio_transcript.done": {
        this.updateLastAssistant("", true);
        break;
      }

      // Text deltas (if you also request text)
      case "response.text.delta": {
        this.updateLastAssistant(msg.delta || "", false);
        break;
      }
      case "response.text.done": {
        this.updateLastAssistant("", true);
        break;
      }

      // Tool calls
      case "response.function_call_arguments.done": {
        const fn = this.functionRegistry[msg.name];
        const argsObj = safeParseJSON(msg.arguments);
        const respond = (output: any) => {
          this.send({
            type: "conversation.item.create",
            item: { type: "function_call_output", call_id: msg.call_id, output: JSON.stringify(output) },
          });
          this.send({ type: "response.create" });
        };

        // First give the app a chance (onFunctionCall)
        this.opts.onFunctionCall?.({ name: msg.name, call_id: msg.call_id, arguments: msg.arguments, respond });

        // If locally registered, run it
        if (fn) {
          try {
            const result = await fn(argsObj);
            respond(result);
          } catch (e: any) {
            respond({ error: e?.message || String(e) });
          }
        }
        
        break;
      }

      default:
        // swallow others; you can watch them via onServerEvent
        break;
    }
  };

  // Assistant outbound volume meter
  private setupOutboundVolumeMeter(stream: MediaStream) {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    src.connect(analyser);
    this.analyser = analyser;

    this.clearOutboundVolumeMeter();
    this.volumeInterval = window.setInterval(() => {
      const rms = this.getRMS(analyser);
      this.opts.onVolume?.(rms);
    }, 100);
  }

  private clearOutboundVolumeMeter() {
    if (this.volumeInterval != null) {
      clearInterval(this.volumeInterval);
      this.volumeInterval = null;
    }
    this.analyser = null;
  }

  private getRMS(analyser: AnalyserNode) {
    const arr = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteTimeDomainData(arr);
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
      const f = (arr[i] - 128) / 128;
      sum += f * f;
    }
    return Math.sqrt(sum / arr.length);
  }
}

function safeParseJSON(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}

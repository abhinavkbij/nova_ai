import { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Send, Bot, Loader2, Volume2 } from 'lucide-react';

// Audio worklet code for capturing PCM at 16 kHz from the microphone
const WORKLET_CODE = `
class PCMCaptureProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const ch = inputs[0]?.[0];
    if (ch && ch.length) {
      const int16 = new Int16Array(ch.length);
      for (let i = 0; i < ch.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, Math.round(ch[i] * 32767)));
      }
      this.port.postMessage(int16.buffer, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-capture', PCMCaptureProcessor);
`;

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToInt16Array(b64) {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return new Int16Array(buf);
}

const STATUS_LABEL = {
  connecting: 'Connecting…',
  connected:  'Ready',
  idle:       'Ready',
  listening:  'Listening…',
  thinking:   'Thinking…',
  speaking:   'Speaking…',
  error:      'Error',
};

const STATUS_COLOR = {
  connecting: 'bg-yellow-400',
  connected:  'bg-green-400',
  idle:       'bg-green-400',
  listening:  'bg-blue-500 animate-pulse',
  thinking:   'bg-purple-500 animate-pulse',
  speaking:   'bg-teal-500 animate-pulse',
  error:      'bg-red-500',
};

function mergeTranscriptText(current, next) {
  const trimmedCurrent = current.trim();
  const trimmedNext = next.trim();
  if (!current) return trimmedNext;
  if (!trimmedNext) return current;
  if (trimmedCurrent.toLowerCase() === trimmedNext.toLowerCase()) return current;
  if (trimmedNext.toLowerCase().startsWith(trimmedCurrent.toLowerCase())) return trimmedNext;
  if (trimmedCurrent.toLowerCase().endsWith(trimmedNext.toLowerCase())) return current;

  const needsSpace = !/\s$/.test(current) && !/^[,.:;!?)]/.test(trimmedNext);
  return `${current}${needsSpace ? ' ' : ''}${trimmedNext}`;
}

export default function NovaAssistant({ technician, onAction }) {
  const [isOpen, setIsOpen]       = useState(false);
  const [messages, setMessages]   = useState([]);
  const [status, setStatus]       = useState('connecting');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [connected, setConnected] = useState(false);

  const wsRef            = useRef(null);
  const audioCtxRef      = useRef(null);
  const workletNodeRef   = useRef(null);
  const streamRef        = useRef(null);
  const nextPlayTimeRef  = useRef(0);
  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const onActionRef      = useRef(onAction);
  const messageIdRef     = useRef(0);
  const speechRecognitionRef = useRef(null);
  useEffect(() => { onActionRef.current = onAction; }, [onAction]);

  const nextMessageId = useCallback(() => {
    messageIdRef.current += 1;
    return `${Date.now()}-${messageIdRef.current}`;
  }, []);

  const appendStreamingMessage = useCallback((role, text, mergeText) => {
    const content = text.trim();
    if (!content) return;

    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last?.role === role && last.streaming) {
        return [
          ...prev.slice(0, -1),
          { ...last, text: mergeText(last.text, content), ts: new Date() },
        ];
      }

      return [
        ...prev,
        { id: nextMessageId(), role, text: content, streaming: true, ts: new Date() },
      ];
    });
  }, [nextMessageId]);

  const settleStreamingMessages = useCallback(() => {
    setMessages((prev) =>
      prev.map((m) => (m.streaming ? { ...m, streaming: false } : m))
    );
  }, []);

  // ── Audio playback ─────────────────────────────────────────────────────────
  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
      nextPlayTimeRef.current = 0;
    }
    return audioCtxRef.current;
  }, []);

  const playAudioChunk = useCallback((b64) => {
    try {
      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') ctx.resume();

      const int16 = base64ToInt16Array(b64);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768;

      const buf = ctx.createBuffer(1, float32.length, 24000);
      buf.copyToChannel(float32, 0);

      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);

      const startAt = Math.max(ctx.currentTime + 0.05, nextPlayTimeRef.current);
      src.start(startAt);
      nextPlayTimeRef.current = startAt + buf.duration;
    } catch (err) {
      console.warn('[Nova] playback error', err);
    }
  }, [getAudioCtx]);

  const connectRef = useRef(null);

  const appendUserTranscript = useCallback((text) => {
    appendStreamingMessage('user', text, mergeTranscriptText);
  }, [appendStreamingMessage]);

  const startLocalSpeechTranscript = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.onresult = (event) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i += 1) {
        transcript += event.results[i][0]?.transcript ?? '';
      }
      appendUserTranscript(transcript);
    };
    recognition.onerror = () => {};
    recognition.onend = () => {
      if (speechRecognitionRef.current === recognition) {
        speechRecognitionRef.current = null;
      }
    };

    try {
      recognition.start();
      speechRecognitionRef.current = recognition;
    } catch {
      speechRecognitionRef.current = null;
    }
  }, [appendUserTranscript]);

  const stopLocalSpeechTranscript = useCallback(() => {
    const recognition = speechRecognitionRef.current;
    if (!recognition) return;
    speechRecognitionRef.current = null;
    try {
      recognition.stop();
    } catch {
      // Ignore browsers that throw when recognition has already stopped.
    }
  }, []);

  // ── WebSocket connection ───────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const techId = technician?.id ?? '';
    const url = `${proto}//${window.location.host}/api/nova/ws?technicianId=${techId}`;

    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }

      switch (data.type) {
        case 'status':
          setStatus(data.state);
          if (data.state === 'idle') {
            settleStreamingMessages();
          }
          break;

        case 'text':
          if (data.role === 'assistant' && data.text?.trim()) {
            appendStreamingMessage('assistant', data.text, (current, next) => current + next);
          }
          break;

        case 'transcript':
          if (data.text?.trim()) {
            const role = data.role === 'assistant' ? 'assistant' : 'user';
            appendStreamingMessage(role, data.text, mergeTranscriptText);
          }
          break;

        case 'audio':
          playAudioChunk(data.data);
          setStatus('speaking');
          break;

        case 'action':
          onActionRef.current?.(data);
          break;

        case 'error':
          setStatus('error');
          setMessages((prev) => [
            ...prev,
            { id: nextMessageId(), role: 'system', text: `Error: ${data.message}`, ts: new Date() },
          ]);
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
      setStatus('connecting');
      // Attempt reconnect after 3 s
      setTimeout(() => {
        if (wsRef.current === ws) connectRef.current?.();
      }, 3000);
    };

    ws.onerror = () => {
      setStatus('error');
    };
  }, [appendStreamingMessage, nextMessageId, playAudioChunk, settleStreamingMessages, technician?.id]);

  useEffect(() => {
    connectRef.current = connect;
    connect();
    return () => {
      wsRef.current?.close();
    };
  }, [connect]);

  // Scroll messages to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Microphone recording ───────────────────────────────────────────────────
  async function startRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'audio_start' }));
      }
      startLocalSpeechTranscript();

      // Create 16 kHz AudioContext for Gemini input
      const ctx = new AudioContext({ sampleRate: 16000 });
      const blobUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);

      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-capture');
      node.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'audio',
            data: arrayBufferToBase64(e.data),
          }));
        }
      };
      source.connect(node);
      // Don't connect node to destination — we don't want mic feedback

      workletNodeRef.current = { ctx, node, source };
      setIsRecording(true);
      setStatus('listening');
    } catch (err) {
      stopLocalSpeechTranscript();
      console.error('[Nova] mic error', err);
      setStatus('error');
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    const w = workletNodeRef.current;
    if (w) {
      w.source.disconnect();
      w.node.disconnect();
      w.ctx.close().catch(() => {});
      workletNodeRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    stopLocalSpeechTranscript();
    setIsRecording(false);
    setStatus('thinking');
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'audio_end' }));
    }
  }

  // ── Text send ──────────────────────────────────────────────────────────────
  function sendText(e) {
    e?.preventDefault();
    const content = textInput.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', content }));
    setMessages((prev) => [
      ...prev,
      { id: nextMessageId(), role: 'user', text: content, ts: new Date() },
    ]);
    setTextInput('');
    setStatus('thinking');
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open Nova assistant"
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center
          transition-all duration-300
          ${isOpen
            ? 'bg-gray-800 rotate-0 scale-95'
            : 'bg-gradient-to-br from-blue-600 to-violet-600 hover:scale-110 hover:shadow-blue-400/40'
          }
        `}
      >
        {isOpen ? (
          <X className="w-6 h-6 text-white" />
        ) : (
          <NovaIcon className="w-7 h-7 text-white" />
        )}
        {/* Status dot */}
        {!isOpen && (
          <span
            className={`absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_COLOR[status]}`}
          />
        )}
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[360px] max-h-[560px] flex flex-col rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden animate-in">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-700 to-violet-700 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <NovaIcon className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-none">Nova</p>
              <p className="text-blue-200 text-xs mt-0.5 flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_COLOR[status]}`} />
                {STATUS_LABEL[status] ?? status}
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-blue-200 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Volume2 className="w-8 h-8 text-blue-300 mb-2" />
                <p className="text-sm text-gray-500">
                  Hi {technician?.name?.split(' ')[0] ?? 'there'}! Hold the mic or type to talk to me.
                </p>
              </div>
            )}

            {messages.map((msg) => (
              <MessageBubble key={msg.id} msg={msg} />
            ))}

            {status === 'thinking' && (
              <div className="flex gap-2 items-start">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Loader2 className="w-3 h-3 text-white animate-spin" />
                </div>
                <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-3 py-2">
                  <span className="flex gap-1 items-center h-4">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 bg-white p-3 shrink-0">
            <form onSubmit={sendText} className="flex items-center gap-2">
              {/* Mic button — hold to talk */}
              <button
                type="button"
                onPointerDown={startRecording}
                onPointerUp={stopRecording}
                onPointerLeave={stopRecording}
                disabled={!connected}
                aria-label={isRecording ? 'Release to send voice' : 'Hold to speak'}
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all
                  ${isRecording
                    ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-300'
                    : 'bg-gray-100 text-gray-500 hover:bg-blue-100 hover:text-blue-600 disabled:opacity-40'
                  }
                `}
              >
                {isRecording ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={connected ? 'Type a message…' : 'Connecting…'}
                disabled={!connected}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent disabled:opacity-50 bg-gray-50"
              />

              <button
                type="submit"
                disabled={!textInput.trim() || !connected}
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition-colors"
                aria-label="Send"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="text-center text-[10px] text-gray-400 mt-2">
              Hold mic to speak · Type to chat · Nova powered by Gemini
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function MessageBubble({ msg }) {
  const isUser    = msg.role === 'user';
  const isSystem  = msg.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center text-xs text-red-500 bg-red-50 rounded-lg py-1.5 px-3">
        {msg.text}
      </div>
    );
  }

  return (
    <div className={`flex gap-2 items-start ${isUser ? 'flex-row-reverse' : ''}`}>
      {!isUser && (
        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-600 to-violet-600 flex items-center justify-center shrink-0 mt-0.5">
          <Bot className="w-3 h-3 text-white" />
        </div>
      )}
      <div
        className={`
          max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed
          ${isUser
            ? 'bg-blue-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
          }
        `}
      >
        {msg.text}
      </div>
    </div>
  );
}

function NovaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

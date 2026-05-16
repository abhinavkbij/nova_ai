import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Wrench, ClipboardList } from 'lucide-react';

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

function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// Waveform bars shown when recording
const WAVEFORM_HEIGHTS = [12, 20, 28, 18, 30, 22, 14, 26, 32, 20, 16, 28, 24, 18, 30, 26, 14, 22, 30, 18, 28, 16, 24, 32, 20, 14, 26, 22, 18, 12];

function AudioWaveform() {
  return (
    <div className="flex items-center gap-[3px] h-9 px-1">
      {WAVEFORM_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className="w-[3px] bg-white/80 rounded-full animate-pulse"
          style={{ height: `${h}px`, animationDelay: `${(i * 60) % 800}ms`, animationDuration: '0.8s' }}
        />
      ))}
    </div>
  );
}

export default function NovaAssistant({ technician, onAction }) {
  const [isOpen, setIsOpen]           = useState(false);
  const [messages, setMessages]       = useState([]);
  const [status, setStatus]           = useState('connecting');
  const [isRecording, setIsRecording] = useState(false);
  const [textInput, setTextInput]     = useState('');
  const [connected, setConnected]     = useState(false);

  const wsRef              = useRef(null);
  const audioCtxRef        = useRef(null);
  const workletNodeRef     = useRef(null);
  const streamRef          = useRef(null);
  const nextPlayTimeRef    = useRef(0);
  const messagesEndRef     = useRef(null);
  const inputRef           = useRef(null);
  const onActionRef        = useRef(onAction);
  const messageIdRef       = useRef(0);
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
        return [...prev.slice(0, -1), { ...last, text: mergeText(last.text, content), ts: new Date() }];
      }
      return [...prev, { id: nextMessageId(), role, text: content, streaming: true, ts: new Date() }];
    });
  }, [nextMessageId]);

  const settleStreamingMessages = useCallback(() => {
    setMessages((prev) => prev.map((m) => (m.streaming ? { ...m, streaming: false } : m)));
  }, []);

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
      if (speechRecognitionRef.current === recognition) speechRecognitionRef.current = null;
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
    try { recognition.stop(); } catch { /* ignore */ }
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const techId = technician?.id ?? '';
    const url = `${proto}//${window.location.host}/api/nova/ws?technicianId=${techId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => { setConnected(true); };

    ws.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      switch (data.type) {
        case 'status':
          setStatus(data.state);
          if (data.state === 'idle') settleStreamingMessages();
          break;
        case 'text':
          if (data.role === 'assistant' && data.text?.trim())
            appendStreamingMessage('assistant', data.text, (current, next) => current + next);
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
      setTimeout(() => { if (wsRef.current === ws) connectRef.current?.(); }, 3000);
    };

    ws.onerror = () => { setStatus('error'); };
  }, [appendStreamingMessage, nextMessageId, playAudioChunk, settleStreamingMessages, technician?.id]);

  useEffect(() => {
    connectRef.current = connect;
    connect();
    return () => { wsRef.current?.close(); };
  }, [connect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRecording]);

  async function startRecording() {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;
      if (wsRef.current?.readyState === WebSocket.OPEN)
        wsRef.current.send(JSON.stringify({ type: 'audio_start' }));
      startLocalSpeechTranscript();
      const ctx = new AudioContext({ sampleRate: 16000 });
      const blobUrl = URL.createObjectURL(new Blob([WORKLET_CODE], { type: 'application/javascript' }));
      await ctx.audioWorklet.addModule(blobUrl);
      URL.revokeObjectURL(blobUrl);
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, 'pcm-capture');
      node.port.onmessage = (e) => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type: 'audio', data: arrayBufferToBase64(e.data) }));
      };
      source.connect(node);
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
    if (wsRef.current?.readyState === WebSocket.OPEN)
      wsRef.current.send(JSON.stringify({ type: 'audio_end' }));
  }

  function sendText(e) {
    e?.preventDefault();
    const content = textInput.trim();
    if (!content || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', content }));
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', text: content, ts: new Date() }]);
    setTextInput('');
    setStatus('thinking');
  }

  function handleSuggestion(text) {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ type: 'text', content: text }));
    setMessages((prev) => [...prev, { id: nextMessageId(), role: 'user', text, ts: new Date() }]);
    setStatus('thinking');
  }

  const hasMessages = messages.length > 0;

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setIsOpen((o) => !o)}
        aria-label="Open Nova assistant"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-blue-500 shadow-xl flex items-center justify-center hover:bg-blue-600 transition-colors"
      >
        <NovaIcon className="w-7 h-7 text-white" />
      </button>

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 z-50 w-[480px] max-h-[700px] flex flex-col rounded-2xl shadow-2xl bg-white overflow-hidden">

          {!hasMessages ? (
            /* ── Empty / Welcome state ── */
            <>
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors z-10"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex flex-col items-center px-8 pt-14 pb-6 flex-1 overflow-y-auto">
                {/* Large bot icon */}
                <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
                  <NovaIcon className="w-12 h-12 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 mb-2 text-center">Hi, Im Nova, your AI assistant</h2>
                <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">
                  I can help you answer repair/work order questions, take notes,<br />and more. How can I assist you today?
                </p>

                {/* Suggestion cards */}
                <div className="w-full space-y-3">
                  <button
                    onClick={() => handleSuggestion("What's the torque specifications for the wheel lug nuts?")}
                    className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                      <Wrench className="w-4 h-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Repair Help</p>
                      <p className="text-xs text-gray-500">&ldquo;What&apos;s the torque specifications for the wheel lug nuts?&rdquo;</p>
                    </div>
                  </button>

                  <button
                    onClick={() => handleSuggestion('Add a note: Customer reported grinding noise from the engine')}
                    className="w-full flex items-center gap-3 p-4 border border-gray-200 rounded-xl text-left hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <ClipboardList className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">Take Notes</p>
                      <p className="text-xs text-gray-500">&ldquo;Add a note: Customer reported grinding noise from the engine&rdquo;</p>
                    </div>
                  </button>
                </div>
              </div>

              <InputBar
                textInput={textInput}
                setTextInput={setTextInput}
                connected={connected}
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onSend={sendText}
                inputRef={inputRef}
              />
            </>
          ) : (
            /* ── Chat view ── */
            <>
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 shrink-0 bg-white">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                  <NovaIcon className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-semibold text-gray-900 text-base">Nova AI</span>
                <button
                  onClick={() => setIsOpen(false)}
                  className="ml-auto text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-white">
                {messages.map((msg) => (
                  <MessageBubble key={msg.id} msg={msg} />
                ))}

                {/* Waveform while recording */}
                {isRecording && (
                  <div className="flex justify-end">
                    <div className="bg-blue-500 rounded-2xl rounded-tr-sm px-4 py-3">
                      <AudioWaveform />
                    </div>
                  </div>
                )}

                {/* Nova is listening */}
                {isRecording && (
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <NovaIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-sm text-gray-500">Nova is listening..</span>
                  </div>
                )}

                {/* Thinking indicator */}
                {status === 'thinking' && !isRecording && (
                  <div className="flex gap-3 items-end">
                    <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                      <NovaIcon className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3">
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

              <InputBar
                textInput={textInput}
                setTextInput={setTextInput}
                connected={connected}
                isRecording={isRecording}
                onStartRecording={startRecording}
                onStopRecording={stopRecording}
                onSend={sendText}
                inputRef={inputRef}
              />
            </>
          )}
        </div>
      )}
    </>
  );
}

function InputBar({ textInput, setTextInput, connected, isRecording, onStartRecording, onStopRecording, onSend, inputRef }) {
  return (
    <div className="border-t border-gray-200 bg-white px-4 pt-3 pb-4 shrink-0">
      <form onSubmit={onSend} className="flex items-center gap-2">
        {/* Mic button */}
        <button
          type="button"
          onPointerDown={onStartRecording}
          onPointerUp={onStopRecording}
          onPointerLeave={onStopRecording}
          disabled={!connected}
          aria-label={isRecording ? 'Release to send voice' : 'Hold to speak'}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-all
            ${isRecording
              ? 'bg-blue-500 text-white shadow-md shadow-blue-200'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40'
            }
          `}
        >
          <MicIcon className="w-4 h-4" />
        </button>

        <input
          ref={inputRef}
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          placeholder="Type your question..."
          disabled={!connected}
          className="flex-1 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 bg-transparent border-0 focus:outline-none disabled:opacity-50"
        />

        <button
          type="submit"
          disabled={!textInput.trim() || !connected}
          aria-label="Send"
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-gray-100 text-gray-500 hover:bg-gray-200 disabled:opacity-40 transition-colors"
        >
          <SendIcon className="w-4 h-4" />
        </button>
      </form>
      <p className="text-center text-xs text-gray-400 mt-1">
        Say &quot;Hey Nova&quot; to activate voice commands
      </p>
    </div>
  );
}

function MessageBubble({ msg }) {
  const isUser   = msg.role === 'user';
  const isSystem = msg.role === 'system';

  if (isSystem) {
    return (
      <div className="text-center text-xs text-red-500 bg-red-50 rounded-lg py-1.5 px-3">
        {msg.text}
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="max-w-[75%] bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed">
          {msg.text}
        </div>
        {msg.ts && (
          <span className="text-xs text-gray-400 mr-1">{formatTime(msg.ts)}</span>
        )}
      </div>
    );
  }

  // Assistant message
  return (
    <div className="flex gap-3 items-end">
      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        <NovaIcon className="w-4 h-4 text-blue-600" />
      </div>
      <div className="max-w-[75%]">
        <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed text-gray-800">
          {msg.text}
        </div>
        {msg.ts && (
          <span className="text-xs text-gray-400 mt-1 ml-1 block">{formatTime(msg.ts)}</span>
        )}
      </div>
    </div>
  );
}

function NovaIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="4" width="20" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="11" r="1.5" fill="currentColor" />
      <circle cx="15" cy="11" r="1.5" fill="currentColor" />
      <path d="M9 15h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M8 4V2M16 4V2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MicIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" x2="12" y1="19" y2="22" />
    </svg>
  );
}

function SendIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

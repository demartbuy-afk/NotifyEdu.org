import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';

// Base64 and Audio decoding/encoding functions
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}


const LiveConversation: React.FC = () => {
    const [status, setStatus] = useState<'idle' | 'connecting' | 'active' | 'error'>('idle');
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const sessionRef = useRef<any>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const inputAudioContextRef = useRef<AudioContext | null>(null);
    const outputAudioContextRef = useRef<AudioContext | null>(null);
    const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
    const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
    const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
    const nextStartTimeRef = useRef<number>(0);

    const releaseMediaResources = () => {
        sourcesRef.current.forEach(source => {
            try { source.stop(); } catch(e) {}
        });
        sourcesRef.current.clear();

        if (scriptProcessorRef.current) {
            scriptProcessorRef.current.disconnect();
            scriptProcessorRef.current.onaudioprocess = null;
            scriptProcessorRef.current = null;
        }
        if (mediaStreamSourceRef.current) {
            mediaStreamSourceRef.current.disconnect();
            mediaStreamSourceRef.current = null;
        }

        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (inputAudioContextRef.current && inputAudioContextRef.current.state !== 'closed') {
            inputAudioContextRef.current.close().catch(console.error);
            inputAudioContextRef.current = null;
        }

        if (outputAudioContextRef.current && outputAudioContextRef.current.state !== 'closed') {
            outputAudioContextRef.current.close().catch(console.error);
            outputAudioContextRef.current = null;
        }
    };

    const stopConversation = () => {
        if (sessionRef.current) {
            sessionRef.current.close();
            // The onclose callback will handle cleanup.
        } else {
             // If there's no session, we might be in a state with dangling media resources.
             releaseMediaResources();
             setStatus('idle');
        }
    };

    const startConversation = async () => {
        if (status === 'active' || status === 'connecting') return;
        
        // This is the most critical change: always release resources BEFORE attempting to acquire new ones.
        // This ensures that even if the previous state was 'error', we start with a clean slate.
        releaseMediaResources();
        
        setStatus('connecting');
        setErrorMessage(null);

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            const outputNode = outputAudioContextRef.current.createGain();
            outputNode.connect(outputAudioContextRef.current.destination);
            nextStartTimeRef.current = 0;
            
            streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

            inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            
            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                callbacks: {
                    onopen: () => {
                        setStatus('active');
                        if (!inputAudioContextRef.current || !streamRef.current) return;

                        const source = inputAudioContextRef.current.createMediaStreamSource(streamRef.current);
                        mediaStreamSourceRef.current = source;
                        
                        const scriptProcessor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
                        scriptProcessorRef.current = scriptProcessor;

                        scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                            const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                            const l = inputData.length;
                            const int16 = new Int16Array(l);
                            for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
                            const pcmBlob: Blob = { data: encode(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
                            
                            sessionPromise.then((session) => {
                                session.sendRealtimeInput({ media: pcmBlob });
                            });
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputAudioContextRef.current.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const audioData = message.serverContent?.modelTurn?.parts[0]?.inlineData.data;
                        if (audioData && outputAudioContextRef.current && outputAudioContextRef.current.state === 'running') {
                             nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContextRef.current.currentTime);
                             const audioBuffer = await decodeAudioData(decode(audioData), outputAudioContextRef.current, 24000, 1);
                             const source = outputAudioContextRef.current.createBufferSource();
                             source.buffer = audioBuffer;
                             source.connect(outputNode);
                             source.addEventListener('ended', () => { sourcesRef.current.delete(source); });
                             source.start(nextStartTimeRef.current);
                             nextStartTimeRef.current = nextStartTimeRef.current + audioBuffer.duration;
                             sourcesRef.current.add(source);
                        }
                        if (message.serverContent?.interrupted) {
                            sourcesRef.current.forEach(source => source.stop());
                            sourcesRef.current.clear();
                            nextStartTimeRef.current = 0;
                        }
                    },
                    onerror: (e: ErrorEvent) => {
                        console.error('Live session error:', e);
                        setErrorMessage('A connection error occurred.');
                        releaseMediaResources();
                        sessionRef.current = null;
                        setStatus('error');
                    },
                    onclose: () => {
                        releaseMediaResources();
                        sessionRef.current = null;
                        setStatus('idle');
                    },
                },
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: 'You are a friendly and helpful tutor for a student. Keep your answers concise and encouraging.',
                },
            });
            sessionRef.current = await sessionPromise;
        } catch (err: any) {
            console.error("Failed to start session:", err);
            let msg = 'Failed to start session. Please try again.';
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                msg = 'Microphone permission was denied. Please allow access in your browser settings.';
            } else if (err.name === 'NotFoundError') {
                 msg = 'No microphone was found. Please connect a microphone and try again.';
            }
            setErrorMessage(msg);
            releaseMediaResources();
            setStatus('error');
        }
    };
    
    useEffect(() => {
        return () => {
            if (sessionRef.current) {
                sessionRef.current.close();
            }
            releaseMediaResources();
        };
    }, []);

    const getStatusUI = () => {
        switch (status) {
            case 'idle':
                return { text: 'Start Conversation', buttonClass: 'bg-primary hover:bg-primary-hover', icon: <PlayIcon /> };
            case 'connecting':
                return { text: 'Connecting...', buttonClass: 'bg-yellow-500', icon: <Spinner /> };
            case 'active':
                return { text: 'End Conversation', buttonClass: 'bg-red-500 hover:bg-red-600', icon: <StopIcon /> };
            case 'error':
                 return { text: 'Retry', buttonClass: 'bg-primary hover:bg-primary-hover', icon: <PlayIcon /> };
        }
    };
    
    const ui = getStatusUI();

    return (
      <div className="flex flex-col h-full items-center justify-center text-center">
        <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">Live Tutor</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md">Have a real-time voice conversation with an AI tutor. Ask questions, practice a language, or explain a concept out loud.</p>
        
        <div className="relative">
          <div className={`w-40 h-40 rounded-full flex items-center justify-center transition-all duration-500 ${status === 'active' ? 'bg-green-500/20' : 'bg-gray-200 dark:bg-gray-700'}`}>
            <div className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-500 ${status === 'active' ? 'bg-green-500/40' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className="w-24 h-24 rounded-full bg-white dark:bg-gray-800 shadow-inner flex items-center justify-center">
                     {status === 'active' ? <SoundWave /> : <MicIcon />}
                </div>
            </div>
          </div>
        </div>

        <button
            onClick={status === 'active' || status === 'connecting' ? stopConversation : startConversation}
            className={`mt-8 px-6 py-3 text-white font-semibold rounded-lg shadow-md flex items-center gap-2 ${ui.buttonClass}`}
        >
            {ui.icon}
            {ui.text}
        </button>
        {errorMessage && <p className="mt-4 text-sm text-red-500">{errorMessage}</p>}
      </div>
    );
};

const PlayIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>;
const StopIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" /></svg>;
const Spinner = () => <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-5 5.91V14a1 1 0 11-2 0v-2.09A7.001 7.001 0 003 8H2a7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" /></svg>;
const SoundWave = () => (
  <div className="flex items-center justify-center space-x-1">
    <div className="w-1 h-4 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0s'}}></div>
    <div className="w-1 h-6 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
    <div className="w-1 h-8 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
    <div className="w-1 h-6 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.3s'}}></div>
    <div className="w-1 h-4 bg-green-500 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></div>
  </div>
);

export default LiveConversation;
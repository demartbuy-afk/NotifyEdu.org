import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../../../utils/fileUtils';

const AudioTranscriber: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const handleStartRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = handleTranscribe;

      mediaRecorderRef.current.start();
      setIsRecording(true);
      setTranscription('');
      setError(null);
    } catch (err) {
      setError("Could not access microphone. Please grant permission.");
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsLoading(true); // Show loading state while transcribing
    }
  };

  const handleTranscribe = async () => {
    const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
    if (audioBlob.size === 0) {
      setIsLoading(false);
      return;
    }
    
    try {
      const base64Data = await blobToBase64(audioBlob);
      const audioPart = {
        inlineData: {
          mimeType: audioBlob.type,
          data: base64Data,
        },
      };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [audioPart, { text: "Transcribe this audio." }] },
      });

      setTranscription(response.text);
    } catch (e) {
      setError((e as Error).message || 'An unexpected error occurred during transcription.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center text-center">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">Audio Transcriber</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-8 max-w-md">Record a short audio clip and the AI will transcribe it into text. Useful for meeting notes or dictation.</p>
      
      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors duration-300 ${
          isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary-hover'
        } text-white shadow-lg`}
      >
        <div className={`absolute inset-0 rounded-full border-4 ${isRecording ? 'border-red-300 animate-pulse' : 'border-transparent'}`}></div>
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-5 5.91V14a1 1 0 11-2 0v-2.09A7.001 7.001 0 003 8H2a7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" />
        </svg>
      </button>
      <p className="mt-4 font-semibold text-neutral dark:text-gray-200">{isRecording ? 'Recording...' : 'Tap to Record'}</p>

      <div className="mt-8 w-full max-w-2xl flex-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4 overflow-y-auto">
        {isLoading && <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div></div>}
        {error && <p className="text-center text-red-500 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
        {transcription && (
          <p className="text-left whitespace-pre-wrap text-gray-800 dark:text-gray-200">{transcription}</p>
        )}
        {!isLoading && !error && !transcription && (
          <p className="text-gray-500 dark:text-gray-400 text-center flex items-center justify-center h-full">Your transcription will appear here.</p>
        )}
      </div>
    </div>
  );
};

export default AudioTranscriber;

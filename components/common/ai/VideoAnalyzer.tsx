import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../../../utils/fileUtils';
import { marked } from 'marked';

const VideoAnalyzer: React.FC = () => {
  const [video, setVideo] = useState<{ file: File, url: string } | null>(null);
  const [prompt, setPrompt] = useState('Provide a summary of this video.');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) { // 20MB limit
          setError("File is too large. Please upload a video smaller than 20MB.");
          return;
      }
      setVideo({ file, url: URL.createObjectURL(file) });
      setAnalysis(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!video || !prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const base64Data = await blobToBase64(video.file);
      
      const videoPart = {
        inlineData: {
          mimeType: video.file.type,
          data: base64Data,
        },
      };
      const textPart = { text: prompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-pro',
        contents: { parts: [videoPart, textPart] },
      });

      setAnalysis(response.text);

    } catch (e) {
      setError((e as Error).message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
      setVideo(null);
      setAnalysis(null);
      setError(null);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">Video Analyzer</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Upload a short video and ask the AI a question about it.</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input & Controls */}
        <div className="flex flex-col space-y-4">
           {!video ? (
                <div 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                    <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-200">Upload a Video</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">MP4, MOV, WEBM (Max 20MB)</span>
                </div>
           ) : (
             <div className="flex-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg p-2 flex items-center justify-center">
                <video src={video.url} controls className="max-w-full max-h-full object-contain rounded-md" />
             </div>
           )}

          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., What are the key topics discussed in this lecture?"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
            disabled={!video || isLoading}
          />
          <div className="flex gap-2">
            <button onClick={handleAnalyze} disabled={!video || !prompt.trim() || isLoading} className="flex-1 py-2 px-4 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover focus:outline-none disabled:bg-gray-400">
              {isLoading ? 'Analyzing...' : 'Analyze Video'}
            </button>
            {video && <button onClick={handleReset} className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Reset</button>}
          </div>
        </div>
        
        {/* Output */}
        <div className="bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4 overflow-y-auto">
          {isLoading && <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div></div>}
          {error && <p className="text-center text-red-500 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
          {analysis && (
            <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: marked(analysis) as string }} />
          )}
          {!isLoading && !error && !analysis && (
            <p className="text-gray-500 dark:text-gray-400 text-center flex items-center justify-center h-full">The AI's analysis will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default VideoAnalyzer;
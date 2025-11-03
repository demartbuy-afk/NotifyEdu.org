import React, { useState, useRef } from 'react';
import { GoogleGenAI, GenerateContentResponse } from '@google/genai';
import { blobToBase64 } from '../../../utils/fileUtils';
import { marked } from 'marked';

const ImageAnalyzer: React.FC = () => {
  const [image, setImage] = useState<{ file: File, url: string } | null>(null);
  const [prompt, setPrompt] = useState('Describe this image in detail.');
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage({ file, url: URL.createObjectURL(file) });
      setAnalysis(null);
      setError(null);
    }
  };

  const handleAnalyze = async () => {
    if (!image || !prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAnalysis(null);

    try {
      const base64Data = await blobToBase64(image.file);
      
      const imagePart = {
        inlineData: {
          mimeType: image.file.type,
          data: base64Data,
        },
      };
      const textPart = { text: prompt };

      const response: GenerateContentResponse = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: { parts: [imagePart, textPart] },
      });

      setAnalysis(response.text);

    } catch (e) {
      setError((e as Error).message || 'An unexpected error occurred during analysis.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
      setImage(null);
      setAnalysis(null);
      setError(null);
      if(fileInputRef.current) {
          fileInputRef.current.value = "";
      }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">Image Analyzer</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Upload an image and ask the AI a question about it.</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input & Controls */}
        <div className="flex flex-col space-y-4">
           {!image ? (
                <div 
                    onClick={() => fileInputRef.current?.click()} 
                    className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-4-4V7a4 4 0 014-4h2a4 4 0 014 4v1m-4 5h12a4 4 0 014 4v2a4 4 0 01-4 4H7a4 4 0 01-4-4v-2a4 4 0 014-4z" /></svg>
                    <span className="mt-2 block text-sm font-medium text-gray-900 dark:text-gray-200">Upload an Image</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">PNG, JPG, WEBP</span>
                </div>
           ) : (
             <div className="flex-1 bg-gray-100 dark:bg-gray-900/50 rounded-lg p-2 flex items-center justify-center">
                <img src={image.url} alt="Uploaded" className="max-w-full max-h-full object-contain rounded-md" />
             </div>
           )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
          
          <textarea
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., What is the historical context of this painting?"
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
            disabled={!image || isLoading}
          />
          <div className="flex gap-2">
            <button onClick={handleAnalyze} disabled={!image || !prompt.trim() || isLoading} className="flex-1 py-2 px-4 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover focus:outline-none disabled:bg-gray-400">
              {isLoading ? 'Analyzing...' : 'Analyze Image'}
            </button>
            {image && <button onClick={handleReset} className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Reset</button>}
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

export default ImageAnalyzer;
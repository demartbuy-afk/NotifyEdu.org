import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { blobToBase64 } from '../../../utils/fileUtils';

const aspectRatios = ["16:9", "9:16"];
const resolutions = ["720p", "1080p"];

const VideoGenerator: React.FC = () => {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<{ file: File, url: string } | null>(null);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [resolution, setResolution] = useState('720p');
  const [generatedVideo, setGeneratedVideo] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Initializing video generation...');
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checkApiKey = async () => {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey);
  };

  useEffect(() => {
    checkApiKey();
  }, []);

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    // Assume success and update UI immediately to avoid race conditions.
    setApiKeySelected(true);
  };
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImage({ file, url: URL.createObjectURL(file) });
    }
  };

  const handleGenerate = async () => {
    if ((!prompt.trim() && !image) || isLoading) return;

    setIsLoading(true);
    setError(null);
    setGeneratedVideo(null);
    setLoadingMessage('Initializing video generation...');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let imagePayload;
      if (image) {
          const base64Data = await blobToBase64(image.file);
          imagePayload = {
              imageBytes: base64Data,
              mimeType: image.file.type,
          };
      }

      setLoadingMessage('Generating video... This can take a few minutes.');
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        image: imagePayload,
        config: {
          numberOfVideos: 1,
          resolution: resolution as '720p' | '1080p',
          aspectRatio: aspectRatio as '16:9' | '9:16',
        }
      });
      
      let pollCount = 0;
      while (!operation.done) {
        pollCount++;
        setLoadingMessage(`Checking status (attempt ${pollCount})... Please wait.`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10s
        operation = await ai.operations.getVideosOperation({operation: operation});
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoResponse.blob();
        setGeneratedVideo(URL.createObjectURL(videoBlob));
      } else {
        throw new Error("Video generation completed, but no video URI was returned.");
      }

    } catch (e) {
      const errorMessage = (e as Error).message || 'An unexpected error occurred.';
      if (errorMessage.includes("Requested entity was not found.")) {
          setError("API Key error. Please re-select your API key.");
          setApiKeySelected(false); // Reset key selection state
      } else {
          setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (!apiKeySelected) {
    return (
        <div className="flex flex-col items-center justify-center h-full text-center">
            <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">API Key Required</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-4 max-w-md">The Veo video generation model requires you to select your own API key. This helps manage project resources and billing.</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-6 max-w-md">For more information on billing, please visit <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ai.google.dev/gemini-api/docs/billing</a>.</p>
            <button onClick={handleSelectKey} className="px-6 py-2 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover">
                Select API Key
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">Video Generator</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Create a short video from a text prompt and an optional starting image. Powered by Veo.</p>
      
      <div className="space-y-4">
        <textarea
          rows={3}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., A futuristic car driving through a neon-lit city at night."
          className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
          disabled={isLoading}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div 
                onClick={() => fileInputRef.current?.click()} 
                className="col-span-1 h-24 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
                {image ? 
                    <img src={image.url} alt="Preview" className="h-full w-full object-cover rounded-md"/> :
                    <>
                        <span className="text-sm font-medium text-gray-900 dark:text-gray-200">Add Start Image</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">(Optional)</span>
                    </>
                }
            </div>
             <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden"/>
            <select
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="h-24 block w-full text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                disabled={isLoading}
            >
                {aspectRatios.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
            </select>
            <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="h-24 block w-full text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                disabled={isLoading}
            >
                {resolutions.map(res => <option key={res} value={res}>{res}</option>)}
            </select>
        </div>
        <button onClick={handleGenerate} disabled={isLoading || (!prompt.trim() && !image)} className="w-full py-2 px-4 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover focus:outline-none disabled:bg-gray-400">
          {isLoading ? 'Generating...' : 'Generate Video'}
        </button>
      </div>

      <div className="mt-6 flex-1 flex items-center justify-center bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4">
        {isLoading && <div className="text-center"><div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary mx-auto"></div><p className="mt-4 text-gray-600 dark:text-gray-300">{loadingMessage}</p></div>}
        {error && <p className="text-center text-red-500 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
        {generatedVideo && <video src={generatedVideo} controls autoPlay loop className="max-w-full max-h-full object-contain rounded-md shadow-lg" />}
        {!isLoading && !error && !generatedVideo && <p className="text-gray-500 dark:text-gray-400">Your generated video will appear here.</p>}
      </div>
    </div>
  );
};

export default VideoGenerator;

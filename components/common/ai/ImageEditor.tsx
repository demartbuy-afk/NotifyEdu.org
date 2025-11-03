import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { blobToBase64 } from '../../../utils/fileUtils';

const ImageEditor: React.FC = () => {
  const [originalImage, setOriginalImage] = useState<{ file: File, url: string } | null>(null);
  const [editedImage, setEditedImage] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setOriginalImage({ file, url: URL.createObjectURL(file) });
      setEditedImage(null);
      setError(null);
    }
  };

  const handleEdit = async () => {
    if (!originalImage || !prompt.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setEditedImage(null);

    try {
      const base64Data = await blobToBase64(originalImage.file);
      
      const imagePart = {
        inlineData: {
          mimeType: originalImage.file.type,
          data: base64Data,
        },
      };
      const textPart = { text: prompt };

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [imagePart, textPart] },
        config: {
            responseModalities: [Modality.IMAGE],
        },
      });
      
      const part = response.candidates?.[0]?.content?.parts?.[0];
      if (part && part.inlineData) {
        const base64ImageBytes: string = part.inlineData.data;
        const imageUrl = `data:${part.inlineData.mimeType};base64,${base64ImageBytes}`;
        setEditedImage(imageUrl);
      } else {
        throw new Error("The model did not return an edited image.");
      }

    } catch (e) {
      setError((e as Error).message || 'An unexpected error occurred during image editing.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleReset = () => {
    setOriginalImage(null);
    setEditedImage(null);
    setPrompt('');
    setError(null);
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">AI Image Editor</h2>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Upload an image and tell the AI what changes to make.</p>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
        {/* Input & Controls */}
        <div className="flex flex-col space-y-4">
           {!originalImage ? (
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
                <img src={originalImage.url} alt="Original" className="max-w-full max-h-full object-contain rounded-md" />
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
            placeholder="e.g., Add a birthday hat on the person, make the background a sunny beach..."
            className="w-full px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
            disabled={!originalImage || isLoading}
          />
          <div className="flex gap-2">
            <button onClick={handleEdit} disabled={!originalImage || !prompt.trim() || isLoading} className="flex-1 py-2 px-4 bg-primary text-white font-semibold rounded-lg shadow-md hover:bg-primary-hover focus:outline-none disabled:bg-gray-400">
              {isLoading ? 'Editing...' : 'Apply Edit'}
            </button>
             {originalImage && <button onClick={handleReset} className="py-2 px-4 bg-gray-500 text-white font-semibold rounded-lg hover:bg-gray-600">Reset</button>}
          </div>
        </div>
        
        {/* Output */}
        <div className="flex items-center justify-center bg-gray-100 dark:bg-gray-900/50 rounded-lg p-4">
          {isLoading && <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>}
          {error && <p className="text-center text-red-500 bg-red-100 p-3 rounded-lg text-sm">{error}</p>}
          {editedImage && (
            <img src={editedImage} alt="Edited by AI" className="max-w-full max-h-full object-contain rounded-md shadow-lg" />
          )}
          {!isLoading && !error && !editedImage && (
            <p className="text-gray-500 dark:text-gray-400 text-center">Your edited image will appear here.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;

import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';

interface ChatbotProps {
  userType: 'school' | 'student';
}

interface Message {
  sender: 'user' | 'bot';
  text: string;
  sources?: any[];
}

const Chatbot = ({ userType }: ChatbotProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tool Toggles
  const [useSearch, setUseSearch] = useState(false);
  const [useMaps, setUseMaps] = useState(false);
  const [useThinking, setUseThinking] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { sender: 'user', text: input };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input; // FIX: Capture the current input before clearing the state.
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const model = useThinking ? 'gemini-2.5-pro' : (userType === 'school' ? 'gemini-2.5-flash' : 'gemini-flash-lite-latest');
      const tools: any[] = [];
      if(useSearch) tools.push({googleSearch: {}});
      if(useMaps) tools.push({googleMaps: {}});
      
      const config: any = {};
      if (tools.length > 0) config.tools = tools;
      if (useThinking) config.thinkingConfig = { thinkingBudget: 32768 };


      const response = await ai.models.generateContent({
        model: model,
        contents: currentInput, // FIX: Use the captured input value.
        config: Object.keys(config).length > 0 ? config : undefined,
      });

      const botMessage: Message = {
        sender: 'bot',
        text: response.text,
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks,
      };
      setMessages(prev => [...prev, botMessage]);

    } catch (e) {
      setError((e as Error).message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };
  
  const renderMessage = (msg: Message, index: number) => {
    const isBot = msg.sender === 'bot';
    const parsedHtml = isBot ? marked(msg.text) : msg.text;

    return (
      <div key={index} className={`flex ${isBot ? 'justify-start' : 'justify-end'} mb-4`}>
        <div className={`max-w-prose p-3 rounded-lg ${isBot ? 'bg-gray-100 dark:bg-gray-700' : 'bg-primary text-white'}`}>
          <div className="prose prose-sm dark:prose-invert" dangerouslySetInnerHTML={{ __html: parsedHtml as string }} />
           {msg.sources && msg.sources.length > 0 && (
              <div className="mt-2 border-t pt-2 border-gray-300 dark:border-gray-600">
                  <h4 className="text-xs font-semibold mb-1">Sources:</h4>
                  <ul className="list-disc list-inside text-xs">
                    {msg.sources.map((chunk, i) => {
                        const source = chunk.web || chunk.maps;
                        if (!source || !source.uri) return null;
                        return (
                            <li key={i}>
                                <a href={source.uri} target="_blank" rel="noopener noreferrer" className="hover:underline text-primary dark:text-blue-400">
                                    {source.title || source.uri}
                                </a>
                            </li>
                        )
                    })}
                  </ul>
              </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-2xl font-bold text-neutral dark:text-gray-200 mb-4">{userType === 'school' ? 'AI Chat Assistant' : 'AI Homework Helper'}</h2>
      
      {userType === 'school' && (
        <div className="flex flex-wrap gap-4 items-center mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <ToolToggle label="Google Search" icon="🔍" enabled={useSearch} onToggle={() => setUseSearch(!useSearch)} />
            <ToolToggle label="Google Maps" icon="🗺️" enabled={useMaps} onToggle={() => setUseMaps(!useMaps)} />
            <ToolToggle label="Thinking Mode" icon="🧠" enabled={useThinking} onToggle={() => setUseThinking(!useThinking)} description="For complex queries" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto pr-2">
        {messages.map(renderMessage)}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            </div>
          </div>
        )}
         {error && <div className="text-center text-red-500 bg-red-100 p-3 rounded-lg text-sm">{error}</div>}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask anything..."
            className="flex-1 w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-full shadow-sm text-gray-900 dark:text-gray-200 focus:outline-none focus:ring-primary focus:border-primary"
            disabled={isLoading}
          />
          <button onClick={handleSend} disabled={isLoading || !input.trim()} className="px-4 py-2 bg-primary text-white font-semibold rounded-full shadow-md hover:bg-primary-hover focus:outline-none focus:ring-2 focus:ring-primary focus:ring-opacity-75 disabled:bg-gray-400">
            Send
          </button>
        </div>
      </div>
    </div>
  );
};

interface ToolToggleProps {
    label: string;
    icon: string;
    enabled: boolean;
    onToggle: () => void;
    description?: string;
}

const ToolToggle = ({label, icon, enabled, onToggle, description}: ToolToggleProps) => (
    <div className="flex items-center">
        <label className="flex items-center cursor-pointer">
            <div className="relative">
                <input type="checkbox" className="sr-only" checked={enabled} onChange={onToggle} />
                <div className={`block w-10 h-6 rounded-full transition ${enabled ? 'bg-primary' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition transform ${enabled ? 'translate-x-4' : ''}`}></div>
            </div>
            <div className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                <span className="mr-1">{icon}</span> {label}
            </div>
        </label>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 ml-2">({description})</p>}
    </div>
);


export default Chatbot;
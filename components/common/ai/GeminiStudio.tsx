import React, { useState, Suspense } from 'react';

// Lazily load all tool components to prevent them from running on initial load
const Chatbot = React.lazy(() => import('./Chatbot'));
const ImageGenerator = React.lazy(() => import('./ImageGenerator'));
const ImageEditor = React.lazy(() => import('./ImageEditor'));
const ImageAnalyzer = React.lazy(() => import('./ImageAnalyzer'));
const VideoGenerator = React.lazy(() => import('./VideoGenerator'));
const AudioTranscriber = React.lazy(() => import('./AudioTranscriber'));
const LiveConversation = React.lazy(() => import('./LiveConversation'));
const TextToSpeech = React.lazy(() => import('./TextToSpeech'));
const VideoAnalyzer = React.lazy(() => import('./VideoAnalyzer'));


interface GeminiStudioProps {
  userType: 'school' | 'student';
}

type AiTool = 
  | 'chat' 
  | 'image-generator' 
  | 'image-editor' 
  | 'image-analyzer' 
  | 'video-generator'
  | 'video-analyzer'
  | 'audio-transcriber'
  | 'live-conversation'
  | 'text-to-speech';

// A fallback spinner for lazy loading components
const LoadingSpinner = () => (
  <div className="flex items-center justify-center h-full">
    <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-primary"></div>
  </div>
);

const GeminiStudio: React.FC<GeminiStudioProps> = ({ userType }) => {
  const [activeTool, setActiveTool] = useState<AiTool>('chat');
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const schoolTools: { id: AiTool; name: string; icon: React.ReactElement; Component: React.LazyExoticComponent<React.FC<any>>; props: any }[] = [
    { id: 'chat', name: 'AI Chat', icon: <ChatIcon />, Component: Chatbot, props: { userType: 'school' } },
    { id: 'image-generator', name: 'Image Generator', icon: <ImageIcon />, Component: ImageGenerator, props: {} },
    { id: 'video-generator', name: 'Video Generator', icon: <VideoIcon />, Component: VideoGenerator, props: {} },
    { id: 'video-analyzer', name: 'Video Analyzer', icon: <VideoAnalysisIcon/>, Component: VideoAnalyzer, props: {} },
    { id: 'audio-transcriber', name: 'Audio Transcriber', icon: <MicIcon />, Component: AudioTranscriber, props: {} },
    { id: 'text-to-speech', name: 'Text to Speech', icon: <SpeakerIcon />, Component: TextToSpeech, props: {} },
  ];

  const studentTools: { id: AiTool; name: string; icon: React.ReactElement; Component: React.LazyExoticComponent<React.FC<any>>; props: any }[] = [
    { id: 'chat', name: 'AI Assistant', icon: <ChatIcon />, Component: Chatbot, props: { userType: 'student' } },
    { id: 'live-conversation', name: 'Live Tutor', icon: <LiveIcon />, Component: LiveConversation, props: {} },
    // Image Tools
    { id: 'image-analyzer', name: 'Image Analyzer', icon: <SearchIcon />, Component: ImageAnalyzer, props: {} },
    { id: 'image-editor', name: 'Image Editor', icon: <EditIcon />, Component: ImageEditor, props: {} },
    { id: 'image-generator', name: 'Image Generator', icon: <ImageIcon />, Component: ImageGenerator, props: {} },
    // Video Tools
    { id: 'video-analyzer', name: 'Video Analyzer', icon: <VideoAnalysisIcon/>, Component: VideoAnalyzer, props: {} },
    // Audio Tools
    { id: 'audio-transcriber', name: 'Audio Transcriber', icon: <MicIcon />, Component: AudioTranscriber, props: {} },
    { id: 'text-to-speech', name: 'Text to Speech', icon: <SpeakerIcon />, Component: TextToSpeech, props: {} },
  ];
  
  const tools = userType === 'school' ? schoolTools : studentTools;
  const activeToolInfo = tools.find(t => t.id === activeTool);

  const handleSelectTool = (toolId: AiTool) => {
    setActiveTool(toolId);
    setIsMenuOpen(false);
  };

  return (
    <div className="relative flex flex-col h-full bg-white dark:bg-gray-800">
      {/* Slide-out Menu */}
      <>
        {/* Overlay */}
        <div
            className={`absolute inset-0 bg-black/60 z-30 transition-opacity duration-300 ${isMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsMenuOpen(false)}
        ></div>

        {/* Menu Panel */}
        <aside
            className={`absolute top-0 left-0 h-full w-72 bg-gray-50 dark:bg-gray-900 shadow-xl z-40 transform transition-transform duration-300 ease-in-out ${isMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            aria-hidden={!isMenuOpen}
        >
            <div className="p-4 flex justify-between items-center border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-neutral dark:text-gray-100">AI Tools</h2>
                <button onClick={() => setIsMenuOpen(false)} className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700" aria-label="Close menu">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-500 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>
            <nav className="p-2 space-y-1">
                {tools.map(tool => (
                    <button
                        key={tool.id}
                        onClick={() => handleSelectTool(tool.id)}
                        className={`flex items-center w-full p-3 rounded-lg text-left transition-colors text-sm font-medium ${
                            activeTool === tool.id
                            ? 'bg-primary/10 text-primary dark:bg-primary/20'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                        }`}
                    >
                        <span className="mr-3">{tool.icon}</span>
                        {tool.name}
                    </button>
                ))}
            </nav>
        </aside>
      </>

      {/* Main Content with Header */}
      <header className="flex items-center gap-4 p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
          <button 
              onClick={() => setIsMenuOpen(true)}
              className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
              aria-label="Open AI tools menu"
          >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <h1 className="text-xl font-bold text-neutral dark:text-gray-200">
              {activeToolInfo?.name}
          </h1>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <Suspense fallback={<LoadingSpinner />}>
          {activeToolInfo && <activeToolInfo.Component {...activeToolInfo.props} />}
        </Suspense>
      </main>
    </div>
  );
};

// SVG Icons
const ChatIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 5v8a2 2 0 01-2 2h-5l-5 4v-4H4a2 2 0 01-2-2V5a2 2 0 012-2h12a2 2 0 012 2zM7 8H5v2h2V8zm2 0h2v2H9V8zm6 0h-2v2h2V8z" clipRule="evenodd" /></svg>;
const ImageIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" /></svg>;
const EditIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M17.414 2.586a2 2 0 00-2.828 0L7 10.172V13h2.828l7.586-7.586a2 2 0 000-2.828z" /><path fillRule="evenodd" d="M2 6a2 2 0 012-2h4a1 1 0 010 2H4v10h10v-4a1 1 0 112 0v4a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" clipRule="evenodd" /></svg>;
const SearchIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" /></svg>;
const VideoIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /></svg>;
const MicIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8h-1a6 6 0 11-5 5.91V14a1 1 0 11-2 0v-2.09A7.001 7.001 0 003 8H2a7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-2v-2.07z" clipRule="evenodd" /></svg>;
const LiveIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 12.586V8a6 6 0 00-6-6zM10 16a2 2 0 110-4 2 2 0 010 4z" /></svg>;
const SpeakerIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414z" clipRule="evenodd" /><path d="M16.657 5.757a1 1 0 00-1.414 0A5.973 5.973 0 0014 10a5.973 5.973 0 001.243 4.243 1 1 0 001.414-1.414A3.986 3.986 0 0116 10a3.986 3.986 0 01-.586-2.829 1 1 0 000-1.414z" /></svg>;
const VideoAnalysisIcon = () => <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 001.553.832l3-2a1 1 0 000-1.664l-3-2z" /><path fillRule="evenodd" d="M12.586 17.586a2 2 0 112.828-2.828 2 2 0 01-2.828 2.828zM14 16a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>;


export default GeminiStudio;
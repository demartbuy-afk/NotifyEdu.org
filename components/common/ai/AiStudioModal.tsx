import React from 'react';
import GeminiStudio from './GeminiStudio';

interface AiStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AiStudioModal: React.FC<AiStudioModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full h-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        <header className="p-4 border-b dark:border-gray-700 flex justify-between items-center flex-shrink-0">
          <h2 className="text-xl font-bold text-neutral dark:text-gray-200 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-primary" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M9.619 2.177a.75.75 0 01.762 0l4.5 2.25a.75.75 0 010 1.348l-4.5 2.25a.75.75 0 01-.762 0l-4.5-2.25a.75.75 0 010-1.348l4.5-2.25zM8.5 6.695l4.5 2.25a.75.75 0 010 1.348l-4.5 2.25a.75.75 0 01-.762 0L3.5 10.293a.75.75 0 010-1.348l4.5-2.25a.75.75 0 01.762 0zM8.5 11.195l4.5 2.25a.75.75 0 010 1.348l-4.5 2.25a.75.75 0 01-.762 0L3.5 14.793a.75.75 0 010-1.348l4.5-2.25a.75.75 0 01.762 0z" clipRule="evenodd" /></svg>
            Student AI Studio
          </h2>
          <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </header>
        <div className="flex-1 overflow-hidden">
          <GeminiStudio userType="student" />
        </div>
      </div>
    </div>
  );
};

export default AiStudioModal;

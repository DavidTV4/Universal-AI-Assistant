import React from 'react';

const TypingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-6">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center">
           {/* Using a simple SVG or nothing for the avatar in loading state */}
           <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
        </div>
        <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 flex items-center gap-1.5 h-10">
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-2 h-2 bg-slate-400 rounded-full animate-bounce"></div>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
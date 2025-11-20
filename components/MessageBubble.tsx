import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Message, MessageRole, ContentType } from '../types';
import { User, Bot, Image as ImageIcon } from 'lucide-react';

interface MessageBubbleProps {
  message: Message;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === MessageRole.USER;
  const isImage = message.type === ContentType.IMAGE;

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}>
        
        {/* Avatar */}
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isUser ? 'bg-blue-600' : 'bg-indigo-500'}`}>
          {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
        </div>

        {/* Content Bubble */}
        <div 
          className={`p-4 rounded-2xl shadow-md overflow-hidden ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700'
          }`}
        >
          {isImage ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 text-sm text-slate-300 mb-2">
                <ImageIcon size={14} />
                <span>Generated Image</span>
              </div>
              <img 
                src={`data:image/jpeg;base64,${message.content}`} 
                alt="Generated AI content" 
                className="rounded-lg w-full max-w-sm h-auto object-cover border border-slate-600"
              />
            </div>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none leading-relaxed">
              <ReactMarkdown
                components={{
                  code({className, children, ...props}) {
                    const match = /language-(\w+)/.exec(className || '')
                    const isInline = !match && !String(children).includes('\n');
                    return !isInline ? (
                      <div className="relative group my-4">
                        <div className="absolute top-0 right-0 bg-slate-700 text-xs px-2 py-1 rounded-bl-md text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity">
                          {match?.[1] || 'code'}
                        </div>
                        <pre className="bg-slate-950/50 p-4 rounded-lg border border-slate-700/50 overflow-x-auto">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="bg-slate-700/50 px-1.5 py-0.5 rounded text-blue-200 font-mono text-sm" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                  ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                  a: ({node, ...props}) => <a className="text-blue-400 hover:underline" {...props} target="_blank" rel="noreferrer" />,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
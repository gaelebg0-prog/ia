import React from 'react';
import { Message, Role, Attachment } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  const getFileSrc = (att: Attachment) => {
    if ((att.mimeType.startsWith('image/') || att.mimeType.startsWith('video/') || att.mimeType === 'application/pdf') && att.data) {
      return `data:${att.mimeType};base64,${att.data}`;
    }
    return att.previewUrl;
  };

  const renderAttachment = (att: Attachment, idx: number) => {
    const isImage = att.mimeType.startsWith('image/');
    const isVideo = att.mimeType.startsWith('video/');
    const isPdf = att.mimeType === 'application/pdf';
    const fileSrc = getFileSrc(att);

    if (isImage) {
      return (
        <img key={idx} src={fileSrc} alt={att.name} className="h-32 w-32 object-cover rounded-lg border shadow-sm" />
      );
    }

    if (isVideo) {
      return (
        <div key={idx} className="relative h-32 w-32 overflow-hidden rounded-lg border bg-black shadow-sm group">
          <video src={fileSrc} className="w-full h-full object-cover" onMouseOver={e => (e.target as HTMLVideoElement).play()} onMouseOut={e => (e.target as HTMLVideoElement).pause()} muted />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-100 group-hover:opacity-0 transition-opacity">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div key={idx} className="h-32 w-32 flex flex-col items-center justify-center rounded-lg border bg-white shadow-sm p-2 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
          <span className="text-[10px] font-bold truncate w-full">{att.name}</span>
        </div>
      );
    }

    return (
      <div key={idx} className="h-20 w-32 flex flex-col items-center justify-center rounded-lg border bg-slate-50 p-2">
        <span className="text-[10px] truncate w-full text-center">{att.name}</span>
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-4 fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${isUser ? 'ml-3' : 'mr-3'}`} style={{ backgroundColor: isUser ? 'var(--primary)' : 'var(--border-color)', color: isUser ? 'white' : 'var(--text-main)' }}>
          {isUser ? 'VOUS' : 'AI'}
        </div>
        
        <div className="flex flex-col">
          <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm theme-transition ${
            isUser ? 'rounded-tr-none text-white' : 'rounded-tl-none border'
          }`} style={{ 
            backgroundColor: isUser ? 'var(--primary)' : 'var(--bg-card)',
            borderColor: isUser ? 'transparent' : 'var(--border-color)',
            color: isUser ? 'white' : 'var(--text-main)'
          }}>
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {message.attachments.map((att, idx) => renderAttachment(att, idx))}
              </div>
            )}
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          </div>
          <span className="text-[9px] mt-1 opacity-50 px-1">
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};
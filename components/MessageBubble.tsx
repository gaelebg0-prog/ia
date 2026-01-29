
import React from 'react';
import { Message, Role, Attachment } from '../types';

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const isUser = message.role === Role.USER;

  const getFileSrc = (att: Attachment) => {
    // Si c'est une image, une vidéo ou un PDF et que nous avons les données base64, utilisez-les
    // car les URL de blob (previewUrl) expirent à la fin de la session.
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
        <img 
          key={idx}
          src={fileSrc} 
          alt={att.name} 
          className="h-32 w-32 object-cover rounded-lg border border-slate-200 shadow-sm transition-transform hover:scale-105"
        />
      );
    }

    if (isVideo) {
      return (
        <div key={idx} className="relative group h-32 w-32 overflow-hidden rounded-lg border border-slate-200 bg-black shadow-sm transition-transform hover:scale-105 cursor-pointer">
          <video 
            src={fileSrc} 
            className="w-full h-full object-cover"
            onMouseOver={e => (e.target as HTMLVideoElement).play()}
            onMouseOut={e => {
              const v = e.target as HTMLVideoElement;
              v.pause();
              v.currentTime = 0;
            }}
            muted
            playsInline
            preload="metadata"
          />
          
          {/* Overlay dégradé */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
            <span className="text-[10px] text-white font-medium truncate drop-shadow-md">{att.name}</span>
          </div>

          {/* Badge icon vidéo */}
          <div className="absolute top-1.5 right-1.5 bg-blue-500 text-white p-1 rounded-full shadow-md z-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
      );
    }

    if (isPdf) {
      return (
        <div key={idx} className="relative group h-32 w-32 overflow-hidden rounded-lg border border-red-200 bg-white shadow-sm transition-transform hover:scale-105 cursor-pointer">
          {/* Aperçu PDF via iframe - pointer-events-none empêche l'interaction avec le PDF interne dans la bulle */}
          <iframe 
            src={`${fileSrc}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
            className="w-full h-full pointer-events-none origin-top scale-[1.8]"
            title={att.name}
            style={{ border: 'none' }}
          />
          
          {/* Overlay dégradé pour la lisibilité du nom du fichier */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex flex-col justify-end p-2 pointer-events-none">
            <div className="flex items-center gap-1 text-white">
              <div className="bg-red-500 px-1 py-0.5 rounded-[3px] text-[7px] font-bold uppercase shadow-sm shrink-0">PDF</div>
              <span className="text-[10px] font-medium truncate drop-shadow-md">{att.name}</span>
            </div>
          </div>

          {/* Badge icon pour identification visuelle rapide */}
          <div className="absolute top-1.5 right-1.5 bg-red-500 text-white p-1 rounded-full shadow-md z-10 pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
        </div>
      );
    }

    return (
      <div key={idx} className="h-24 w-36 flex flex-col items-center justify-center rounded-lg border p-3 transition-all hover:bg-white bg-slate-50 border-slate-200 shadow-sm">
        <div className="mb-2 p-1.5 rounded-md bg-slate-400 text-white shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <span className="text-[10px] text-center truncate w-full font-semibold text-slate-600">
          {att.name}
        </span>
        <span className="text-[8px] text-slate-400 mt-0.5 uppercase tracking-wider">
          Fichier
        </span>
      </div>
    );
  };

  return (
    <div className={`flex w-full mb-6 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[85%] md:max-w-[70%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shadow-sm ${isUser ? 'ml-3 bg-blue-600 text-white' : 'mr-3 bg-slate-200 text-slate-600'}`}>
          {isUser ? 'MOI' : 'AI'}
        </div>
        
        <div className="flex flex-col">
          <div className={`px-4 py-3 rounded-2xl shadow-sm text-sm ${
            isUser 
              ? 'bg-blue-600 text-white rounded-tr-none' 
              : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
          }`}>
            {/* Rendu des pièces jointes */}
            {message.attachments && message.attachments.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3">
                {message.attachments.map((att, idx) => renderAttachment(att, idx))}
              </div>
            )}
            
            <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
          </div>
          
          <span className={`text-[10px] mt-1 text-slate-400 ${isUser ? 'text-right' : 'text-left'}`}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </div>
  );
};

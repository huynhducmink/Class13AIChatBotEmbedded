import { Message } from '../App';
import { Bot, User, FileText } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.type === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-blue-600'
            : 'bg-slate-200 dark:bg-slate-700'
        }`}
      >
        {isUser ? (
          <User className="size-5 text-white" />
        ) : (
          <Bot className="size-5 text-slate-700 dark:text-slate-300" />
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 max-w-[80%] ${isUser ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
        <Card
          className={`p-3 ${
            isUser
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
          }`}
        >
          {message.file && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current/20">
              <FileText className="size-4" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{message.file.name}</p>
                <p className="text-xs opacity-70">
                  {(message.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <Badge
                variant="secondary"
                className={isUser ? 'bg-blue-700 text-white' : ''}
              >
                {message.file.type.split('/')[1]?.toUpperCase() || 'FILE'}
              </Badge>
            </div>
          )}
          {message.loading ? (
            <LoadingSpinner size="md" />
          ) : (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          )}
        </Card>

        {/* Timestamp */}
        <span className="text-xs text-slate-500 dark:text-slate-400 px-1">
          {message.timestamp.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
}

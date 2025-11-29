import { Message, DocumentSource } from '../App';
import { Bot, User, FileText, ExternalLink } from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { LoadingSpinner } from './LoadingSpinner';

interface ChatMessageProps {
  message: Message;
  onOpenPdf?: (source: string, page?: number, searchText?: string) => void;
}

export function ChatMessage({ message, onOpenPdf }: ChatMessageProps) {
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

        {/* Source Documents */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="space-y-2 w-full">
            <p className="text-xs text-slate-600 dark:text-slate-400 font-medium">
              📚 Sources ({message.sources.length})
            </p>
            <div className="space-y-1">
              {message.sources.map((source, idx) => (
                <Card
                  key={idx}
                  className="p-2 bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                >
                  <div className="flex items-start gap-2">
                    <FileText className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                          {source.source.split('/').pop()}
                        </p>
                        {source.page && (
                          <Badge variant="outline" className="text-xs">
                            Page {source.page}
                          </Badge>
                        )}
                        {source.score && (
                          <Badge variant="secondary" className="text-xs">
                            {(source.score * 100).toFixed(0)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {source.text.substring(0, 120)}...
                      </p>
                    </div>
                    {onOpenPdf && source.source.endsWith('.pdf') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 flex-shrink-0"
                        onClick={() => onOpenPdf(source.source, source.page, source.text)}
                      >
                        <ExternalLink className="size-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

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

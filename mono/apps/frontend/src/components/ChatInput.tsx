import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Send, Mic, MicOff, Paperclip, X } from 'lucide-react';
import { Badge } from './ui/badge';

interface ChatInputProps {
  onSendMessage: (content: string, file?: File) => void;
}

export function ChatInput({ onSendMessage }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const handleSend = () => {
    if (message.trim() || selectedFile) {
      onSendMessage(message.trim() || 'Đã gửi file', selectedFile || undefined);
      setMessage('');
      setSelectedFile(null);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const toggleRecording = async () => {
    if (!isRecording) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        const audioChunks: Blob[] = [];

        mediaRecorder.addEventListener('dataavailable', (event) => {
          audioChunks.push(event.data);
        });

        mediaRecorder.addEventListener('stop', () => {
          const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
          const audioFile = new File([audioBlob], `voice-${Date.now()}.wav`, {
            type: 'audio/wav',
          });
          setSelectedFile(audioFile);
          setMessage('Đã ghi âm giọng nói');
          
          stream.getTracks().forEach((track) => track.stop());
        });

        mediaRecorder.start();
        setIsRecording(true);
        setRecordingTime(0);

        recordingIntervalRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        setMessage('Không thể truy cập microphone. Vui lòng cấp quyền truy cập.');
      }
    } else {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!message.trim()) {
        setMessage(`Đã chọn: ${file.name}`);
      }
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    if (message.includes('Đã chọn:') || message.includes('Đã ghi âm')) {
      setMessage('');
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-slate-200 dark:border-slate-800">
      {/* File Preview */}
      {selectedFile && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-lg">
          <Paperclip className="size-4 text-slate-600 dark:text-slate-400" />
          <div className="flex-1 min-w-0">
            <p className="text-sm truncate text-slate-900 dark:text-slate-100">
              {selectedFile.name}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={removeFile}
            className="size-8 p-0"
          >
            <X className="size-4" />
          </Button>
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="mb-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
          <div className="size-2 bg-red-600 rounded-full animate-pulse" />
          <span className="text-sm text-red-700 dark:text-red-400">
            Đang ghi âm... {formatTime(recordingTime)}
          </span>
        </div>
      )}

      {/* Input Area */}
      <div className="flex gap-2">
        <TooltipProvider>
          {/* Voice Recording Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isRecording ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleRecording}
                className="flex-shrink-0"
              >
                {isRecording ? (
                  <MicOff className="size-5" />
                ) : (
                  <Mic className="size-5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isRecording ? 'Dừng ghi âm' : 'Ghi âm giọng nói'}</p>
            </TooltipContent>
          </Tooltip>

          {/* File Upload Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                className="flex-shrink-0"
              >
                <Paperclip className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload file (code, docs, logs)</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".c,.cpp,.h,.py,.js,.json,.txt,.log,.hex,.bin,.ino,.asm"
        />

        {/* Text Input */}
        <Input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyPress}
          placeholder="Nhập câu hỏi về embedded dev, GPIO, UART, I2C..."
          className="flex-1"
          disabled={isRecording}
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={!message.trim() && !selectedFile}
          className="flex-shrink-0"
        >
          <Send className="size-5" />
        </Button>
      </div>

      {/* Helper Text */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tip: Upload code files để review, hoặc hỏi về protocols
        </p>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">
            .c/.cpp
          </Badge>
          <Badge variant="outline" className="text-xs">
            .py
          </Badge>
          <Badge variant="outline" className="text-xs">
            .ino
          </Badge>
        </div>
      </div>
    </Card>
  );
}
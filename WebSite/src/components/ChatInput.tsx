import React, { useState, useRef, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './ui/tooltip';
import { Send, Mic, MicOff, Paperclip, X, Loader2, AlertCircle } from 'lucide-react';
import { Badge } from './ui/badge';
import { fileService } from '../services/fileService';

interface ChatInputProps {
  onSendMessage: (content: string, file?: File) => void;
  onAddNotice: (content: string) => void;
  isSending?: boolean;
}

export function ChatInput({ onSendMessage, onAddNotice, isSending }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, []);

  const handleSend = async () => {
    if (!(message.trim() || selectedFile)) return;
    
    if (isSending) return; // prevent duplicate sends

    setErrorMsg(null);

    const trimmed = message.trim();
    const isAutoPlaceholder = trimmed.startsWith('Đã chọn:') || trimmed.startsWith('Đã ghi âm');
    const isUserMessageEmpty = trimmed === '' || isAutoPlaceholder;
    const onlyUpload = !!selectedFile && isUserMessageEmpty;

    // If there's a selected file, attempt server upload first (for supported types)
    if (selectedFile) {
      const ext = (selectedFile.name.split('.').pop() || '').toLowerCase();
      const allowed = ['pdf', 'txt', 'doc', 'docx'];

      if (allowed.indexOf(ext) !== -1) {
        try {
          setUploading(true);
          setUploadProgress(0);
          await fileService.uploadFile(selectedFile, (progress) => {
            setUploadProgress(progress);
          });
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Upload thất bại';
          setErrorMsg(msg);
        } finally {
          setUploading(false);
          setUploadProgress(0);
        }
        // If user only intended to upload (no real message), don't send chat
        if (onlyUpload) {
          onAddNotice(`✅ Tài liệu "${selectedFile.name}" đã được tải lên thành công.`);
          setMessage('');
          setSelectedFile(null);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }
      } else if (ext === 'wav') {
        // Voice recordings are not supported by backend upload
        if (onlyUpload) {
          setErrorMsg('File ghi âm (.wav) chưa hỗ trợ upload lên server. Vui lòng nhập nội dung nếu muốn gửi qua chat.');
          return;
        } else {
          setErrorMsg('File ghi âm (.wav) chưa hỗ trợ upload lên server. Vẫn gửi trong chat.');
        }
      } else {
        if (onlyUpload) {
          setErrorMsg('Loại file không hỗ trợ upload lên server. Vui lòng nhập nội dung nếu muốn gửi qua chat.');
          return;
        } else {
          setErrorMsg('Loại file không hỗ trợ upload lên server. Chỉ gửi trong chat.');
        }
      }
    }

    // Proceed to send the chat message (with file attached for context)
    onSendMessage(trimmed || (selectedFile ? `Đã gửi file: ${selectedFile.name}` : ''), selectedFile || undefined);
    setMessage('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isSending) handleSend();
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

        recordingIntervalRef.current = window.setInterval(() => {
          setRecordingTime((prev: number) => prev + 1);
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
        window.clearInterval(recordingIntervalRef.current);
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
    const secsStr = ('0' + secs).slice(-2);
    return `${mins}:${secsStr}`;
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
          {uploading && (
            <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
              <Loader2 className="size-4 animate-spin" /> {uploadProgress.toFixed(0)}%
            </div>
          )}
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

      {/* Error Message */}
      {errorMsg && (
        <div className="mb-3 flex items-center gap-2 p-2 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
          <AlertCircle className="size-4 text-red-600" />
          <span className="text-xs text-red-700 dark:text-red-400">{errorMsg}</span>
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
                className="shrink-0"
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
                className="shrink-0"
              >
                <Paperclip className="size-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Upload tài liệu: PDF, TXT, DOC, DOCX</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept=".pdf,.txt,.doc,.docx"
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
          disabled={(uploading) || (!message.trim() && !selectedFile)}
          className="shrink-0"
        >
          <Send className="size-5" />
        </Button>
      </div>

      {/* Helper Text */}
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Tip: Chỉ hỗ trợ upload tài liệu: PDF, TXT, DOC, DOCX
        </p>
        <div className="flex gap-1">
          <Badge variant="outline" className="text-xs">.pdf</Badge>
          <Badge variant="outline" className="text-xs">.txt</Badge>
          <Badge variant="outline" className="text-xs">.doc</Badge>
          <Badge variant="outline" className="text-xs">.docx</Badge>
        </div>
      </div>
    </Card>
  );
}
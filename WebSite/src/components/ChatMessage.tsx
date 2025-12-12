import React, { useEffect, useRef, useState } from "react";
import { Bot, User, FileText, ExternalLink, Volume, Volume2 } from "lucide-react";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { LoadingSpinner } from "./LoadingSpinner";
import { Message } from "../types";

interface ChatMessageProps {
  message: Message;
  onOpenPdf?: (source: string, page?: number, searchText?: string) => void;
}

export function ChatMessage({ message, onOpenPdf }: ChatMessageProps) {
  const isUser = message.type === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 size-8 rounded-full flex items-center justify-center ${
          isUser ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="size-5 text-white" />
        ) : (
          <Bot className="size-5 text-slate-700 dark:text-slate-300" />
        )}
      </div>

      {/* Message Content */}
      <div
        className={`flex-1 max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-2`}
      >
        <Card
          className={`p-3 ${
            isUser
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
          }`}
        >
          {message.file && (
            <div className="flex items-center gap-2 mb-2 pb-2 border-b border-current/20">
              <FileText className="size-4" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{message.file.name}</p>
                <p className="text-xs opacity-70">{(message.file.size / 1024).toFixed(1)} KB</p>
              </div>
              <Badge variant="secondary" className={isUser ? "bg-blue-700 text-white" : ""}>
                {message.file.type.split("/")[1]?.toUpperCase() || "FILE"}
              </Badge>
            </div>
          )}

          {message.loading ? (
            <LoadingSpinner size="md" />
          ) : (
            <div className="flex items-start gap-2">
              <p className="whitespace-pre-wrap break-words flex-1">{message.content}</p>

              {/* Inline speaker icon: plays audio URL or uses TTS fallback for bot */}
              {(message.audio || message.type === "bot") && <SpeakerControl message={message} />}
            </div>
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
                          {source.source.split("/").pop()}
                        </p>
                        {source.page && (
                          <Badge variant="outline" className="text-xs">
                            Page {source.page}
                          </Badge>
                        )}
                        {/* Show file type badge for non-PDF files */}
                        {!source.source.endsWith(".pdf") && (
                          <Badge variant="secondary" className="text-xs">
                            {source.source.split(".").pop()?.toUpperCase() || "FILE"}
                          </Badge>
                        )}
                        {/* Show file type badge for non-PDF files */}
                        {!source.source.endsWith(".pdf") && (
                          <Badge variant="secondary" className="text-xs">
                            {source.source.split(".").pop()?.toUpperCase() || "FILE"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2">
                        {source.text.substring(0, 120)}...
                      </p>
                    </div>
                    {/* PDF viewer button for PDFs */}
                    {/* PDF viewer button for PDFs */}
                    {onOpenPdf && source.source.endsWith(".pdf") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 flex-shrink-0"
                        onClick={() => onOpenPdf(source.source, source.page, source.text)}
                      >
                        <ExternalLink className="size-3" />
                      </Button>
                    )}
                    {/* Preview button for TXT files (can open in new tab) */}
                    {source.source.endsWith(".txt") && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 flex-shrink-0"
                        onClick={() => {
                          const filename =
                            source.source.split("/").pop() ||
                            source.source.split("\\").pop() ||
                            source.source;
                          const viewUrl = `http://localhost:8000/api/v1/files/download/${encodeURIComponent(
                            filename
                          )}`;
                          window.open(viewUrl, "_blank");
                        }}
                        title="View text file"
                      >
                        <ExternalLink className="size-3" />
                      </Button>
                    )}
                    {/* Download button for DOCX files (cannot preview) */}
                    {(source.source.endsWith(".docx") || source.source.endsWith(".doc")) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-6 flex-shrink-0"
                        onClick={() => {
                          const filename =
                            source.source.split("/").pop() ||
                            source.source.split("\\").pop() ||
                            source.source;
                          const downloadUrl = `http://localhost:8000/api/v1/files/download/${encodeURIComponent(
                            filename
                          )}`;
                          window.open(downloadUrl, "_blank");
                        }}
                        title="Download file"
                      >
                        <svg
                          className="size-3"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
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
          {message.timestamp.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit"
          })}
        </span>
      </div>
    </div>
  );
}

function SpeakerControl({ message }: { message: Message }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      // cleanup audio or speech on unmount
      try {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.src = "";
          audioRef.current = null;
        }
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      } catch (e) {
        // ignore cleanup errors
      }
    };
  }, []);

  const handleAudioToggle = async () => {
    if (!message.audio) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(message.audio);
      audioRef.current.addEventListener("play", () => setIsPlaying(true));
      audioRef.current.addEventListener("pause", () => setIsPlaying(false));
      audioRef.current.addEventListener("ended", () => setIsPlaying(false));
      try {
        await audioRef.current.play();
      } catch (e) {
        // play may be blocked until user interaction — ignore
      }
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      try {
        await audioRef.current.play();
      } catch (e) {
        // ignore
      }
    }
  };

  const handleTtsToggle = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const synth = window.speechSynthesis;
    if (synth.speaking || isPlaying) {
      synth.cancel();
      setIsPlaying(false);
      utterRef.current = null;
      return;
    }

    const utter = new SpeechSynthesisUtterance(message.content || "");
    utter.onstart = () => setIsPlaying(true);
    utter.onend = () => setIsPlaying(false);
    utter.onerror = () => setIsPlaying(false);
    utterRef.current = utter;
    try {
      synth.speak(utter);
    } catch (e) {
      // ignore
    }
  };

  const onClick = () => {
    if (message.audio) {
      void handleAudioToggle();
    } else {
      handleTtsToggle();
    }
  };

  return (
    <button
      onClick={onClick}
      aria-label={
        message.audio
          ? isPlaying
            ? "Pause audio"
            : "Play audio"
          : isPlaying
          ? "Stop speech"
          : "Listen"
      }
      className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {isPlaying ? (
        <Volume2 className="size-5 text-blue-600 animate-pulse" />
      ) : (
        <Volume className="size-5 text-slate-600 dark:text-slate-300" />
      )}
    </button>
  );
}

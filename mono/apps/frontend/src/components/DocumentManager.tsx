import { useState } from 'react';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { ScrollArea } from './ui/scroll-area';
import {
  FileText,
  Trash2,
  Download,
  Search,
  ArrowLeft,
  Upload,
  Calendar,
  FileCode,
} from 'lucide-react';
import { Separator } from './ui/separator';

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  timestamp: Date;
  conversationId?: string;
}

interface DocumentManagerProps {
  files: UploadedFile[];
  onDeleteFile: (fileId: string) => void;
  onBack: () => void;
}

export function DocumentManager({
  files,
  onDeleteFile,
  onBack,
}: DocumentManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Group files by date
  const groupedFiles = files.reduce((acc, file) => {
    const dateKey = new Date(file.timestamp).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(file);
    return acc;
  }, {} as Record<string, UploadedFile[]>);

  // Sort dates descending
  const sortedDates = Object.keys(groupedFiles).sort((a, b) => {
    const dateA = groupedFiles[a][0].timestamp;
    const dateB = groupedFiles[b][0].timestamp;
    return dateB.getTime() - dateA.getTime();
  });

  // Filter files by search query
  const filteredDates = sortedDates.filter((date) => {
    const filesInDate = groupedFiles[date];
    return filesInDate.some((file) =>
      file.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('audio')) {
      return '🎤';
    }
    if (
      fileType.includes('text') ||
      fileType.includes('code') ||
      fileType.includes('json')
    ) {
      return '📄';
    }
    return '📎';
  };

  const getTotalSize = () => {
    const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
    const totalMB = totalBytes / (1024 * 1024);
    return totalMB < 1
      ? `${(totalBytes / 1024).toFixed(1)} KB`
      : `${totalMB.toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Button variant="outline" size="icon" onClick={onBack}>
              <ArrowLeft className="size-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-slate-900 dark:text-slate-100">
                Quản lý Tài liệu
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Tất cả file đã upload trong các cuộc trò chuyện
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <FileText className="size-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Tổng số file
                  </p>
                  <p className="text-slate-900 dark:text-slate-100">
                    {files.length}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Upload className="size-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Dung lượng
                  </p>
                  <p className="text-slate-900 dark:text-slate-100">
                    {getTotalSize()}
                  </p>
                </div>
              </div>
            </Card>

            <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <FileCode className="size-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Loại file
                  </p>
                  <p className="text-slate-900 dark:text-slate-100">
                    {new Set(files.map((f) => f.type.split('/')[1])).size}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Search */}
          <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                placeholder="Tìm kiếm file theo tên..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </Card>
        </div>

        {/* Files List */}
        <Card className="bg-white/80 dark:bg-slate-900/80 backdrop-blur">
          <ScrollArea className="h-[calc(100vh-400px)]">
            {files.length === 0 ? (
              <div className="p-12 text-center">
                <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-4">
                  <FileText className="size-12 text-slate-400" />
                </div>
                <h3 className="text-slate-900 dark:text-slate-100 mb-2">
                  Chưa có tài liệu nào
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Upload file trong cuộc trò chuyện để quản lý tại đây
                </p>
              </div>
            ) : filteredDates.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-slate-600 dark:text-slate-400">
                  Không tìm thấy file nào
                </p>
              </div>
            ) : (
              <div className="p-4 space-y-6">
                {filteredDates.map((date) => {
                  const filesInDate = groupedFiles[date].filter((file) =>
                    file.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );

                  return (
                    <div key={date}>
                      {/* Date Header */}
                      <div className="flex items-center gap-2 mb-3">
                        <Calendar className="size-4 text-slate-500" />
                        <h3 className="text-sm text-slate-700 dark:text-slate-300">
                          {date}
                        </h3>
                        <Separator className="flex-1" />
                        <Badge variant="secondary">{filesInDate.length}</Badge>
                      </div>

                      {/* Files */}
                      <div className="space-y-2 ml-6">
                        {filesInDate.map((file) => (
                          <Card
                            key={file.id}
                            className="p-4 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                          >
                            <div className="flex items-start gap-3">
                              <div className="text-2xl mt-1">
                                {getFileIcon(file.type)}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-slate-900 dark:text-slate-100 truncate">
                                      {file.name}
                                    </p>
                                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                                      <Badge
                                        variant="outline"
                                        className="text-xs"
                                      >
                                        {file.type.split('/')[1]?.toUpperCase() ||
                                          'FILE'}
                                      </Badge>
                                      <span className="text-xs text-slate-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </span>
                                      <span className="text-xs text-slate-400">
                                        •
                                      </span>
                                      <span className="text-xs text-slate-500">
                                        {file.timestamp.toLocaleTimeString(
                                          'vi-VN',
                                          {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                          }
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                      title="Download"
                                    >
                                      <Download className="size-4 text-slate-600" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="size-8"
                                      onClick={() => onDeleteFile(file.id)}
                                      title="Xóa file"
                                    >
                                      <Trash2 className="size-4 text-red-600" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}

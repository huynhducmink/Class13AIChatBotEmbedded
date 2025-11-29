import { useState } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { DocumentManager } from './components/DocumentManager';
import { Card } from './components/ui/card';
import { ScrollArea } from './components/ui/scroll-area';
import { Code2 } from 'lucide-react';

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  file?: {
    name: string;
    size: number;
    type: string;
  };
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  lastMessage: string;
  timestamp: Date;
}

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  timestamp: Date;
  conversationId: string;
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([
    {
      id: '1',
      title: 'Chat mới',
      lastMessage: 'Xin chào!',
      timestamp: new Date(),
      messages: [
        {
          id: '1',
          type: 'bot',
          content:
            'Xin chào! Tôi là AI Assistant dành cho embedded developers. Tôi có thể giúp bạn về lập trình, debugging, và các vấn đề kỹ thuật. Bạn có thể gửi tin nhắn văn bản, ghi âm giọng nói, hoặc upload file code để tôi phân tích.',
          timestamp: new Date(),
        },
      ],
    },
  ]);

  const [currentConversationId, setCurrentConversationId] = useState<string>('1');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [viewMode, setViewMode] = useState<'chat' | 'documents'>('chat');

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  const handleNewChat = () => {
    const newConversation: Conversation = {
      id: Date.now().toString(),
      title: `Chat ${conversations.length + 1}`,
      lastMessage: 'Đã tạo chat mới',
      timestamp: new Date(),
      messages: [
        {
          id: Date.now().toString(),
          type: 'bot',
          content: 'Đã tạo chat mới. Tôi có thể giúp gì cho bạn?',
          timestamp: new Date(),
        },
      ],
    };

    setConversations((prev) => [newConversation, ...prev]);
    setCurrentConversationId(newConversation.id);
  };

  const handleSelectConversation = (id: string) => {
    setCurrentConversationId(id);
    setViewMode('chat');
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    
    // If deleting current conversation, switch to another one
    if (id === currentConversationId) {
      const remaining = conversations.filter((c) => c.id !== id);
      if (remaining.length > 0) {
        setCurrentConversationId(remaining[0].id);
      } else {
        // Create a new conversation if no conversations left
        handleNewChat();
      }
    }
  };

  const handleSelectTopic = (topic: string) => {
    const topicMessages: Record<string, string> = {
      Microcontrollers:
        'Bạn muốn tìm hiểu về microcontrollers nào? Tôi có thể giúp bạn về ARM Cortex-M, AVR (Arduino), ESP32, STM32, PIC, và nhiều dòng khác. Hỏi tôi về architecture, peripherals, programming, hoặc các vấn đề cụ thể!',
      'Communication Protocols':
        'Communication protocols là nền tảng của embedded systems. Tôi có thể giúp bạn về:\n- UART/USART: Serial communication\n- I2C: Multi-device bus\n- SPI: High-speed peripheral interface\n- CAN: Automotive & industrial\n- USB, Ethernet, Modbus\n\nBạn đang gặp vấn đề với protocol nào?',
      'GPIO & Interrupts':
        'GPIO và Interrupts là cơ bản nhất của embedded programming:\n- Cấu hình GPIO (input/output, pull-up/down)\n- Interrupt handling và ISR\n- External interrupts vs internal\n- Priority và nested interrupts\n- Debouncing và noise filtering\n\nBạn cần giúp gì?',
      'Timers & PWM':
        'Timers và PWM rất quan trọng cho real-time control:\n- Hardware timers configuration\n- PWM generation cho motor control, LED dimming\n- Input capture và output compare\n- Watchdog timers\n- RTC (Real-time clock)\n\nBạn đang làm project gì?',
      'Power Management':
        'Power management quan trọng cho battery-powered devices:\n- Sleep modes (light sleep, deep sleep)\n- Clock gating và frequency scaling\n- Wake-up sources\n- Low-power peripherals\n- Power consumption optimization\n\nCần tối ưu điện năng cho project nào?',
      'RTOS & Threading':
        'RTOS giúp quản lý multi-tasking:\n- FreeRTOS basics\n- Task creation và scheduling\n- Semaphores, Mutexes, Queues\n- Inter-task communication\n- Priority inversion và deadlock\n\nBạn đang dùng RTOS nào?',
    };

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: `Tìm hiểu về ${topic}`,
      timestamp: new Date(),
    };

    const botMessage: Message = {
      id: (Date.now() + 1).toString(),
      type: 'bot',
      content: topicMessages[topic] || `Đây là thông tin về ${topic}.`,
      timestamp: new Date(),
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: [...c.messages, userMessage, botMessage],
              lastMessage: userMessage.content,
              timestamp: new Date(),
            }
          : c
      )
    );

    setViewMode('chat');
  };

  const handleDeleteFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((file) => file.id !== fileId));
  };

  const handleSendMessage = (content: string, file?: File) => {
    if (!currentConversationId) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content,
      timestamp: new Date(),
      file: file
        ? {
            name: file.name,
            size: file.size,
            type: file.type,
          }
        : undefined,
    };

    // Track uploaded files
    if (file) {
      const uploadedFile: UploadedFile = {
        id: Date.now().toString(),
        name: file.name,
        size: file.size,
        type: file.type,
        timestamp: new Date(),
        conversationId: currentConversationId,
      };
      setUploadedFiles((prev) => [uploadedFile, ...prev]);
    }

    // Update conversation with user message
    setConversations((prev) =>
      prev.map((c) =>
        c.id === currentConversationId
          ? {
              ...c,
              messages: [...c.messages, userMessage],
              lastMessage: content.substring(0, 50),
              timestamp: new Date(),
              title: c.messages.length === 1 ? content.substring(0, 30) + '...' : c.title,
            }
          : c
      )
    );

    // Simulate bot response
    setTimeout(() => {
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: getBotResponse(content, file),
        timestamp: new Date(),
      };

      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConversationId
            ? {
                ...c,
                messages: [...c.messages, botMessage],
              }
            : c
        )
      );
    }, 1000);
  };

  const getBotResponse = (userInput: string, file?: File): string => {
    if (file) {
      return `Tôi đã nhận được file "${file.name}". Trong môi trường thực tế, tôi sẽ phân tích nội dung file và cung cấp feedback về code, syntax errors, hoặc optimization suggestions.`;
    }

    const input = userInput.toLowerCase();
    if (input.includes('gpio') || input.includes('pin')) {
      return 'GPIO (General Purpose Input/Output) là interface cơ bản nhất để điều khiển hardware. Bạn cần vấn đề gì về GPIO configuration, interrupt handling, hay pull-up/pull-down resistors?';
    }
    if (input.includes('uart') || input.includes('serial')) {
      return 'UART là protocol serial communication phổ biến. Hãy đảm bảo baud rate, parity, và stop bits được cấu hình đúng ở cả hai thiết bị. Bạn đang gặp vấn đề gì với UART?';
    }
    if (input.includes('i2c') || input.includes('spi')) {
      return 'I2C và SPI là các bus communication protocol phổ biến. I2C chỉ cần 2 dây (SDA, SCL) nhưng chậm hơn SPI. SPI nhanh hơn nhưng cần nhiều pins hơn. Bạn cần giúp về protocol nào?';
    }
    if (input.includes('interrupt') || input.includes('irq')) {
      return 'Interrupts cho phép CPU phản ứng nhanh với events. Lưu ý: ISR nên ngắn gọn, tránh blocking operations, và cẩn thận với shared resources (race conditions). Bạn cần giúp gì về interrupt handling?';
    }
    if (input.includes('timer') || input.includes('pwm')) {
      return 'Timers và PWM rất quan trọng cho real-time control. PWM duty cycle và frequency quyết định điện áp output trung bình. Bạn đang làm project gì cần timers?';
    }

    return 'Tôi hiểu rồi. Đây là mock response cho câu hỏi của bạn. Trong ứng dụng thực tế, tôi sẽ được kết nối với AI backend để cung cấp câu trả lời chi tiết về embedded development, debugging, và optimization.';
  };

  if (viewMode === 'documents') {
    return (
      <DocumentManager
        files={uploadedFiles}
        onDeleteFile={handleDeleteFile}
        onBack={() => setViewMode('chat')}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Sidebar Menu */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenDocuments={() => setViewMode('documents')}
        uploadedFilesCount={uploadedFiles.length}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col p-4">
        <div className="max-w-4xl mx-auto w-full h-screen flex flex-col py-6">
          {/* Header */}
          <div className="mb-4">
            <Card className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-600 rounded-lg">
                  <Code2 className="size-6 text-white" />
                </div>
                <div>
                  <h1 className="text-slate-900 dark:text-slate-100">
                    {currentConversation?.title || 'Embedded Dev Assistant'}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    AI chatbot hỗ trợ embedded development
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Chat Messages */}
          <Card className="flex-1 mb-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-slate-200 dark:border-slate-800 overflow-hidden">
            <ScrollArea className="h-full p-4">
              <div className="space-y-4">
                {currentConversation?.messages.map((message) => (
                  <ChatMessage key={message.id} message={message} />
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat Input */}
          <ChatInput onSendMessage={handleSendMessage} />
        </div>
      </div>
    </div>
  );
}
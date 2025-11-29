import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from './components/ChatMessage';
import { ChatInput } from './components/ChatInput';
import { Sidebar } from './components/Sidebar';
import { DocumentManager } from './components/DocumentManager';
import { Card } from './components/ui/card';
import { ScrollArea } from './components/ui/scroll-area';
import { Code2 } from 'lucide-react';
import { API_ROOT } from './config';

export interface Message {
  id: string;
  type: 'user' | 'bot';
  content: string;
  loading?: boolean;
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

export default function App() {
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
  const [viewMode, setViewMode] = useState<'chat' | 'documents'>('chat');
  // track pending bot responses per conversation to avoid duplicate sends/placeholders
  const [pendingResponses, setPendingResponses] = useState<Record<string, boolean>>({});
  const pendingResponsesRef = useRef<Record<string, boolean>>({});

  const currentConversation = conversations.find(
    (c) => c.id === currentConversationId
  );

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentConversation?.messages]);

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

  const handleSendMessage = (content: string, file?: File) => {
    if (!currentConversationId) return;
  // If we're already waiting for a bot response for this conversation, ignore additional sends
  if (pendingResponsesRef.current[currentConversationId]) return;

    // Guard: prevent duplicate sends (sometimes browsers/firefox/extension may fire twice)
    const lastMsg = currentConversation?.messages[currentConversation.messages.length - 1];
    if (
      lastMsg &&
      lastMsg.type === 'user' &&
      lastMsg.content === content &&
      ((file && lastMsg.file && lastMsg.file.name === file.name) || (!file && !lastMsg.file))
    ) {
      // ignore duplicate send
      return;
    }

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

    // Call backend API to get bot response (async)
    (async () => {
      const placeholderMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'bot',
        content: '',
        loading: true,
        timestamp: new Date(),
      };

      // Add placeholder immediately so user sees a reply is coming
      setConversations((prev: Conversation[]) =>
        prev.map((c: Conversation) =>
          c.id === currentConversationId
            ? {
                ...c,
                // avoid adding duplicate placeholder if one is already last (check loading flag)
                messages:
                  c.messages.length > 0 && c.messages[c.messages.length - 1].loading === true
                    ? c.messages
                    : [...c.messages, placeholderMessage],
              }
            : c
        )
      );

  // mark pending for this conversation (ref updated immediately to avoid race)
  pendingResponsesRef.current = { ...pendingResponsesRef.current, [currentConversationId]: true };
  setPendingResponses((prev) => ({ ...prev, [currentConversationId]: true }));

      try {
        const assistantText = await getBotResponse(content);

        const botMessage: Message = {
          id: (Date.now() + 2).toString(),
          type: 'bot',
          content: assistantText,
          timestamp: new Date(),
        };

        // Replace placeholder with actual bot message
        setConversations((prev: Conversation[]) =>
          prev.map((c: Conversation) =>
            c.id === currentConversationId
              ? {
                  ...c,
                  messages: [...c.messages.slice(0, -1), botMessage],
                }
              : c
          )
        );

        // clear pending flag
        pendingResponsesRef.current = { ...pendingResponsesRef.current };
        delete pendingResponsesRef.current[currentConversationId];
        setPendingResponses((prev) => {
          const copy = { ...prev };
          delete copy[currentConversationId];
          return copy;
        });
      } catch (err: any) {
        const errorMessage: Message = {
          id: (Date.now() + 3).toString(),
          type: 'bot',
          content:
            'Xin lỗi, có lỗi xảy ra khi gọi tới server: ' + (err?.message || String(err)),
          timestamp: new Date(),
        };

        // Replace placeholder with error message
        setConversations((prev: Conversation[]) =>
          prev.map((c: Conversation) =>
            c.id === currentConversationId
              ? {
                  ...c,
                  messages: [...c.messages.slice(0, -1), errorMessage],
                }
              : c
          )
        );

        // clear pending flag on error as well
        pendingResponsesRef.current = { ...pendingResponsesRef.current };
        delete pendingResponsesRef.current[currentConversationId];
        setPendingResponses((prev) => {
          const copy = { ...prev };
          delete copy[currentConversationId];
          return copy;
        });
      }
    })();
  };

  const getBotResponse = async (userInput: string, file?: File): Promise<string> => {
  // Basic POST to backend chat endpoint. Expects response shape { assistant_response, search_results }
  const endpoint = `${API_ROOT}/api/v1/chat/chat`;
    try {
      const resp = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt: userInput }),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`Server returned ${resp.status}: ${text}`);
      }

      const data = await resp.json();

      // Normalize assistant response to a string. Backend may return structured data.
      let assistant = '';
      const raw = data?.assistant_response ?? data;

      if (typeof raw === 'string') {
        assistant = raw;
      } else if (raw && typeof raw === 'object') {
        // Try common fields
        if (typeof raw.content === 'string') {
          assistant = raw.content;
        } else if (raw.message && typeof raw.message === 'string') {
          assistant = raw.message;
        } else if (raw.choices && Array.isArray(raw.choices) && raw.choices[0]) {
          // Handle chat completion-like objects
          const choice = raw.choices[0];
          if (typeof choice.text === 'string') assistant = choice.text;
          else if (choice.message && typeof choice.message.content === 'string') assistant = choice.message.content;
          else assistant = JSON.stringify(raw, null, 2);
        } else {
          assistant = JSON.stringify(raw, null, 2);
        }
      } else if (typeof data === 'string') {
        assistant = data;
      } else {
        assistant = 'Không có phản hồi hợp lệ từ server.';
      }

      // Append search results as plain text lines (safe stringify)
      if (data && Array.isArray(data.search_results) && data.search_results.length) {
        assistant += '\n\n[Search results]:';
        assistant += '\n' + data.search_results
          .map((s: any, i: number) => {
            if (!s) return `(${i + 1}) <empty>`;
            if (typeof s === 'string') return `(${i + 1}) ${s}`;
            // prefer readable fields
            const title = s.title || s.name || s.id;
            const snippet = s.snippet || s.excerpt || s.summary;
            const id = title ? `${title}` : JSON.stringify(s);
            return `(${i + 1}) ${id}${snippet ? ` - ${snippet}` : ''}`;
          })
          .join('\n');
      }

      return assistant;
    } catch (err: any) {
      // bubble up the error to caller so it can show a message
      throw err;
    }
  };

  if (viewMode === 'documents') {
    return (
      <DocumentManager
        onBack={() => setViewMode('chat')}
      />
    );
  }

  return (
    <div className="flex min-h-screen bg-linear-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
      {/* Sidebar Menu */}
      <Sidebar
        conversations={conversations}
        currentConversationId={currentConversationId}
        onNewChat={handleNewChat}
        onSelectConversation={handleSelectConversation}
        onDeleteConversation={handleDeleteConversation}
        onOpenDocuments={() => setViewMode('documents')}
        uploadedFilesCount={0}
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
                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>
          </Card>

          {/* Chat Input */}
          <ChatInput onSendMessage={handleSendMessage} isSending={!!pendingResponses[currentConversationId]} />
        </div>
      </div>
    </div>
  );
}
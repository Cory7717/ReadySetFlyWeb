import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface Message {
  type: string;
  rentalId: string;
  senderId: string;
  content: string;
  timestamp: Date;
}

interface RentalMessagingProps {
  rentalId: string;
  userId: string;
  rentalStatus: string;
}

export function RentalMessaging({ rentalId, userId, rentalStatus }: RentalMessagingProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shouldDebug = import.meta.env.DEV;
  const wsRef = useRef<WebSocket | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Only connect if rental is active
    if (rentalStatus !== "active") {
      setError("Messaging is only available for active rentals");
      return;
    }

    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (shouldDebug) {
          console.log("WebSocket connected");
        }
        setIsConnected(true);
        setError(null);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === "error") {
            setError(message.message);
          } else if (message.type === "chat" && message.rentalId === rentalId) {
            setMessages((prev) => [...prev, message]);
            // Auto-scroll to bottom
            setTimeout(() => {
              if (scrollRef.current) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
              }
            }, 100);
          }
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setError("Connection error. Please try again.");
        setIsConnected(false);
      };

      ws.onclose = () => {
        if (shouldDebug) {
          console.log("WebSocket disconnected");
        }
        setIsConnected(false);
      };

      return () => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
    } catch (err) {
      console.error("Failed to create WebSocket:", err);
      setError("Failed to connect to messaging service");
    }
  }, [rentalId, rentalStatus]);

  const sendMessage = () => {
    if (!inputMessage.trim() || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      return;
    }

    const message = {
      type: "chat",
      rentalId,
      senderId: userId,
      content: inputMessage.trim(),
    };

    wsRef.current.send(JSON.stringify(message));
    setInputMessage("");
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (rentalStatus !== "active") {
    return (
      <Card className="rsf-metal-panel text-[#E8EDF4]">
        <CardHeader>
          <CardTitle>Messages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="py-8 text-center text-[#A9BBCD]">
            Messaging is only available during active rentals
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rsf-metal-panel text-[#E8EDF4]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle>Messages</CardTitle>
        <div className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full ${isConnected ? "bg-chart-2" : "bg-destructive"}`}
            data-testid="status-connection"
          />
          <span className="text-xs text-[#A9BBCD]">
            {isConnected ? "Connected" : "Disconnected"}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-4 rounded-lg border border-[#7d3b49]/34 bg-[linear-gradient(180deg,rgba(58,23,32,0.98),rgba(27,11,16,0.98))] p-3 text-sm text-[#f2b8c3]">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {/* Messages */}
          <ScrollArea className="h-[400px] pr-4" ref={scrollRef}>
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="py-8 text-center text-sm text-[#A9BBCD]">
                  No messages yet. Start the conversation!
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isOwnMessage = msg.senderId === userId;
                  return (
                    <div
                      key={idx}
                      className={`flex gap-3 ${isOwnMessage ? "flex-row-reverse" : ""}`}
                      data-testid={`message-${idx}`}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src="" />
                        <AvatarFallback>
                          {isOwnMessage ? "You" : "Them"}
                        </AvatarFallback>
                      </Avatar>
                      <div
                        className={`flex-1 max-w-[70%] ${isOwnMessage ? "text-right" : ""}`}
                      >
                        <div
                          className={`inline-block px-4 py-2 rounded-lg ${
                            isOwnMessage
                              ? "bg-[linear-gradient(180deg,hsl(220_76%_58%),hsl(220_70%_42%))] text-white"
                              : "bg-[linear-gradient(180deg,rgba(18,22,28,0.98),rgba(9,12,16,0.99))] text-[#E8EDF4]"
                          }`}
                        >
                          {msg.content}
                        </div>
                        <div className="mt-1 text-xs text-[#8fa6c0]">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="flex gap-2">
            <Input
              placeholder="Type a message..."
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={!isConnected}
              data-testid="input-message"
            />
            <Button
              onClick={sendMessage}
              disabled={!isConnected || !inputMessage.trim()}
              size="icon"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

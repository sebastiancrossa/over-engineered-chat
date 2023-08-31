import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { FormEvent, useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://127.0.0.1";
// const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://0.0.0.0:3001";

const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated"; // an actual channel
const NEW_MESSAGE_CHANNEL = "chat:new-message";

type Message = {
  message: string;
  id: string;
  createdAt: string;
  port: string;
  connectionId: string;
};

function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const socketIo = io(SOCKET_URL, {
      reconnection: true,
      upgrade: true,
      transports: ["websocket", "polling"],
    });

    setSocket(socketIo);

    return () => {
      socketIo.disconnect();
    };
  }, []);

  return socket;
}

export default function Home() {
  const socket = useSocket();
  const messagesRef = useRef<HTMLDivElement | null>(null);

  const [userCount, setUserCount] = useState(0);
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Array<Message>>([]);

  useEffect(() => {
    socket?.on("connect", () => {
      console.log("connected to live socket!");
    });

    socket?.on(NEW_MESSAGE_CHANNEL, (message: Message) => {
      setMessages((prevState) => [...prevState, message]);

      // hack to scroll to the true bottom bc of weird handling
      setTimeout(() => {
        scrollToBottom();
      }, 0);
    });

    socket?.on(
      CONNECTION_COUNT_UPDATED_CHANNEL,
      ({ count }: { count: number }) => {
        setUserCount(count);
      }
    );
  }, [socket]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();

    socket?.emit(NEW_MESSAGE_CHANNEL, {
      message: newMessage,
      connectionId: socket.id,
    });

    setNewMessage("");
  };

  const scrollToBottom = () => {
    if (messagesRef.current)
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight + 1000;
  };

  return (
    <main className="flex flex-col w-full p-4 max-w-3xl m-auto">
      <div className="flex justify-between items-center border-b mb-5">
        <h1 className="text-3xl font-bold mb-4 font-mono">
          overly engineered chat
        </h1>

        {socket?.active ? (
          <div className="flex items-center space-x-2">
            <div className="rounded-full w-2 h-2 bg-green-500" />
            <p>Connected ({userCount})</p>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <div className="rounded-full w-2 h-2 bg-red-500" />
            <p>Disconnected</p>
          </div>
        )}
      </div>

      <div
        className="flex-1 overflow-y-scroll overflow-x-hidden space-y-2 no-scrollbar"
        ref={messagesRef}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex flex-col items-start space-y-1 mb-4 p-4 rounded-lg break-all",
              message.connectionId === socket?.id
                ? "bg-none border-2 border-gray-100 text-right items-end"
                : "bg-gray-100"
            )}
          >
            <div className="flex items-center space-x-1">
              <span className="text-sm text-gray-400">
                {new Date(message.createdAt).toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">(:{message.port})</span>
            </div>
            <span className="text-lg">{message.message}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center space-x-3">
        <Textarea
          placeholder="Type your message here..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          maxLength={255}
          className="resize-none rounded-lg"
        />

        <Button className="h-full">Send</Button>
      </form>
    </main>
  );
}

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormEvent, useEffect, useState } from "react";
import io, { Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "ws://127.0.0.1";

const CONNECTION_COUNT_UPDATED_CHANNEL = "chat:connection-count-updated"; // an actual channel
const NEW_MESSAGE_CHANNEL = "chat:new-message";

type Message = {
  message: string;
  id: string;
  createdAt: string;
  port: string;
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
}

export default function Home() {
  const socket = useSocket();
  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Array<Message>>([]);

  useEffect(() => {
    socket?.on("connect", () => {
      console.log("connected to live socket!");
    });

    socket?.on(NEW_MESSAGE_CHANNEL, (message: Message) => {
      setMessages((prevState) => [message, ...prevState]);
    });
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    socket?.emit(NEW_MESSAGE_CHANNEL, {
      message: newMessage,
    });

    setNewMessage("");
  };

  return (
    <main className="flex flex-col w-full p-4 max-w-3xl m-auto">
      {messages.map((message) => (
        <div
          key={message.id}
          className="flex flex-col items-start space-y-1 mb-4"
        >
          <span className="text-sm text-gray-400">
            {new Date(message.createdAt).toLocaleString()}
          </span>
          <span className="text-lg">{message.message}</span>
        </div>
      ))}

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

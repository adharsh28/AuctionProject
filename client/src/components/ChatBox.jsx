import { useEffect, useRef, useState } from "react";
import socket from "../socket";
import { Send } from "lucide-react";
export default function ChatBox({ roomId, playerName, messages, setMessages, closeChat }) {
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!newMessage.trim()) return;
    const msgObj = { playerName, message: newMessage };
    socket.emit("send_message", { roomId, playerName, message: newMessage });
    setMessages((prev) => [...prev, msgObj]);
    setNewMessage("");
  };

  return (
    <div className="w-80 h-96 bg-[#0f172a] text-gray-200 rounded-2xl flex flex-col shadow-lg border border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b border-gray-700 bg-[#1e293b] flex justify-between items-center">
        <h2 className="font-semibold text-sm tracking-wide">💬 Chat Room</h2>
        {closeChat && (
          <button
            className="btn btn-xs btn-circle bg-transparent hover:bg-red-500/10 text-gray-400 hover:text-red-400"
            onClick={closeChat}
          >
            ✕
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 p-3 overflow-y-auto space-y-3 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
        {messages?.map((msg, i) => {
          const isMe = msg.playerName === playerName;
          return (
            <div
              key={i}
              className={`flex items-end ${isMe ? "justify-end" : "justify-start"} group`}
            >
              {!isMe && (
                <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center mr-2 text-sm font-bold">
                  {msg.playerName[0].toUpperCase()}
                </div>
              )}
              <div
                className={`px-3 py-2 max-w-[75%] text-sm rounded-2xl ${
                  isMe
                    ? "bg-blue-600 text-white rounded-br-none"
                    : "bg-gray-800 text-gray-200 rounded-bl-none"
                }`}
              >
                {!isMe && (
                  <div className="text-[10px] text-gray-400 mb-1 font-medium">
                    {msg.playerName}
                  </div>
                )}
                <p className="leading-snug break-words">{msg.message}</p>
              </div>
              {isMe && (
                <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center ml-2 text-sm font-bold">
                  {msg.playerName[0].toUpperCase()}
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-gray-700 bg-[#1e293b] flex items-center gap-2">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="input input-sm w-full bg-gray-800 border-none focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder-gray-500 text-gray-200"
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
        />
        <button
          className="btn btn-sm btn-primary rounded-xl flex items-center gap-1"
          onClick={sendMessage}
        >
          <Send className="h-4 w-4" />
         
        </button>
      </div>
    </div>
  );
}

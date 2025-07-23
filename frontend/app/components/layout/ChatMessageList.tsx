"use client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useEffect, useRef } from "react";
import { ChevronsUpDown } from "lucide-react";

export interface Message {
  role: "user" | "assistant";
  content: string;
  thought?: string;
}
interface ChatMessageListProps { messages: Message[]; isLoading: boolean; }
const LoadingDots = () => (<div className="flex items-center space-x-1"><span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></span><span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></span><span className="h-2 w-2 bg-slate-400 rounded-full animate-bounce"></span></div>);

export function ChatMessageList({ messages, isLoading }: ChatMessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (messages.length === 0) {
    return (<div className="flex-1 overflow-y-auto mb-6"><div className="w-full h-full flex items-center justify-center text-center"><p className="text-slate-400">Select a model and start a conversation.</p></div></div>);
  }
  return (
    <div className="flex-1 overflow-y-auto mb-6 space-y-6 pr-4">
      {messages.map((message, index) => (
        <div key={index} className={cn("flex items-start gap-4", message.role === "user" ? "justify-end" : "justify-start")}>
          {message.role === "assistant" && (<Avatar className="h-8 w-8"><AvatarFallback>AI</AvatarFallback></Avatar>)}
          <div className={cn("max-w-xl rounded-lg p-3 text-sm", message.role === "user" ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-800")}>
            {message.role === 'assistant' && message.thought && (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full justify-start p-1 h-auto mb-2 text-slate-500">
                    <ChevronsUpDown className="h-4 w-4 mr-2" />
                    Thinking...
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="prose prose-sm p-2 bg-slate-200/50 rounded-md">
                  <p className="whitespace-pre-wrap">{message.thought}</p>
                </CollapsibleContent>
              </Collapsible>
            )}
            {message.role === 'assistant' && isLoading && message.content === '' ? (<LoadingDots />) : (<p className="whitespace-pre-wrap">{message.content}</p>)}
          </div>
          {message.role === "user" && (<Avatar className="h-8 w-8"><AvatarImage src="https://placehold.co/40x40/E2E8F0/475569?text=U" alt="User Avatar" /><AvatarFallback>U</AvatarFallback></Avatar>)}
        </div>
      ))}
      <div ref={scrollRef} />
    </div>
  );
}


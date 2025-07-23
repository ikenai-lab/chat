"use client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send } from "lucide-react";
import { useState, FormEvent } from "react";
interface ChatInputProps { onSendMessage: (message: string) => void; isLoading: boolean; }
export function ChatInput({ onSendMessage, isLoading }: ChatInputProps) {
    const [inputValue, setInputValue] = useState("");
    const handleSubmit = (e: FormEvent) => { e.preventDefault(); if (inputValue.trim() && !isLoading) { onSendMessage(inputValue); setInputValue(""); } };
    return (<form onSubmit={handleSubmit} className="relative"><Textarea placeholder="Type your message here..." className="flex-1 resize-none w-full rounded-lg border border-slate-200 bg-slate-100 p-3 pr-14 text-sm text-slate-800 placeholder:text-slate-400 focus-visible:ring-1 focus-visible:ring-slate-400 focus-visible:ring-offset-0" rows={1} value={inputValue} onChange={(e) => setInputValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e); } }} disabled={isLoading} /><Button type="submit" size="icon" className="absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 bg-slate-900 hover:bg-slate-700 text-white" disabled={isLoading || !inputValue.trim()}><Send className="h-4 w-4" /><span className="sr-only">Send</span></Button></form>);
}

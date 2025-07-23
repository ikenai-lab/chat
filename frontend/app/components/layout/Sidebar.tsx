"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Bot, FileText, MessageSquare, PanelLeftClose, PanelLeftOpen, Plus, Settings, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatSession } from "@/app/page";

interface SidebarProps {
  isCollapsed: boolean;
  onCollapseToggle: () => void;
  onNewChat: () => void;
  chatSessions: ChatSession[];
  activeChatId: string | null;
  onChatSelect: (id: string) => void;
  onDeleteChat: (id: string) => void;
  onPromptsToggle: () => void;
  onModelsToggle: () => void;
}

export function Sidebar({ isCollapsed, onCollapseToggle, onNewChat, chatSessions, activeChatId, onChatSelect, onDeleteChat, onPromptsToggle, onModelsToggle }: SidebarProps) {
  const sortedSessions = [...chatSessions].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <TooltipProvider delayDuration={0}>
      <aside className={cn("flex-shrink-0 flex flex-col p-2 bg-slate-50 border-r border-slate-200 transition-all duration-300", isCollapsed ? "w-16" : "w-64")}>
        <div className="flex items-center justify-between p-2">
          {!isCollapsed && <span className="text-sm font-semibold">History</span>}
          <Button variant="ghost" size="icon" onClick={onCollapseToggle}>
            {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
        </div>
        
        <div className="mb-2 p-2">
          <Button onClick={onNewChat} className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")}>
            {isCollapsed ? <Plus className="h-4 w-4" /> : <><Plus className="mr-2 h-4 w-4" /> New Chat</>}
          </Button>
        </div>
        
        <div className="flex-grow overflow-y-auto space-y-1">
          {sortedSessions.map((session) => (
            <Tooltip key={session.id}>
              <TooltipTrigger asChild>
                <div className="relative group">
                  <Button
                    variant={activeChatId === session.id ? "secondary" : "ghost"}
                    className={cn("w-full truncate pr-8", isCollapsed ? "justify-center" : "justify-start")}
                    onClick={() => onChatSelect(session.id)}
                  >
                    <MessageSquare className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                    {!isCollapsed && <span className="truncate">{session.title}</span>}
                  </Button>
                  {!isCollapsed && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); onDeleteChat(session.id); }}
                    >
                      <Trash2 className="h-4 w-4 text-slate-500 hover:text-red-500" />
                    </Button>
                  )}
                </div>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">{session.title}</TooltipContent>}
            </Tooltip>
          ))}
        </div>

        <div className="mt-auto">
          <hr className="my-2 border-t border-slate-200" />
          <div className="space-y-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")} onClick={onModelsToggle}>
                  <Bot className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && "Models"}
                </Button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Models</TooltipContent>}
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" className={cn("w-full", isCollapsed ? "justify-center" : "justify-start")} onClick={onPromptsToggle}>
                  <FileText className={cn("h-4 w-4", !isCollapsed && "mr-2")} />
                  {!isCollapsed && "Prompts"}
                </Button>
              </TooltipTrigger>
              {isCollapsed && <TooltipContent side="right">Prompts</TooltipContent>}
            </Tooltip>
          </div>
          <hr className="my-2 border-t border-slate-200" />
          <div className="p-2 flex items-center gap-3">
            <Avatar className="h-9 w-9">
              <AvatarImage src="https://placehold.co/40x40/E2E8F0/475569?text=U" alt="User Avatar" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            {!isCollapsed && (
              <div>
                <p className="text-sm font-medium text-slate-800">Username</p>
                <p className="text-xs text-slate-500">Your Name</p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </TooltipProvider>
  );
}

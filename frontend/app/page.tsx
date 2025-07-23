"use client";

import { Sidebar } from "./components/layout/Sidebar";
import { ChatHeader } from "./components/layout/ChatHeader";
import { ChatMessageList, Message } from "./components/layout/ChatMessageList";
import { ChatInput } from "./components/layout/ChatInput";
import { ParametersSidebar } from "./components/layout/ParametersSidebar";
import { DeleteChatDialog } from "./components/layout/DeleteChatDialog";
import { DeleteModelDialog } from "./components/layout/DeleteModelDialog";
import { PromptsDialog } from "./components/layout/PromptsDialog";
import { ModelsDialog } from "./components/layout/ModelsDialog";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { useLocalStorage } from "./hooks/useLocalStorage";

export interface ChatSession {
  id: string;
  title: string;
  timestamp: number;
  system_prompt_id: number | null;
  temperature: number;
  top_p: number;
  max_tokens: number;
  repeat_penalty: number;
  n_ctx: number;
}

export interface SystemPrompt {
  id: number;
  title: string;
  content: string;
}

export default function Home() {
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useLocalStorage('isSidebarCollapsed', false);
  const [isParamsSidebarOpen, setIsParamsSidebarOpen] = useState(false);
  const [isPromptsDialogOpen, setIsPromptsDialogOpen] = useState(false);
  const [isModelsDialogOpen, setIsModelsDialogOpen] = useState(false);
  
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.95);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [repeatPenalty, setRepeatPenalty] = useState(1.1);
  const [nCtx, setNCtx] = useState(4096);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useLocalStorage<string | null>('activeChatId', null);
  const [activeMessages, setActiveMessages] = useState<Message[]>([]);
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [localModels, setLocalModels] = useState<string[]>([]);

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [chatToDelete, setChatToDelete] = useState<ChatSession | null>(null);
  const [isDeleteModelDialogOpen, setIsDeleteModelDialogOpen] = useState(false);
  const [modelToDelete, setModelToDelete] = useState<string | null>(null);

  const activeChat = sessions.find(session => session.id === activeChatId);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  
  const fetchSessions = useCallback(async (callback?: (sessions: ChatSession[]) => void) => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/sessions");
      if (!response.ok) throw new Error("Failed to fetch sessions");
      const data: ChatSession[] = await response.json();
      setSessions(data);
      if (callback) callback(data);
    } catch (error) { toast.error("Could not load chat history."); }
  }, []);

  const fetchPrompts = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/prompts");
      if (!response.ok) throw new Error("Failed to fetch prompts");
      setPrompts(await response.json());
    } catch (error) { toast.error("Could not load system prompts."); }
  }, []);
  
  const fetchLocalModels = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/models");
      if (!response.ok) throw new Error("Failed to fetch local models");
      setLocalModels(await response.json());
    } catch (error) { toast.error("Could not load local models."); }
  }, []);

  useEffect(() => {
    fetchPrompts();
    fetchLocalModels();
    fetchSessions((fetchedSessions) => {
      if (!activeChatId || !fetchedSessions.some(s => s.id === activeChatId)) {
        const lastSession = fetchedSessions[0];
        if (lastSession) {
          setActiveChatId(lastSession.id);
        } else {
          handleNewChat();
        }
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (activeChat) {
      setTemperature(activeChat.temperature);
      setTopP(activeChat.top_p);
      setMaxTokens(activeChat.max_tokens);
      setRepeatPenalty(activeChat.repeat_penalty);
      setNCtx(activeChat.n_ctx);
    }
  }, [activeChat]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        if (activeChatId) {
            fetch(`http://127.0.0.1:8000/api/v1/sessions/${activeChatId}/parameters`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ temperature, top_p: topP, max_tokens: maxTokens, repeat_penalty: repeatPenalty, n_ctx: nCtx }),
            });
            setSessions(prev => prev.map(s => s.id === activeChatId ? {...s, temperature, top_p: topP, max_tokens: maxTokens, repeat_penalty: repeatPenalty, n_ctx: nCtx} : s));
        }
    }, 500);

    return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [temperature, topP, maxTokens, repeatPenalty, nCtx, activeChatId, setSessions]);


  useEffect(() => {
    if (activeChatId) {
      const fetchMessages = async () => {
        setIsLoading(true);
        try {
          const response = await fetch(`http://127.0.0.1:8000/api/v1/sessions/${activeChatId}/messages`);
          if (!response.ok) throw new Error("Failed to fetch messages");
          setActiveMessages(await response.json());
        } catch (error) {
          toast.error(`Could not load messages for this chat.`);
          setActiveMessages([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchMessages();
    } else {
      setActiveMessages([]);
    }
  }, [activeChatId]);

  const handleNewChat = async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/sessions", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Chat" }),
      });
      if (!response.ok) throw new Error("Failed to create new chat");
      const newSession: ChatSession = await response.json();
      setSessions(prev => [newSession, ...prev]);
      setActiveChatId(newSession.id);
    } catch (error) { toast.error("Failed to create a new chat session."); }
  };

  const handleModelChange = async (modelName: string) => {
    setIsLoading(true);
    const toastId = toast.loading(`Loading model: ${modelName}...`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/models/load", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_name: modelName }),
      });
      if (!response.ok) throw new Error("Failed to load model");
      setSelectedModel(modelName);
      toast.success(`Model "${modelName}" loaded successfully!`, { id: toastId });
      if (!activeChatId) { handleNewChat(); }
    } catch (error) {
      toast.error("Failed to load model. Is the backend running?", { id: toastId });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleSendMessage = async (prompt: string) => {
    if (!selectedModel) { toast.error("Please select a model first."); return; }
    if (!activeChatId) { toast.error("Please start a new chat first."); return; }
    
    setIsLoading(true);
    const userMessage: Message = { role: "user", content: prompt };
    const shouldGenerateTitle = activeMessages.length === 0;
    
    setActiveMessages(prev => [...prev, userMessage]);
    
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/chat/stream", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: activeChatId, prompt }),
      });
      if (!response.body) throw new Error("Response body is null");

      setActiveMessages(prev => [...prev, { role: "assistant", content: "", thought: "" }]);
      
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const jsonStrings = chunk.split('\n').filter(s => s);
        for (const jsonString of jsonStrings) {
          try {
            const json = JSON.parse(jsonString);
            setActiveMessages(prev => {
                const lastMsg = prev[prev.length - 1];
                if (!lastMsg) return prev;
                let updatedLastMsg = { ...lastMsg };
                if (json.thought_token) {
                    updatedLastMsg.thought = (updatedLastMsg.thought || "") + json.thought_token;
                }
                if (json.token) {
                    updatedLastMsg.content += json.token;
                }
                return [...prev.slice(0, -1), updatedLastMsg];
            });
          } catch (e) { console.error("Failed to parse JSON chunk:", jsonString); }
        }
      }
      
      if (shouldGenerateTitle) {
        await fetch("http://127.0.0.1:8000/api/v1/generate-title", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: activeChatId }),
        });
        await fetchSessions();
      }

    } catch (error) {
      toast.error("An error occurred while communicating with the model.");
      setActiveMessages(prev => prev.filter(m => m !== userMessage));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDeleteDialog = (chatId: string) => {
    const sessionToDelete = sessions.find(s => s.id === chatId);
    if (sessionToDelete) {
      setChatToDelete(sessionToDelete);
      setIsDeleteDialogOpen(true);
    }
  };

  const handleConfirmDelete = async () => {
    if (!chatToDelete) return;
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/sessions/${chatToDelete.id}`, { method: "DELETE" });
        toast.success(`Chat "${chatToDelete.title}" deleted.`);
        
        const newSessions = sessions.filter(s => s.id !== chatToDelete.id);
        setSessions(newSessions);

        if (activeChatId === chatToDelete.id) {
            const sortedSessions = newSessions.sort((a, b) => b.timestamp - a.timestamp);
            setActiveChatId(sortedSessions.length > 0 ? sortedSessions[0].id : null);
        }
    } catch (error) {
        toast.error("Failed to delete chat.");
    } finally {
        setIsDeleteDialogOpen(false);
        setChatToDelete(null);
    }
  };

  const handleOpenDeleteModelDialog = (modelName: string) => {
    setModelToDelete(modelName);
    setIsDeleteModelDialogOpen(true);
  };

  const handleConfirmDeleteModel = async () => {
    if (!modelToDelete) return;
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/models/${modelToDelete}`, { method: "DELETE" });
        toast.success(`Model "${modelToDelete}" deleted.`);
        await fetchLocalModels();
    } catch (error) {
        toast.error("Failed to delete model.");
    } finally {
        setIsDeleteModelDialogOpen(false);
        setModelToDelete(null);
    }
  };

  const handleSavePrompt = async (prompt: Omit<SystemPrompt, 'id'> & { id?: number }) => {
    try {
        const isUpdate = prompt.id !== undefined;
        const url = isUpdate ? `http://127.0.0.1:8000/api/v1/prompts/${prompt.id}` : "http://127.0.0.1:8000/api/v1/prompts";
        const method = isUpdate ? "PUT" : "POST";

        const response = await fetch(url, {
            method, headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: prompt.title, content: prompt.content }),
        });
        if (!response.ok) throw new Error("Failed to save prompt");
        toast.success(`Prompt "${prompt.title}" saved.`);
        await fetchPrompts();
    } catch (error) {
        toast.error("Failed to save prompt.");
    }
  };

  const handleDeletePrompt = async (promptId: number) => {
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/v1/prompts/${promptId}`, { method: "DELETE" });
        if (!response.ok) throw new Error("Failed to delete prompt");
        toast.success("Prompt deleted.");
        await fetchPrompts();
    } catch (error) {
        toast.error("Failed to delete prompt.");
    }
  };

  const handleSystemPromptChange = async (promptId: number | null) => {
    if (!activeChatId) return;
    try {
        await fetch(`http://127.0.0.1:8000/api/v1/sessions/${activeChatId}/prompt`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ prompt_id: promptId }),
        });
        setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, system_prompt_id: promptId } : s));
        toast.success("System prompt updated for this chat.");
    } catch (error) {
        toast.error("Failed to update system prompt.");
    }
  };

  return (
    <>
      <div className="flex min-h-screen bg-white text-slate-600">
        <Sidebar 
          isCollapsed={isSidebarCollapsed}
          onCollapseToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onNewChat={handleNewChat}
          chatSessions={sessions}
          activeChatId={activeChatId}
          onChatSelect={setActiveChatId}
          onDeleteChat={handleOpenDeleteDialog}
          onPromptsToggle={() => setIsPromptsDialogOpen(true)}
          onModelsToggle={() => setIsModelsDialogOpen(true)}
        />
        <main className="flex-1 flex flex-col p-4 sm:p-6 md:p-8 h-screen">
          <ChatHeader 
            selectedModel={selectedModel} 
            onModelChange={handleModelChange}
            onParametersToggle={() => setIsParamsSidebarOpen(true)}
            prompts={prompts}
            activeSystemPromptId={activeChat?.system_prompt_id || null}
            onSystemPromptChange={handleSystemPromptChange}
            localModels={localModels}
          />
          <ChatMessageList messages={activeMessages} isLoading={isLoading} />
          <ChatInput onSendMessage={handleSendMessage} isLoading={isLoading} />
        </main>
        <ParametersSidebar 
          isOpen={isParamsSidebarOpen}
          onOpenChange={setIsParamsSidebarOpen}
          temperature={temperature}
          onTemperatureChange={setTemperature}
          topP={topP}
          onTopPChange={setTopP}
          maxTokens={maxTokens}
          onMaxTokensChange={setMaxTokens}
          repeatPenalty={repeatPenalty}
          onRepeatPenaltyChange={setRepeatPenalty}
          nCtx={nCtx}
          onNCtxChange={setNCtx}
        />
        <PromptsDialog
          isOpen={isPromptsDialogOpen}
          onOpenChange={setIsPromptsDialogOpen}
          prompts={prompts}
          onSavePrompt={handleSavePrompt}
          onDeletePrompt={handleDeletePrompt}
        />
        <ModelsDialog
          isOpen={isModelsDialogOpen}
          onOpenChange={setIsModelsDialogOpen}
          onDownloadComplete={fetchLocalModels}
          onDeleteModel={handleOpenDeleteModelDialog}
        />
      </div>
      <DeleteChatDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleConfirmDelete}
        chatTitle={chatToDelete?.title || ""}
      />
      <DeleteModelDialog
        isOpen={isDeleteModelDialogOpen}
        onOpenChange={setIsDeleteModelDialogOpen}
        onConfirm={handleConfirmDeleteModel}
        modelName={modelToDelete || ""}
       />
    </>
  );
}

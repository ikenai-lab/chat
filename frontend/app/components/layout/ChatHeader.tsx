"use client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Code, SlidersHorizontal } from "lucide-react";
import { SystemPrompt } from "@/app/page";

interface ChatHeaderProps {
  selectedModel: string;
  onModelChange: (modelName: string) => void;
  onParametersToggle: () => void;
  prompts: SystemPrompt[];
  activeSystemPromptId: number | null;
  onSystemPromptChange: (promptId: number | null) => void;
  localModels: string[];
}

export function ChatHeader({ selectedModel, onModelChange, onParametersToggle, prompts, activeSystemPromptId, onSystemPromptChange, localModels }: ChatHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6 h-[52px]">
      <div className="flex items-center gap-2">
        <Code className="h-8 w-8 text-slate-900" />
        <h1 className="text-xl font-semibold text-slate-900">LocalLM</h1>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-full max-w-xs">
          <Select onValueChange={onModelChange} value={selectedModel}>
            <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-700">
              <SelectValue placeholder="Select a model..." />
            </SelectTrigger>
            <SelectContent>
              {localModels.map((model) => (<SelectItem key={model} value={model}>{model}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full max-w-xs">
          <Select
            value={activeSystemPromptId?.toString() || "none"}
            onValueChange={(value) => onSystemPromptChange(value === "none" ? null : parseInt(value))}
          >
            <SelectTrigger className="bg-slate-100 border-slate-200 text-slate-700">
              <SelectValue placeholder="Apply a system prompt..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Default</SelectItem>
              {prompts.map((prompt) => (<SelectItem key={prompt.id} value={prompt.id.toString()}>{prompt.title}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="icon" onClick={onParametersToggle}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}


"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Save, Trash2 } from "lucide-react";
import { SystemPrompt } from "@/app/page";
import { useState, useEffect } from "react";

interface PromptsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  prompts: SystemPrompt[];
  onSavePrompt: (prompt: Omit<SystemPrompt, 'id'> & { id?: number }) => void;
  onDeletePrompt: (id: number) => void;
}

export function PromptsDialog({
  isOpen,
  onOpenChange,
  prompts,
  onSavePrompt,
  onDeletePrompt,
}: PromptsDialogProps) {
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    if (!isOpen) {
      handleNewPrompt();
    }
  }, [isOpen]);

  const handleSelectPrompt = (prompt: SystemPrompt) => {
    setSelectedPrompt(prompt);
    setTitle(prompt.title);
    setContent(prompt.content);
  };

  const handleNewPrompt = () => {
    setSelectedPrompt(null);
    setTitle("");
    setContent("");
  };

  const handleSave = () => {
    if (!title || !content) return;
    const promptToSave = {
      ...(selectedPrompt && { id: selectedPrompt.id }),
      title,
      content,
    };
    onSavePrompt(promptToSave);
    handleNewPrompt();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] h-[70vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>System Prompts</DialogTitle>
          <DialogDescription>
            Manage reusable system prompts to guide the AI's personality and responses.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 flex gap-6 overflow-hidden px-6 pb-6">
          {/* Prompt List */}
          <div className="w-1/3 border-r pr-6 flex flex-col">
            <Button variant="outline" size="sm" className="mb-4" onClick={handleNewPrompt}>
              <Plus className="h-4 w-4 mr-2" /> New Prompt
            </Button>
            <div className="flex-1 overflow-y-auto space-y-2 -mr-2 pr-2">
              {prompts.map((prompt) => (
                <Button
                  key={prompt.id}
                  variant={selectedPrompt?.id === prompt.id ? "secondary" : "ghost"}
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => handleSelectPrompt(prompt)}
                >
                  {prompt.title}
                </Button>
              ))}
            </div>
          </div>
          {/* Prompt Editor */}
          <div className="w-2/3 flex flex-col gap-6">
            <div className="grid gap-2">
              <Label htmlFor="prompt-title">Title</Label>
              <Input
                id="prompt-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Sarcastic Assistant"
              />
            </div>
            <div className="grid gap-2 flex-1">
              <Label htmlFor="prompt-content">Content</Label>
              <Textarea
                id="prompt-content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="You are a helpful assistant that is also very sarcastic..."
                className="h-full resize-none"
              />
            </div>
            <div className="flex justify-between items-center">
              <Button onClick={handleSave} disabled={!title || !content}>
                <Save className="h-4 w-4 mr-2" /> Save
              </Button>
              {selectedPrompt && (
                <Button
                  variant="destructive"
                  size="icon"
                  onClick={() => onDeletePrompt(selectedPrompt.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}


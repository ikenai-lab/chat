"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface ParametersSidebarProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  temperature: number;
  onTemperatureChange: (value: number) => void;
  topP: number;
  onTopPChange: (value: number) => void;
  maxTokens: number;
  onMaxTokensChange: (value: number) => void;
  repeatPenalty: number;
  onRepeatPenaltyChange: (value: number) => void;
  nCtx: number;
  onNCtxChange: (value: number) => void;
}

export function ParametersSidebar({
  isOpen,
  onOpenChange,
  temperature,
  onTemperatureChange,
  topP,
  onTopPChange,
  maxTokens,
  onMaxTokensChange,
  repeatPenalty,
  onRepeatPenaltyChange,
  nCtx,
  onNCtxChange,
}: ParametersSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent className="w-[350px] sm:w-[450px]">
        <SheetHeader>
          <SheetTitle>Chat Parameters</SheetTitle>
          <SheetDescription>
            These settings are saved per-chat and affect the model's responses.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-6 p-6">
          <div className="grid gap-3">
            <Label htmlFor="temperature">Temperature: {temperature}</Label>
            <Slider
              id="temperature"
              min={0} max={2} step={0.1}
              value={[temperature]}
              onValueChange={(value) => onTemperatureChange(value[0])}
            />
            <p className="text-xs text-slate-500">
              Controls randomness. Lower values are more deterministic.
            </p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="top-p">Top P: {topP}</Label>
            <Slider
              id="top-p"
              min={0} max={1} step={0.05}
              value={[topP]}
              onValueChange={(value) => onTopPChange(value[0])}
            />
            <p className="text-xs text-slate-500">
              Considers tokens with top_p probability mass.
            </p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="max-tokens">Max Output Tokens: {maxTokens}</Label>
            <Slider
              id="max-tokens"
              min={64} max={4096} step={64}
              value={[maxTokens]}
              onValueChange={(value) => onMaxTokensChange(value[0])}
            />
            <p className="text-xs text-slate-500">
              The maximum number of tokens to generate in the response.
            </p>
          </div>
          <div className="grid gap-3">
            <Label htmlFor="repeat-penalty">Repeat Penalty: {repeatPenalty}</Label>
            <Slider
              id="repeat-penalty"
              min={1} max={2} step={0.05}
              value={[repeatPenalty]}
              onValueChange={(value) => onRepeatPenaltyChange(value[0])}
            />
            <p className="text-xs text-slate-500">
              Penalizes the model for repeating tokens. Higher is stricter.
            </p>
          </div>
           <div className="grid gap-3">
            <Label htmlFor="n-ctx">Context Length: {nCtx}</Label>
            <Slider
              id="n-ctx"
              min={512} max={8192} step={512}
              value={[nCtx]}
              onValueChange={(value) => onNCtxChange(value[0])}
            />
            <p className="text-xs text-slate-500">
              The size of the context window the model considers.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

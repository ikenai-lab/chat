"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useEffect, useRef } from "react";
import { RefreshCw, Copy } from "lucide-react";
import * as marked from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github.css';

export interface Message {
  role: "user" | "assistant";
  content: string;
  thought?: string;
}

interface ChatMessageListProps {
  messages: Message[];
  isLoading: boolean;
  onRegenerate: () => void;
}

const LoadingDots: React.FC = () => (
  <div className="flex items-center space-x-1">
    <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
    <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
    <div className="h-2 w-2 bg-muted-foreground/60 rounded-full animate-bounce" />
  </div>
);

function setupMarkdownRenderer() {
  const renderer = new marked.Renderer();
  renderer.code = ({ text, lang }: { text: string; lang?: string }) => {
    const safeLang = lang ?? 'plaintext';
    const validLang = hljs.getLanguage(safeLang) ? safeLang : 'plaintext';
    const highlighted = hljs.highlight(text, { language: validLang }).value;

    return `
      <div class="not-prose relative group my-4 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
        <div class="flex justify-between items-center px-4 py-2 text-xs bg-slate-200 dark:bg-slate-800 font-mono">
          <span class="text-slate-800 dark:text-slate-200 font-semibold">${validLang}</span>
          <button class="copy-code-btn text-xs px-2 py-1 rounded text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700" data-code="${encodeURIComponent(text)}">Copy</button>
        </div>
        <pre class="bg-slate-50 dark:bg-slate-900 text-sm leading-relaxed overflow-x-auto m-0 p-4"><code class="hljs ${validLang}">${highlighted}</code></pre>
      </div>
    `;
  };

  renderer.table = function(token: marked.Tokens.Table) {
    const header = `<tr>${token.header.map(cell => `<th class="border border-slate-300 p-2 text-black">${this.parser.parse(cell.tokens ?? [])}</th>`).join('')}</tr>`;
    const body = token.rows.map(row => `<tr>${row.map(cell => `<td class="border border-slate-300 p-2 text-black">${this.parser.parse(cell.tokens ?? [])}</td>`).join('')}</tr>`).join('');

    return `
      <div class="not-prose relative group my-4 border border-slate-200 dark:border-slate-700 rounded-md overflow-hidden">
        <div class="flex justify-between items-center px-4 py-2 text-xs bg-slate-200 dark:bg-slate-800 font-mono">
          <span class="text-slate-800 dark:text-slate-200 font-semibold">Table</span>
          <button class="text-xs px-2 py-1 rounded text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700" data-copy-table>Copy</button>
        </div>
        <div class="overflow-x-auto p-4 bg-white">
            <table class="table-auto border-collapse text-sm w-full">
              <thead class="bg-slate-100">${header}</thead>
              <tbody class="text-black">${body}</tbody>
            </table>
        </div>
      </div>
    `;
  };

  renderer.hr = () => '';

  marked.setOptions({ renderer, gfm: true, breaks: true });
}

export function ChatMessageList({ messages, isLoading, onRegenerate }: ChatMessageListProps) {
  // --- START OF SCROLLING FIX ---

  // Ref for the scrollable container div
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  // Ref for the empty div at the bottom of the list, used as a scroll target
  const scrollRef = useRef<HTMLDivElement>(null);
  // Ref to track if the user is scrolled to the bottom.
  // We default to true so the chat scrolls down on initial load.
  const isAtBottomRef = useRef(true);

  // This effect sets up a scroll listener to update isAtBottomRef.
  // It runs only once when the component mounts.
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      // Check if the scroll position is at the bottom (with a 10px tolerance)
      const isAtBottom = container.scrollHeight - container.clientHeight <= container.scrollTop + 10;
      isAtBottomRef.current = isAtBottom;
    };

    container.addEventListener('scroll', handleScroll);

    // Cleanup the event listener on component unmount
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // This effect handles the automatic scrolling.
  // It runs every time the `messages` array is updated.
  useEffect(() => {
    // If the user was at the bottom before the new message arrived, scroll down.
    if (isAtBottomRef.current && scrollRef.current) {
      // 'auto' provides an instant scroll, which is better for chat UIs.
      scrollRef.current.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]); // Dependency on `messages` triggers this on new content

  // --- END OF SCROLLING FIX ---


  useEffect(() => {
    setupMarkdownRenderer();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (target.classList.contains("copy-code-btn")) {
        const code = decodeURIComponent(target.getAttribute("data-code") || "");
        navigator.clipboard.writeText(code);
        target.textContent = "Copied";
        setTimeout(() => {
          target.textContent = "Copy";
        }, 2000);
      }

      if (target.hasAttribute("data-copy-table")) {
        const tableContainer = target.closest(".relative.group");
        const table = tableContainer?.querySelector("table");
        if (table) {
          navigator.clipboard.writeText(table.outerHTML);
          target.textContent = "Copied";
          setTimeout(() => {
            target.textContent = "Copy";
          }, 2000);
        }
      }

      const copyChatBtn = target.closest('.copy-chat-btn');
      if (copyChatBtn && !copyChatBtn.hasAttribute('data-copied')) {
        const fullChat = copyChatBtn.closest(".group")?.querySelector(".prose")?.textContent || "";
        navigator.clipboard.writeText(fullChat);
        const originalIcon = copyChatBtn.innerHTML;
        copyChatBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
        copyChatBtn.setAttribute('data-copied', 'true');
        setTimeout(() => {
          copyChatBtn.innerHTML = originalIcon;
          copyChatBtn.removeAttribute('data-copied');
        }, 2000);
      }
    };

    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  return (
    <div className="flex-1 overflow-y-auto mb-6 pr-4" ref={scrollContainerRef}>
      <div className="max-w-4xl mx-auto">
        {messages.map((message, index) => {
          const isUser = message.role === 'user';
          const renderedHTML = isUser ? message.content : marked.parse(typeof message.content === 'string' ? message.content : '');

          return (
            <div key={index} className="py-6 group flex">
              {isUser ? (
                <div className="flex items-end gap-2 justify-end w-full">
                  <div className="bg-gray-10 bg-secondary text-secondary-foreground p-3 rounded-lg rounded-br max-w-lg">
                    <p className="leading-7 whitespace-pre-wrap">{renderedHTML}</p>
                  </div>
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src="https://placehold.co/40x40/E2E8F0/475569?text=U" alt="User Avatar" />
                    <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
                  </Avatar>
                </div>
              ) : (
                <div className="flex items-start gap-4 w-full">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-secondary text-secondary-foreground">AI</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="font-semibold text-foreground">Assistant</h3>
                    </div>

                    {message.thought && (
                      <details className="mb-4 text-xs">
                        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Thinking</summary>
                        <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700">
                          <pre className="whitespace-pre-wrap font-mono text-slate-600 dark:text-slate-300 text-xs">{message.thought}</pre>
                        </div>
                      </details>
                    )}

                    <div className="prose max-w-none dark:prose-invert break-words overflow-x-hidden">
                      <div dangerouslySetInnerHTML={{ __html: renderedHTML as string }} />
                    </div>

                    {!isLoading && index === messages.length - 1 && (
                      <>
                        <Separator className="my-4" />
                        <div className="flex justify-end items-center">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button onClick={onRegenerate} size="icon" variant="ghost" className="h-8 w-8">
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" className="copy-chat-btn h-8 w-8">
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {isLoading && messages.length > 0 && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-4 py-6">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-secondary text-secondary-foreground">AI</AvatarFallback>
            </Avatar>
            <div className="pt-2">
              <LoadingDots />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
}

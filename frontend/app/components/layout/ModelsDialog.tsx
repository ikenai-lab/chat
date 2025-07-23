"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { Download, Heart, Search, CheckCircle, Loader2, Trash2 } from "lucide-react";

interface HFModel {
  repo_id: string;
  author: string;
  downloads: number;
  likes: number;
  tags: string[];
}

interface HFFile {
    filename: string;
    size: number;
}

interface DownloadProgress {
  [key: string]: number;
}

interface ModelsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onDownloadComplete: () => void;
  onDeleteModel: (filename: string) => void;
}

export function ModelsDialog({ isOpen, onOpenChange, onDownloadComplete, onDeleteModel }: ModelsDialogProps) {
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [searchResults, setSearchResults] = useState<HFModel[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<HFModel | null>(null);
  const [repoFiles, setRepoFiles] = useState<HFFile[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress>({});
  
  const [installedSearchTerm, setInstalledSearchTerm] = useState("");
  const [onlineSearchTerm, setOnlineSearchTerm] = useState("");

  const fetchInstalledModels = useCallback(async () => {
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/models");
      if (!response.ok) throw new Error("Failed to fetch installed models");
      setInstalledModels(await response.json());
    } catch (error) {
      toast.error("Could not load installed models.");
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchInstalledModels();
    }
  }, [isOpen, fetchInstalledModels]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onlineSearchTerm) return;
    setIsSearching(true);
    setSelectedRepo(null);
    setRepoFiles([]);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/models/search?q=${onlineSearchTerm}`);
      if (!response.ok) throw new Error("Failed to search for models");
      setSearchResults(await response.json());
    } catch (error) {
      toast.error("Model search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectRepo = async (repo: HFModel) => {
    setSelectedRepo(repo);
    try {
      const response = await fetch(`http://127.0.0.1:8000/api/v1/models/files?repo_id=${repo.repo_id}`);
      if (!response.ok) throw new Error("Failed to fetch model files");
      setRepoFiles(await response.json());
    } catch (error) {
      toast.error("Could not load model files.");
    }
  };

  const handleDownload = async (repoId: string, filename: string) => {
    setDownloadProgress(prev => ({ ...prev, [filename]: 0 }));
    toast.info(`Downloading ${filename}...`);
    try {
      const response = await fetch("http://127.0.0.1:8000/api/v1/models/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ repo_id: repoId, filename }),
      });
      if (!response.body) throw new Error("Download failed");

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
            if (json.status === 'downloading') {
              setDownloadProgress(prev => ({ ...prev, [filename]: json.progress }));
            } else if (json.status === 'complete') {
              toast.success(`${filename} downloaded successfully!`);
              onDownloadComplete();
              fetchInstalledModels();
              setDownloadProgress(prev => {
                const newState = { ...prev };
                delete newState[filename];
                return newState;
              });
            } else if (json.status === 'error') {
              throw new Error(json.message);
            }
          } catch (e) { console.error("Failed to parse progress chunk:", jsonString); }
        }
      }
    } catch (error) {
      toast.error(`Failed to download ${filename}.`);
      setDownloadProgress(prev => {
        const newState = { ...prev };
        delete newState[filename];
        return newState;
      });
    }
  };

  const filteredInstalledModels = useMemo(() => 
    installedModels.filter(model => model.toLowerCase().includes(installedSearchTerm.toLowerCase())),
    [installedModels, installedSearchTerm]
  );
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1000px] h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle>Manage Models</DialogTitle>
          <DialogDescription>
            Browse, download, and manage your local models.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="installed" className="flex-1 flex flex-col overflow-hidden px-6 pb-6">
          <TabsList>
            <TabsTrigger value="installed">Installed</TabsTrigger>
            <TabsTrigger value="search">Search Online</TabsTrigger>
          </TabsList>
          <TabsContent value="installed" className="flex-1 flex flex-col overflow-y-auto mt-4">
            <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="Search installed models..." 
                className="pl-8" 
                value={installedSearchTerm}
                onChange={(e) => setInstalledSearchTerm(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Object.entries(downloadProgress).map(([filename, progress]) => (
                <Card key={filename}>
                  <CardHeader>
                    <CardTitle className="text-base truncate">{filename}</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm text-slate-500">
                    Downloading...
                  </CardContent>
                  <CardFooter>
                    <Progress value={progress} className="w-full h-2" />
                  </CardFooter>
                </Card>
              ))}
              {filteredInstalledModels.map(model => (
                <Card key={model} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base truncate">{model}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex-grow text-sm text-green-600 flex items-center gap-2">
                    <CheckCircle className="h-4 w-4" /> Installed
                  </CardContent>
                  <CardFooter>
                    <Button variant="destructive" size="sm" className="w-full" onClick={() => onDeleteModel(model)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="search" className="flex-1 flex gap-4 overflow-hidden mt-4">
            <div className="w-1/3 border-r pr-4 flex flex-col">
              <form onSubmit={handleSearch} className="relative mb-4">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="Search Hugging Face..." 
                  className="pl-8" 
                  value={onlineSearchTerm}
                  onChange={(e) => setOnlineSearchTerm(e.target.value)}
                />
              </form>
              <div className="flex-1 overflow-y-auto space-y-2">
                {isSearching ? <div className="flex items-center justify-center h-full"><Loader2 className="h-6 w-6 animate-spin" /></div> : searchResults.map(repo => (
                  <Button
                    key={repo.repo_id}
                    variant={selectedRepo?.repo_id === repo.repo_id ? "secondary" : "ghost"}
                    className="w-full justify-start text-left h-auto p-2"
                    onClick={() => handleSelectRepo(repo)}
                  >
                    <div>
                      <p className="font-semibold">{repo.repo_id}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span><Heart className="inline h-3 w-3 mr-1" />{repo.likes}</span>
                        <span><Download className="inline h-3 w-3 mr-1" />{repo.downloads}</span>
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>
            <div className="w-2/3 flex-1 flex flex-col overflow-y-auto pl-2">
              {selectedRepo ? (
                <div className="space-y-4">
                  <h3 className="font-bold">{selectedRepo.repo_id}</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedRepo.tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
                  </div>
                  <div className="space-y-2 pt-4">
                    <h4 className="font-semibold">Available Files (.gguf)</h4>
                    {repoFiles.map(file => (
                      <div key={file.filename} className="flex items-center justify-between p-2 rounded-md border">
                        <div className="truncate">
                            <span className="text-sm font-medium truncate">{file.filename}</span>
                            <p className="text-xs text-slate-500">{formatBytes(file.size)}</p>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={() => handleDownload(selectedRepo.repo_id, file.filename)}
                          disabled={!!downloadProgress[file.filename]}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Download
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-500">
                  <p>Search for a model to see available files.</p>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

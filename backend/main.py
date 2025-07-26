from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from huggingface_hub import hf_hub_download, list_models, model_info, hf_hub_url
from huggingface_hub.utils import EntryNotFoundError
import os
import json
import asyncio
from typing import List, Dict, Any, AsyncIterator, Optional
import uuid
import time
from datetime import datetime
import requests
import sys
from pathlib import Path
import database

# --- 1. Configuration ---
BASE_DIR = database.APP_DIR
if getattr(sys, 'frozen', False):
    # PyInstaller sets this when running a bundled app
    base_path = sys._MEIPASS
else:
    base_path = os.path.dirname(os.path.abspath(__file__))

# ✅ MUST be set BEFORE importing llama_cpp
# Set the environment variable to point to the *expected location within the bundle*
# This path needs to match how PyInstaller bundles it, and how llama_cpp expects it.
# We're aiming for: _MEIPASS/llama_cpp/lib/libllama.so
os.environ["LLAMA_CPP_LIB"] = os.path.join(base_path, "llama_cpp", "lib", "libllama.so")


MODELS_DIR = BASE_DIR / "models"
MODELS_DIR.mkdir(exist_ok=True)

from llama_cpp import Llama

# --- 2. Pydantic Models ---
# ... (rest of your Pydantic Models code - no changes here)
class Message(BaseModel): role: str; content: str
class ChatRequest(BaseModel): session_id: str; prompt: str
class LoadModelRequest(BaseModel): model_name: str
class DownloadModelRequest(BaseModel): repo_id: str; filename: str
class HFModelInfo(BaseModel): repo_id: str; author: Optional[str] = None; downloads: int; likes: int; last_modified: Optional[datetime] = None; tags: List[str] = []
class HFFile(BaseModel): filename: str; size: Optional[int] = None
class GenerateTitleRequest(BaseModel): session_id: str
class NewSessionRequest(BaseModel): title: str = "New Chat"
class Prompt(BaseModel): id: int; title: str; content: str
class CreatePromptRequest(BaseModel): title: str; content: str
class UpdatePromptRequest(BaseModel): title: str; content: str
class SetSessionPromptRequest(BaseModel): prompt_id: Optional[int]
class UpdateSessionParametersRequest(BaseModel): temperature: float; top_p: float; max_tokens: int; repeat_penalty: float; n_ctx: int

# --- 3. FastAPI Application Initialization ---
app = FastAPI(
    title="Local LLM Server",
    description="An API server with robust, direct streaming.",
    version="15.0.0",
)

@app.on_event("startup")
def on_startup():
    database.initialize_database()

# --- 4. CORS Middleware ---
origins = ["http://127.0.0.1:3000",
           "http://localhost:3000", 
           "tauri://localhost",    
           ]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 5. Global State ---
state = {"llm": None, "loaded_model_name": None}

# --- 6. Helper Function for Threaded Download ---
def download_worker(queue: asyncio.Queue, repo_id: str, filename: str):
    try:
        url = hf_hub_url(repo_id=repo_id, filename=filename)
        response = requests.head(url, allow_redirects=True)
        response.raise_for_status()
        total_size = int(response.headers.get('content-length', 0))

        local_path = os.path.join(MODELS_DIR, filename)
        downloaded_size = 0
        
        with requests.get(url, stream=True) as r:
            r.raise_for_status()
            with open(local_path, 'wb') as f:
                for chunk in r.iter_content(chunk_size=8192):
                    f.write(chunk)
                    downloaded_size += len(chunk)
                    progress = (downloaded_size / total_size) * 100 if total_size > 0 else 0
                    queue.put_nowait(json.dumps({"status": "downloading", "progress": progress}) + "\n")
        
        queue.put_nowait(json.dumps({"status": "complete", "progress": 100}) + "\n")
    except Exception as e:
        queue.put_nowait(json.dumps({"status": "error", "message": str(e)}) + "\n")
    finally:
        queue.put_nowait(None)

# --- 7. Helper Functions for Chat Formatting ---
def prepare_chat_messages(history: List[Dict], system_prompt: Optional[str] = None, current_user_message: str = ""):
    """
    Convert message history to the standard chat completion format.
    If there's a system prompt, prepend it to the current user message.
    """
    messages = []
    
    # Process conversation history
    for msg in history:
        # Skip the current user message from history since we'll add it separately
        if msg['role'] == 'user' and msg['content'] == current_user_message:
            continue
        messages.append({
            "role": msg['role'],
            "content": msg['content']
        })
    
    # Add the current user message with system prompt if provided
    if current_user_message:
        user_content = current_user_message
        if system_prompt:
            user_content = f"{system_prompt}\n\n{current_user_message}"
        
        messages.append({
            "role": "user", 
            "content": user_content
        })
    
    return messages

def parse_thinking_response(text: str) -> tuple[str, str]:
    """
    Parse response text to separate thinking from actual response.
    Returns (thinking, response) tuple.
    """
    # Common thinking patterns for different models
    thinking_patterns = [
        # DeepSeek pattern: <think>...</think>
        (r'<think>(.*?)</think>(.*)', 1, 2),
        # Alternative thinking pattern: <thinking>...</thinking>
        (r'<thinking>(.*?)</thinking>(.*)', 1, 2),
        # OpenAI o1 style: thinking followed by response
        (r'(.*?)\n\n(?:Response|Answer|Solution):\s*(.*)', 1, 2),
        # Chain of thought pattern: "Let me think..." followed by content
        (r'((?:Let me think|I need to think|Thinking).*?)\n\n(.*)', 1, 2),
    ]
    
    import re
    
    for pattern, thinking_group, response_group in thinking_patterns:
        match = re.search(pattern, text, re.DOTALL | re.IGNORECASE)
        if match:
            thinking = match.group(thinking_group).strip()
            response = match.group(response_group).strip()
            if thinking and response:
                return thinking, response
    
    # If no thinking pattern found, return empty thinking and full text as response
    return "", text

def fallback_to_manual_formatting(history: List[Dict], system_prompt: Optional[str] = None, current_user_message: str = ""):
    """
    Fallback method using manual prompt construction with a generic template.
    This serves as a backup if create_chat_completion fails.
    """
    full_prompt = "You are an AI Assistant. Respond to the user's message based on the conversation history. **Always use github style markdown** \n\n"
    
    # Add system prompt if provided
    if system_prompt:
        full_prompt += f"System: {system_prompt}\n\n"
    
    # Add conversation history
    for msg in history:
        if msg['role'] == 'user' and msg['content'] == current_user_message:
            continue
        full_prompt += f"{msg['role'].title()}: {msg['content']}\n"
    
    # Add current user message
    if current_user_message:
        full_prompt += f"User: {current_user_message}\nAssistant:"
    
    return full_prompt

# --- 8. API Endpoints ---

# Model Management
@app.get("/api/v1/models", response_model=List[str])
async def list_models_local():
    if not os.path.exists(MODELS_DIR): return []
    return [f for f in os.listdir(MODELS_DIR) if f.endswith(".gguf")]

@app.post("/api/v1/models/load")
async def load_model_endpoint(request: LoadModelRequest):
    model_path = os.path.join(MODELS_DIR, request.model_name)
    if not os.path.exists(model_path):
        raise HTTPException(status_code=404, detail="Model file not found.")
    try:
        state["llm"] = Llama(model_path=model_path, n_ctx=8192, n_threads=8, n_gpu_layers=0, verbose=False)
        state["loaded_model_name"] = request.model_name
        return {"message": f"Model '{request.model_name}' loaded successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model. Error: {str(e)}")

@app.post("/api/v1/models/download")
async def download_model_endpoint(request: DownloadModelRequest):
    queue = asyncio.Queue()
    loop = asyncio.get_event_loop()
    loop.run_in_executor(None, download_worker, queue, request.repo_id, request.filename)

    async def progress_streamer() -> AsyncIterator[str]:
        while True:
            item = await queue.get()
            if item is None: break
            yield item
    
    return StreamingResponse(progress_streamer(), media_type="application/x-json-stream")

@app.delete("/api/v1/models/{filename}")
async def delete_model_endpoint(filename: str):
    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename.")
    
    file_path = os.path.join(MODELS_DIR, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Model file not found.")
    
    try:
        os.remove(file_path)
        return {"message": f"Model '{filename}' deleted successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete model: {str(e)}")

@app.get("/api/v1/models/search", response_model=List[HFModelInfo])
async def search_hf_models(q: str):
    try:
        models = list_models(
            search=q, filter="gguf", sort="likes",
            direction=-1, limit=50, task="text-generation"
        )
        return [
            HFModelInfo(
                repo_id=model.id, author=model.author, downloads=model.downloads,
                likes=model.likes, last_modified=model.lastModified, tags=model.tags
            ) for model in models
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to search Hugging Face Hub: {str(e)}")

@app.get("/api/v1/models/files", response_model=List[HFFile])
async def list_hf_model_files(repo_id: str):
    try:
        info = model_info(repo_id)
        gguf_files = [HFFile(filename=f.rfilename, size=f.size) for f in info.siblings if f.rfilename.endswith(".gguf")]
        return sorted(gguf_files, key=lambda x: x.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list files for repo {repo_id}: {str(e)}")


# Session Management
@app.get("/api/v1/sessions", response_model=List[Dict[str, Any]])
async def get_all_sessions():
    return database.get_sessions()

@app.post("/api/v1/sessions", response_model=Dict[str, Any])
async def create_new_session(request: NewSessionRequest):
    session_id = str(uuid.uuid4())
    timestamp = int(time.time())
    database.add_session(session_id, request.title, timestamp)
    return database.get_session_details(session_id)

@app.delete("/api/v1/sessions/{session_id}")
async def delete_chat_session(session_id: str):
    database.delete_session(session_id)
    return {"message": f"Session {session_id} deleted successfully."}

@app.post("/api/v1/sessions/{session_id}/prompt")
async def set_session_prompt_endpoint(session_id: str, request: SetSessionPromptRequest):
    database.set_session_prompt(session_id, request.prompt_id)
    return {"message": "System prompt updated for session."}

@app.put("/api/v1/sessions/{session_id}/parameters")
async def update_session_parameters_endpoint(session_id: str, request: UpdateSessionParametersRequest):
    database.update_session_parameters(
        session_id, request.temperature, request.top_p, request.max_tokens, request.repeat_penalty, request.n_ctx
    )
    return {"message": "Session parameters updated successfully."}

# Prompt Management
@app.get("/api/v1/prompts", response_model=List[Prompt])
async def get_all_prompts():
    return database.get_prompts()

@app.post("/api/v1/prompts", response_model=Prompt)
async def create_new_prompt(request: CreatePromptRequest):
    return database.create_prompt(request.title, request.content)

@app.put("/api/v1/prompts/{prompt_id}", response_model=Prompt)
async def update_existing_prompt(prompt_id: int, request: UpdatePromptRequest):
    database.update_prompt(prompt_id, request.title, request.content)
    return {"id": prompt_id, "title": request.title, "content": request.content}

@app.delete("/api/v1/prompts/{prompt_id}")
async def delete_existing_prompt(prompt_id: int):
    database.delete_prompt(prompt_id)
    return {"message": "Prompt deleted successfully."}

# Chat
@app.get("/api/v1/sessions/{session_id}/messages", response_model=List[Message])
async def get_session_messages(session_id: str):
    return database.get_messages(session_id)

# UPDATED: Model-agnostic chat endpoint with thinking support matching frontend expectations
@app.post("/api/v1/chat/stream")
async def stream_chat_endpoint(request: ChatRequest):
    if state.get("llm") is None:
        raise HTTPException(status_code=503, detail="No model loaded.")

    database.add_message(request.session_id, "user", request.prompt)
    
    session_details = database.get_session_details(request.session_id)
    if not session_details:
        raise HTTPException(status_code=404, detail="Session not found.")

    system_prompt_id = session_details.get('system_prompt_id')
    system_prompt = None
    if system_prompt_id:
        prompt_data = database.get_prompt_by_id(system_prompt_id)
        if prompt_data:
            system_prompt = prompt_data['content']

    history = database.get_messages(request.session_id)

    async def event_generator() -> AsyncIterator[str]:
        full_response = ""
        current_buffer = ""
        in_thinking = False
        
        try:
            # First, try using create_chat_completion (model-agnostic approach)
            try:
                messages = prepare_chat_messages(history, system_prompt, request.prompt)
                
                stream = state["llm"].create_chat_completion(
                    messages=messages,
                    max_tokens=session_details.get('max_tokens', 1024),
                    temperature=session_details.get('temperature', 0.7),
                    top_p=session_details.get('top_p', 0.95),
                    repeat_penalty=session_details.get('repeat_penalty', 1.1),
                    stream=True,
                )
                
                for chunk in stream:
                    if chunk["choices"][0]["delta"].get("content"):
                        token = chunk["choices"][0]["delta"]["content"]
                        full_response += token
                        current_buffer += token
                        
                        # Check for thinking start
                        if not in_thinking and ("<think>" in current_buffer or "<thinking>" in current_buffer):
                            in_thinking = True
                            # Send the token as thinking
                            yield json.dumps({"thought_token": token}) + "\n"
                        # Check for thinking end
                        elif in_thinking and ("</think>" in current_buffer or "</thinking>" in current_buffer):
                            # Send the closing token as thinking
                            yield json.dumps({"thought_token": token}) + "\n"
                            in_thinking = False
                            current_buffer = ""  # Reset buffer after thinking ends
                        elif in_thinking:
                            # We're inside thinking tags
                            yield json.dumps({"thought_token": token}) + "\n"
                        else:
                            # We're outside thinking tags - regular response
                            yield json.dumps({"token": token}) + "\n"
                        
                        await asyncio.sleep(0.01)
                        
            except Exception as e:
                # Fallback to manual formatting if chat completion fails
                print(f"Chat completion failed, using fallback: {e}")
                full_response = ""
                current_buffer = ""
                in_thinking = False
                
                prompt = fallback_to_manual_formatting(history, system_prompt, request.prompt)
                
                stream = state["llm"](
                    prompt=prompt,
                    max_tokens=session_details.get('max_tokens', 1024),
                    temperature=session_details.get('temperature', 0.7),
                    top_p=session_details.get('top_p', 0.95),
                    repeat_penalty=session_details.get('repeat_penalty', 1.1),
                    stream=True,
                )
                
                for output in stream:
                    token = output["choices"][0]["text"]
                    if token:
                        full_response += token
                        current_buffer += token
                        
                        # Same thinking detection logic for fallback
                        if not in_thinking and ("<think>" in current_buffer or "<thinking>" in current_buffer):
                            in_thinking = True
                            yield json.dumps({"thought_token": token}) + "\n"
                        elif in_thinking and ("</think>" in current_buffer or "</thinking>" in current_buffer):
                            yield json.dumps({"thought_token": token}) + "\n"
                            in_thinking = False
                            current_buffer = ""
                        elif in_thinking:
                            yield json.dumps({"thought_token": token}) + "\n"
                        else:
                            yield json.dumps({"token": token}) + "\n"
                        
                        await asyncio.sleep(0.01)
                        
        finally:
            if full_response:
                # Parse the final response to separate thinking from content for storage
                thinking, response_content = parse_thinking_response(full_response.strip())
                
                # Store only the response content (without thinking tags)
                final_content = response_content if response_content else full_response.strip()
                
                # Clean up any remaining thinking tags from the final content
                import re
                final_content = re.sub(r'</?think>', '', final_content)
                final_content = re.sub(r'</?thinking>', '', final_content)
                final_content = final_content.strip()
                
                if final_content:
                    database.add_message(request.session_id, "assistant", final_content)

    return StreamingResponse(event_generator(), media_type="application/x-json-stream")


@app.post("/api/v1/generate-title")
async def generate_title_endpoint(request: GenerateTitleRequest):
    if state.get("llm") is None:
        raise HTTPException(status_code=503, detail="No model loaded.")
    
    messages = database.get_messages(request.session_id)
    context = "\n".join([f"{msg['role']}: {msg['content']}" for msg in messages])

    title_prompt = f"Based on this conversation, create a short, concise title (3-5 words):\n\n{context}\n\nTitle:"
    try:
        output = state["llm"](
            title_prompt, 
            max_tokens=20, 
            stop=["\n"], 
            temperature=0.2, 
            echo=False
        )
        title = output["choices"][0]["text"].strip()
        database.update_session_title(request.session_id, title)
        return {"title": title}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate title. Error: {str(e)}")
    
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
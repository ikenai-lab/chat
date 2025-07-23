import sqlite3
import json
from typing import List, Dict, Any, Optional
import sys
from pathlib import Path
from platformdirs import user_data_dir


APP_NAME = "chat"
APP_AUTHOR = "iken_ai"  # Optional; used for Windows

APP_DIR = Path(user_data_dir(APP_NAME, APP_AUTHOR))
APP_DIR.mkdir(parents=True, exist_ok=True)

DATABASE_NAME = APP_DIR / "chat_history.db"

def initialize_database():
    """Creates the database and tables if they don't exist."""
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        system_prompt_id INTEGER,
        temperature REAL DEFAULT 0.7,
        top_p REAL DEFAULT 0.95,
        max_tokens INTEGER DEFAULT 1024,
        repeat_penalty REAL DEFAULT 1.1,
        n_ctx INTEGER DEFAULT 4096,
        FOREIGN KEY (system_prompt_id) REFERENCES prompts (id) ON DELETE SET NULL
    )
    """)
    
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS prompts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

# Session Management
def add_session(session_id: str, title: str, timestamp: int):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO sessions (id, title, timestamp) VALUES (?, ?, ?)", (session_id, title, timestamp))
    conn.commit()
    conn.close()

def get_sessions() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, timestamp, system_prompt_id, temperature, top_p, max_tokens, repeat_penalty, n_ctx FROM sessions ORDER BY timestamp DESC")
    sessions = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return sessions

def get_session_details(session_id: str) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    session = cursor.fetchone()
    conn.close()
    return dict(session) if session else None

def get_messages(session_id: str) -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT role, content FROM messages WHERE session_id = ?", (session_id,))
    messages = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return messages

def add_message(session_id: str, role: str, content: str):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)", (session_id, role, content))
    cursor.execute("UPDATE sessions SET timestamp = strftime('%s', 'now') WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

def update_session_title(session_id: str, new_title: str):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET title = ? WHERE id = ?", (new_title, session_id))
    conn.commit()
    conn.close()

def delete_session(session_id: str):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
    conn.commit()
    conn.close()

def update_session_parameters(session_id: str, temperature: float, top_p: float, max_tokens: int, repeat_penalty: float, n_ctx: int):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE sessions 
        SET temperature = ?, top_p = ?, max_tokens = ?, repeat_penalty = ?, n_ctx = ?
        WHERE id = ?
    """, (temperature, top_p, max_tokens, repeat_penalty, n_ctx, session_id))
    conn.commit()
    conn.close()

# Prompt Management
def create_prompt(title: str, content: str) -> Dict[str, Any]:
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO prompts (title, content) VALUES (?, ?)", (title, content))
    prompt_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return {"id": prompt_id, "title": title, "content": content}

def get_prompts() -> List[Dict[str, Any]]:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prompts ORDER BY title")
    prompts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return prompts

def update_prompt(prompt_id: int, title: str, content: str):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE prompts SET title = ?, content = ? WHERE id = ?", (title, content, prompt_id))
    conn.commit()
    conn.close()

def delete_prompt(prompt_id: int):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM prompts WHERE id = ?", (prompt_id,))
    conn.commit()
    conn.close()

def get_prompt_by_id(prompt_id: int) -> Optional[Dict[str, Any]]:
    conn = sqlite3.connect(DATABASE_NAME)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM prompts WHERE id = ?", (prompt_id,))
    prompt = cursor.fetchone()
    conn.close()
    return dict(prompt) if prompt else None

def set_session_prompt(session_id: str, prompt_id: Optional[int]):
    conn = sqlite3.connect(DATABASE_NAME)
    cursor = conn.cursor()
    cursor.execute("UPDATE sessions SET system_prompt_id = ? WHERE id = ?", (prompt_id, session_id))
    conn.commit()
    conn.close()

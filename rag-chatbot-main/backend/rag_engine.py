"""
RAG Engine — Core pipeline for the PDF Q&A chatbot.
Refactored to use LangGraph StateGraph + LLMOps integrations.
"""

import os
import uuid
import time
import json
import PyPDF2
from io import BytesIO
from pathlib import Path

from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import StrOutputParser

load_dotenv()

# ─── Configuration ────────────────────────────────────────────────────────────
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
LLM_MODEL = os.getenv("LLM_MODEL", "llama-3.1-8b-instant")
LLM_TEMPERATURE = float(os.getenv("LLM_TEMPERATURE", "0.1"))

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "100"))
TOP_K_FINAL = int(os.getenv("TOP_K_FINAL", "5"))

# ─── Exported config dict (used by MLflow experiment tracking) ────────────────
RAG_CONFIG = {
    "embedding_model": EMBEDDING_MODEL,
    "llm_model": LLM_MODEL,
    "chunk_size": CHUNK_SIZE,
    "chunk_overlap": CHUNK_OVERLAP,
    "top_k_final": TOP_K_FINAL,
    "ensemble_weights": [0.5, 0.5],
}

# ─── Global Initializations ───────────────────────────────────────────────────
# Lazy-load embeddings so the API can start quickly in cloud environments.
embeddings_wrapper = None

# Each session stores: filename, retriever, chunks, chat_history, etc.
sessions = {}

# ─── Linear Chain (Lazy) ─────────────────────────────────────────────────────
# Lazy-load the LLM so the API can start even if GROQ_API_KEY is missing/invalid.
llm = None
generation_chain = None

ANSWER_GENERATION_PROMPT = PromptTemplate.from_template(
    "You are an expert analytical assistant. Read the provided context carefully. "
    "Answer the user's question STRICTLY based on the information provided in the context. "
    "If the information is completely missing, politely say 'I cannot find the answer in the provided document.'\n\n"
    "Recent Chat Context and if content is present use use llm knowledge to show that in proper structure:\n{history}\n"
    "Document Context:\n{context}\n\n"
    "Question: {question}"
)


def get_generation_chain():
    """Create the Groq-backed generation chain on first use."""
    global llm, generation_chain
    if generation_chain is not None:
        return generation_chain
    from langchain_groq import ChatGroq
    llm = ChatGroq(api_key=GROQ_API_KEY, model=LLM_MODEL, temperature=LLM_TEMPERATURE)
    generation_chain = ANSWER_GENERATION_PROMPT | llm | StrOutputParser()
    return generation_chain



# =============================================================================
# 1. TEXT EXTRACTION (Yields LangChain Documents)
# =============================================================================
def extract_documents_from_pdf(pdf_bytes: bytes, filename: str) -> list[Document]:
    """Extract text from PDF pages and wrap them in LangChain Documents."""
    reader = PyPDF2.PdfReader(BytesIO(pdf_bytes))
    docs = []
    for page_num, page in enumerate(reader.pages):
        page_text = page.extract_text()
        if page_text and page_text.strip():
            text = f"--- Page {page_num + 1} ---\n{page_text}"
            docs.append(Document(page_content=text, metadata={"source": filename, "page": page_num + 1}))
    return docs


# =============================================================================
# 2. CHUNKING
# =============================================================================
def chunk_documents(docs: list[Document]) -> list[Document]:
    """Split LangChain Documents using RecursiveCharacterTextSplitter."""
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=CHUNK_SIZE,
        chunk_overlap=CHUNK_OVERLAP,
        separators=["\n\n", "\n", ". ", " "]
    )
    return text_splitter.split_documents(docs)


# =============================================================================
# 3. BUILD SEARCH RETRIEVER (Ensemble Hybrid)
# =============================================================================
def build_retriever(chunks: list[Document]):
    """Build FAISS + BM25 retrievers, then wrap in EnsembleRetriever."""
    global embeddings_wrapper
    if embeddings_wrapper is None:
        from langchain_huggingface import HuggingFaceEmbeddings
        print("Loading embedding model via LangChain HuggingFaceEmbeddings...")
        embeddings_wrapper = HuggingFaceEmbeddings(model_name=EMBEDDING_MODEL)
        print("Embedding model loaded!")

    # Import retriever/vectorstore implementations lazily to speed up API startup.
    from langchain_community.vectorstores import FAISS
    from langchain_community.retrievers import BM25Retriever
    from langchain_classic.retrievers import EnsembleRetriever

    bm25_retriever = BM25Retriever.from_documents(chunks)
    bm25_retriever.k = TOP_K_FINAL

    faiss_vectorstore = FAISS.from_documents(chunks, embeddings_wrapper)
    faiss_retriever = faiss_vectorstore.as_retriever(search_kwargs={"k": TOP_K_FINAL})

    ensemble_retriever = EnsembleRetriever(
        retrievers=[bm25_retriever, faiss_retriever],
        weights=[0.5, 0.5]
    )
    return ensemble_retriever


# =============================================================================
# 4. SESSION MANAGEMENT
# =============================================================================
def create_session(pdf_bytes: bytes, filename: str) -> dict:
    """Initialize a processing session for the uploaded PDF."""
    session_id = str(uuid.uuid4())[:8]

    docs = extract_documents_from_pdf(pdf_bytes, filename)
    if not docs:
        raise ValueError("Could not extract any text from the PDF.")

    chunks = chunk_documents(docs)
    if not chunks:
        raise ValueError("Text was extracted but no meaningful chunks could be created.")

    retriever = build_retriever(chunks)

    total_pages = len(docs)
    sessions[session_id] = {
        "filename": filename,
        "chunks": chunks,
        "retriever": retriever,
        "chat_history": [],
        "created_at": time.time(),
        "total_chunks": len(chunks),
        "total_pages": total_pages,
    }

    return {
        "session_id": session_id,
        "filename": filename,
        "total_chunks": len(chunks),
        "total_pages": total_pages,
        "message": f"PDF processed via LangChain + LangGraph! Created {len(chunks)} chunks."
    }


# =============================================================================
# 5. ASK QUESTION — Linear LangChain Pipeline
# =============================================================================
def ask_question(session_id: str, question: str) -> dict:
    """Run a simple linear retrieval and generation pipeline against the active session."""
    if session_id not in sessions:
        raise ValueError(f"Session '{session_id}' not found. Please upload a PDF first.")

    session = sessions[session_id]
    retriever = session["retriever"]
    chat_history = session["chat_history"]

    # 1. Retrieve
    retrieved_docs = retriever.invoke(question)
    
    # 2. Format Context
    context = "\n\n---\n\n".join(
        f"[Chunk {i+1}] {doc.page_content}" for i, doc in enumerate(retrieved_docs)
    )

    # 3. Format History
    history_str = ""
    if chat_history:
        for entry in chat_history[-3:]:
            history_str += f"User: {entry['question']}\nAssistant: {entry['answer']}\n\n"

    # 4. Generate Answer
    try:
        chain = get_generation_chain()
        answer = chain.invoke({
            "history": history_str, 
            "context": context, 
            "question": question
        })
    except Exception as e:
        answer = f"Error generating answer: {str(e)}"

    # 5. Store in chat history
    history_entry = {
        "question": question,
        "answer": answer,
        "expanded_query": "",
        "chunks_used": len(retrieved_docs),
        "timestamp": time.time(),
        "graph_metadata": {},
        "feedback": None,
    }
    session["chat_history"].append(history_entry)

    # 6. Build UI-friendly chunk list
    ui_chunks = []
    for i, doc in enumerate(retrieved_docs):
        ui_chunks.append({
            "text": doc.page_content,
            "score": "N/A",
            "source": "EnsembleRetriever",
            "chunk_index": i
        })

    return {
        "answer": answer,
        "source_chunks": ui_chunks,
        "expanded_query": "",
        "session_id": session_id,
        "graph_metadata": {},
    }





# =============================================================================
# 7. SESSION QUERIES
# =============================================================================
def get_sessions() -> list:
    """Return dashboard list."""
    return [
        {
            "session_id": sid,
            "filename": data["filename"],
            "total_chunks": data["total_chunks"],
            "total_pages": data["total_pages"],
            "questions_asked": len(data["chat_history"]),
            "created_at": data["created_at"]
        }
        for sid, data in sessions.items()
    ]


def delete_session(session_id: str) -> bool:
    """Free memory."""
    if session_id in sessions:
        del sessions[session_id]
        return True
    return False


def get_chat_history(session_id: str) -> list:
    """Return specific history."""
    if session_id not in sessions:
        return []
    return sessions[session_id]["chat_history"]

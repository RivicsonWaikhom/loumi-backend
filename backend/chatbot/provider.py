import os
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from backend.config import CHATBOT_PROVIDER, CHATBOT_API_KEY, CHATBOT_MODEL
from backend.gemini_service import gemini_service

class ChatbotProviderError(Exception):
    """Exception raised for errors during AI chatbot provider execution."""
    pass

class BaseChatbotProvider(ABC):
    """Abstract base interface for Loumi AI agricultural chatbot providers."""

    @abstractmethod
    def is_available(self) -> bool:
        """Checks if provider has valid credentials configured."""
        pass

    @abstractmethod
    def generate_reply(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        language: str = "en",
        top_k: int = 4,
    ) -> Dict[str, Any]:
        """
        Generates an agronomic advisory reply grounded in verified documents.
        Returns a dict containing 'reply' (str) and optional 'citations' (list).
        """
        pass


class GeminiChatbotProvider(BaseChatbotProvider):
    """
    Google Gemini AI provider integrated with Loumi's Agriculture RAG retriever.
    Supports environment configuration via CHATBOT_API_KEY, CHATBOT_MODEL, or GEMINI_API_KEY.
    """

    def __init__(self, api_key: Optional[str] = None, model: Optional[str] = None):
        self.api_key = (api_key if api_key is not None else CHATBOT_API_KEY).strip()
        self.model = (model if model is not None else CHATBOT_MODEL).strip() or "gemini-3.8-flash"

    def is_available(self) -> bool:
        # Provider is available only if an API key is configured and gemini_service client is initialized
        return bool(self.api_key and gemini_service.is_available())

    def generate_reply(
        self,
        message: str,
        history: Optional[List[Dict[str, str]]] = None,
        language: str = "en",
        top_k: int = 4,
    ) -> Dict[str, Any]:
        if not self.is_available():
            raise RuntimeError(
                "AI provider is not configured. Please configure CHATBOT_API_KEY or GEMINI_API_KEY in the backend .env file."
            )

        res = gemini_service.answer_question(
            query=message,
            history=history,
            language=language,
            top_k=top_k,
        )

        # Check for provider failure reported by service
        if not res.get("api_available", False) and "error" in res:
            raise RuntimeError(f"AI provider service error: {res['error']}")

        answer_text = res.get("answer", "").strip()
        if not answer_text:
            raise RuntimeError("AI provider returned an empty response.")

        citations = res.get("citations", [])
        sources = [
            f"{c['source']} (Page {c['page']})" if isinstance(c, dict) and "source" in c and "page" in c else str(c)
            for c in citations
        ]

        return {
            "reply": answer_text,
            "citations": citations,
            "sources": sources,
            "provider": "gemini",
            "model": self.model,
        }


# Modular provider registry & singleton management
_active_provider: Optional[BaseChatbotProvider] = None

def get_chatbot_provider() -> BaseChatbotProvider:
    global _active_provider
    if _active_provider is None:
        provider_name = (CHATBOT_PROVIDER or "gemini").lower()
        if provider_name == "gemini":
            _active_provider = GeminiChatbotProvider()
        else:
            # Extension point: easily add other providers here (e.g., anthropic, openai, local_llm)
            _active_provider = GeminiChatbotProvider()
    return _active_provider

def set_chatbot_provider_for_testing(provider: Optional[BaseChatbotProvider]):
    """Testing hook to inject mock providers without contacting external APIs."""
    global _active_provider
    _active_provider = provider

"""Single-function Azure OpenAI wrapper. Mirrors brede-welvaart's auth (DefaultAzureCredential + Cognitive Services token), stripped to one function."""

import os

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI

_client: AzureOpenAI | None = None


def _get_client() -> AzureOpenAI:
    global _client
    if _client is None:
        token_provider = get_bearer_token_provider(
            DefaultAzureCredential(),
            "https://cognitiveservices.azure.com/.default",
        )
        _client = AzureOpenAI(
            azure_endpoint=os.environ["FOUNDRY_ENDPOINT"],
            azure_ad_token_provider=token_provider,
            api_version=os.environ["FOUNDRY_API_VERSION"],
        )
    return _client


def generate(system: str, user: str, max_tokens: int = 500, force_json: bool = False) -> str:
    deployment = os.environ.get("LLM_DEPLOYMENT", "gpt-4o-mini")
    kwargs = {"response_format": {"type": "json_object"}} if force_json else {}
    response = _get_client().chat.completions.create(
        model=deployment,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        max_tokens=max_tokens,
        **kwargs,
    )
    return response.choices[0].message.content or ""

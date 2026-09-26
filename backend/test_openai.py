import asyncio
from app.services.llm_orchestrator import LLMOrchestrator
from app.config import settings

async def run_openai_suite():
    print("=== DataNova OpenAI Integration Test Suite ===")
    
    # 1. Test model family identification
    assert LLMOrchestrator._is_openai_reasoning_model("o3-mini") is True
    assert LLMOrchestrator._is_openai_reasoning_model("o1") is True
    assert LLMOrchestrator._is_openai_reasoning_model("o1-mini") is True
    assert LLMOrchestrator._is_openai_reasoning_model("gpt-4o") is False
    assert LLMOrchestrator._is_openai_reasoning_model("gpt-4o-mini") is False
    print("[PASS] Model classification verified (o1, o3-mini, gpt-4o).")

    # 2. Test JSON extraction and sanitization
    sample_fenced = '```json\n{"status": "ok", "metric": 42}\n```'
    cleaned = LLMOrchestrator._clean_llm_json(sample_fenced)
    assert cleaned == '{"status": "ok", "metric": 42}', f"Got {cleaned}"
    print("[PASS] Markdown JSON fence stripping verified.")

    # 3. Test payload construction for reasoning vs standard models
    o3_payload = LLMOrchestrator._build_openai_payload(
        model_name="o3-mini",
        system_prompt="System Prompt",
        user_prompt="User Prompt",
        response_format_json=True,
        stream=False
    )
    assert "temperature" not in o3_payload, "Reasoning models must NOT include temperature"
    assert o3_payload["max_completion_tokens"] == 4096
    assert o3_payload["response_format"] == {"type": "json_object"}
    assert o3_payload["messages"][0]["role"] == "developer"
    print("[PASS] Reasoning model payload builder verified (o3-mini temperature safety).")

    standard_payload = LLMOrchestrator._build_openai_payload(
        model_name="gpt-4o",
        system_prompt="System Prompt",
        user_prompt="User Prompt",
        response_format_json=True,
        stream=True
    )
    assert standard_payload["temperature"] == 0.2
    assert standard_payload["stream"] is True
    assert standard_payload["messages"][0]["role"] == "system"
    print("[PASS] Standard model payload builder verified (gpt-4o streaming).")

    # 4. Test provider diagnostic connection probe
    diag = await LLMOrchestrator.test_provider_connection(
        provider="openai",
        api_key="sk-test-mock-key-for-diagnostic-check",
        model="gpt-4o"
    )
    print("[PASS] Diagnostic probe execution test:", diag.get("status"), str(diag.get("message"))[:60])

    print("\nAll OpenAI subsystem unit tests PASSED successfully!")

if __name__ == "__main__":
    asyncio.run(run_openai_suite())

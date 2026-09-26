import asyncio
from app.services.llm_orchestrator import LLMOrchestrator

async def run_live_gemini_test():
    print("Provider:", LLMOrchestrator.get_active_provider())

    print("\n1. Testing query_llm text:")
    text_res = await LLMOrchestrator.query_llm(
        "You are a financial analyst", 
        "Explain CAGR in 1 short sentence."
    )
    print("Text Result:", text_res.strip())

    print("\n2. Testing query_llm JSON:")
    json_res = await LLMOrchestrator.query_llm(
        "You are an analyst", 
        'Return JSON: {"topic": "CAGR", "healthy_rate": 0.15}', 
        response_format_json=True
    )
    print("JSON Result:", json_res.strip())

    print("\n3. Testing stream_query_llm:")
    tokens = []
    async for chunk in LLMOrchestrator.stream_query_llm(
        "You are a coach", 
        "Name 3 steps to clean data."
    ):
        tokens.append(chunk)
    print("Streamed full text:", "".join(tokens).strip())

if __name__ == "__main__":
    asyncio.run(run_live_gemini_test())

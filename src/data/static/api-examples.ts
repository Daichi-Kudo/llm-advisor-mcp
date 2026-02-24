export interface ApiExample {
  template: string;
  language: string;
}

const EXAMPLES: Record<string, ApiExample> = {
  openai_sdk: {
    template: `from openai import OpenAI
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key="YOUR_OPENROUTER_KEY",
)
response = client.chat.completions.create(
    model="{{MODEL_ID}}",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=1024,
)
print(response.choices[0].message.content)`,
    language: "python",
  },
  curl: {
    template: `curl https://openrouter.ai/api/v1/chat/completions \\
  -H "Authorization: Bearer YOUR_OPENROUTER_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model": "{{MODEL_ID}}", "messages": [{"role": "user", "content": "Hello!"}]}'`,
    language: "bash",
  },
  python_requests: {
    template: `import requests
response = requests.post(
    "https://openrouter.ai/api/v1/chat/completions",
    headers={"Authorization": "Bearer YOUR_OPENROUTER_KEY"},
    json={"model": "{{MODEL_ID}}", "messages": [{"role": "user", "content": "Hello!"}]},
)
print(response.json()["choices"][0]["message"]["content"])`,
    language: "python",
  },
};

export function getApiExample(
  format: string,
  modelId: string
): { code: string; language: string } | null {
  const example = EXAMPLES[format];
  if (!example) return null;
  return {
    code: example.template.replace(/\{\{MODEL_ID\}\}/g, modelId),
    language: example.language,
  };
}

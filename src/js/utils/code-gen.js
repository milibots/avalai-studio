// Code snippet generation for AvalAI endpoints

export function generateChatCode({ model, messages, temperature = 0.7, maxTokens = 2048, stream = true, apiKey = 'YOUR_AVALAI_KEY' }) {
  const jsonMessages = JSON.stringify(messages, null, 2);

  const python = `import os
from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="https://api.avalai.ir/v1",
)

response = client.chat.completions.create(
    model="${model}",
    messages=${jsonMessages},
    temperature=${temperature},
    max_tokens=${maxTokens},
    stream=${stream ? 'True' : 'False'}
)

if ${stream ? 'True' : 'False'}:
    for chunk in response:
        if chunk.choices and chunk.choices[0].delta.content:
            print(chunk.choices[0].delta.content, end="", flush=True)
else:
    print(response.choices[0].message.content)
`;

  const javascript = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "https://api.avalai.ir/v1",
});

const response = await client.chat.completions.create({
  model: "${model}",
  messages: ${jsonMessages},
  temperature: ${temperature},
  max_tokens: ${maxTokens},
  stream: ${stream ? 'true' : 'false'},
});

${stream ? `for await (const chunk of response) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "");
}` : `console.log(response.choices[0].message.content);`}
`;

  const curl = `curl https://api.avalai.ir/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${model}",
    "messages": ${JSON.stringify(messages)},
    "temperature": ${temperature},
    "max_tokens": ${maxTokens},
    "stream": ${stream ? 'true' : 'false'}
  }'`;

  return { python, javascript, curl };
}

export function generateResponsesCode({ model, input, instructions = '', apiKey = 'YOUR_AVALAI_KEY' }) {
  const python = `import os
from openai import OpenAI

client = OpenAI(
    api_key="${apiKey}",
    base_url="https://api.avalai.ir/v1",
)

response = client.responses.create(
    model="${model}",
    instructions="${instructions.replace(/"/g, '\\"')}",
    input="${input.replace(/"/g, '\\"')}",
)

print(response.output_text)
`;

  const javascript = `import OpenAI from "openai";

const client = new OpenAI({
  apiKey: "${apiKey}",
  baseURL: "https://api.avalai.ir/v1",
});

const response = await client.responses.create({
  model: "${model}",
  instructions: "${instructions.replace(/"/g, '\\"')}",
  input: "${input.replace(/"/g, '\\"')}",
});

console.log(response.output_text);
`;

  const curl = `curl https://api.avalai.ir/v1/responses \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${apiKey}" \\
  -d '{
    "model": "${model}",
    "instructions": "${instructions.replace(/"/g, '\\"')}",
    "input": "${input.replace(/"/g, '\\"')}"
  }'`;

  return { python, javascript, curl };
}

// Social-feed OpenRouter fallback models sourced from https://openrouter.ai/api/v1/models.
// Last synced 2026-05-21. Ordered by context length descending.
// EXCLUDED MODELS:
// - 'openrouter/owl-alpha': Fails with 400 "Provider returned error" or returns empty content (internal/unreliable).
// - 'google/lyria-3-pro-preview' & 'google/lyria-3-clip-preview': Require credits (402 Insufficient credits) and represent audio/video features.
// - 'openrouter/free': Meta-router which can fail or return unexpected, unparsable formats.
// - 'poolside/laguna-xs.2:free' & 'poolside/laguna-m.1:free': Specialized core coding models.
// - 'nvidia/nemotron-3-super-120b-a12b:free': Frequently ignores JSON-only output and returns planning prose.
// - 'nvidia/nemotron-nano-12b-v2-vl:free': Vision-language route is unstable here and often returns provider 502.
// - 'deepseek/deepseek-v4-flash:free': Frequently returns provider 402 insufficient_quota on the free route.
const FREE_MODELS = [
  'qwen/qwen3-coder:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'google/gemma-4-26b-a4b-it:free',
  'google/gemma-4-31b-it:free',
  'nvidia/nemotron-nano-9b-v2:free',
  
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
  'nousresearch/hermes-3-llama-3.1-405b:free',
  'minimax/minimax-m2.5:free',
  'openai/gpt-oss-120b:free',
  'openai/gpt-oss-20b:free',
  'z-ai/glm-4.5-air:free',
  'liquid/lfm-2.5-1.2b-thinking:free',
  'liquid/lfm-2.5-1.2b-instruct:free',
  'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
  'baidu/cobuddy:free',
];

// WARNING: PAID models — only used when ALLOW_PAID_FALLBACK=true.
const PAID_FALLBACK_MODELS = [
  'google/gemini-1.5-flash',
  'openai/gpt-4o-mini',
  'google/gemini-1.5-pro',
];

const FALLBACK_MODELS = process.env.ALLOW_PAID_FALLBACK === 'true'
  ? [...FREE_MODELS, ...PAID_FALLBACK_MODELS]
  : FREE_MODELS;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const looksLikeStructuredOutput = (text: string) => /[\[{]/.test(text);

const tryParseJSON = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const getNestedValue = (obj: any, path: string): any => {
  if (!path) return undefined;
  const segments = path.split(/\.|\[|\]/).filter(Boolean);
  let current = obj;
  for (const segment of segments) {
    if (current == null) return undefined;
    const index = parseInt(segment, 10);
    if (!isNaN(index)) {
      current = current[index];
    } else {
      current = current[segment];
    }
  }
  return current;
};

const getProviderErrorMetadata = (status: number, rawText: string) => {
  const parsed = tryParseJSON(rawText);
  const outerError = parsed?.error ?? null;
  const nestedRaw = typeof outerError?.metadata?.raw === 'string'
    ? tryParseJSON(outerError.metadata.raw)?.error ?? null
    : null;

  const message = String(
    nestedRaw?.message ?? outerError?.message ?? rawText,
  ).replace(/\s+/g, ' ').trim();
  const code = String(nestedRaw?.code ?? outerError?.code ?? status);
  const type = String(nestedRaw?.type ?? outerError?.type ?? '');

  return { message, code, type };
};

const isQuotaLimitedProviderError = (status: number, rawText: string) => {
  const { message, code, type } = getProviderErrorMetadata(status, rawText);
  const fingerprint = `${code} ${type} ${message}`.toLowerCase();

  return (
    status === 402 ||
    fingerprint.includes('insufficient_quota') ||
    fingerprint.includes('insufficient credits') ||
    fingerprint.includes('out of credits') ||
    fingerprint.includes('out of quota') ||
    fingerprint.includes('quota exceeded')
  );
};

const compactProviderError = (status: number, rawText: string) => {
  if (status >= 500) {
    return `Provider temporary failure (${status})`;
  }

  if (isQuotaLimitedProviderError(status, rawText)) {
    return 'Provider quota exhausted';
  }

  const { message, code } = getProviderErrorMetadata(status, rawText);
  const normalized =
    message.toLowerCase() === 'provider returned error'
      ? `Provider returned error (${code})`
      : message;

  return normalized.length > 180 ? `${normalized.slice(0, 177)}...` : normalized;
};

export async function fetchOpenRouterWithFallback(
  apiKey: string,
  prompt: string,
  validator?: (text: string) => string,
  requestedModel?: string,
  apiEndpoint?: string,
  protocol: string = "openrouter",
  customBodyTemplate?: string,
  customResponsePath?: string,
  routingPolicy: string = "auto",
  /** Pass the system instruction as a separate string so prompt caching never
   *  needs to rely on heuristic string splitting. When provided, `prompt`
   *  is treated as the user-turn only. */
  explicitSystemPrompt?: string
) {
  let lastError: Error | null = null;

  // Cost-Aware Pipeline Implementation based on routingPolicy
  let targetFallbackModels = FALLBACK_MODELS;
  
  if (routingPolicy === 'haiku') {
    targetFallbackModels = FREE_MODELS;
  } else if (routingPolicy === 'sonnet') {
    targetFallbackModels = PAID_FALLBACK_MODELS;
  } else if (routingPolicy === 'auto') {
    const isComplex = prompt.length >= 10000;
    if (isComplex) {
      targetFallbackModels = [...PAID_FALLBACK_MODELS, ...FREE_MODELS];
    } else {
      targetFallbackModels = [...FREE_MODELS, ...PAID_FALLBACK_MODELS];
    }
  }

  const modelsToTry = requestedModel ? [requestedModel, ...targetFallbackModels] : targetFallbackModels;


  // ---------------------------------------------------------------------------
  // Build messages payload — robust split that never mis-fires on user content
  // ---------------------------------------------------------------------------
  // Priority 1: caller supplied an explicit systemPrompt (zero ambiguity)
  // Priority 2: legacy single-string format "System: ... User: ..."
  //             → only split on the FIRST occurrence of each sentinel so that
  //               user content containing "User:" or "System:" is harmless.
  // Priority 3: treat entire string as a single user message.
  let messagesPayload: any[] = [];

  let resolvedSystem = "";
  let resolvedUser = prompt;

  if (explicitSystemPrompt) {
    // Caller explicitly separated concerns — safest path.
    resolvedSystem = explicitSystemPrompt.trim();
    resolvedUser = prompt.trim();
  } else {
    // Legacy heuristic: split only on the FIRST "System:" and FIRST "User:"
    // anchored at the very start of those tokens (case-sensitive, trimmed).
    const sysToken = "System:";
    const userToken = "\nUser:";
    const sysIdx = prompt.indexOf(sysToken);
    const userIdx = prompt.indexOf(userToken, sysIdx !== -1 ? sysIdx + sysToken.length : 0);

    if (sysIdx !== -1 && userIdx !== -1) {
      resolvedSystem = prompt.substring(sysIdx + sysToken.length, userIdx).trim();
      resolvedUser = prompt.substring(userIdx + userToken.length).trim();
    } else if (sysIdx !== -1) {
      // Only System: marker found, no User: — treat remainder as system only.
      resolvedSystem = prompt.substring(sysIdx + sysToken.length).trim();
      resolvedUser = "";
    }
    // If neither marker found, resolvedSystem stays "" and resolvedUser = prompt
  }

  if (resolvedSystem) {
    messagesPayload = [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: resolvedSystem,
            cache_control: { type: "ephemeral" } // Prompt caching trigger
          }
        ]
      },
      {
        role: "user",
        content: resolvedUser
      }
    ];
  } else {
    messagesPayload = [{ role: "user", content: resolvedUser || prompt }];
  }

  for (const model of modelsToTry) {
    let rateLimitedCount = 0;
    const maxRetries = 1;

    // Narrow Retry Loop with Exponential Backoff
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        let fetchUrl = 'https://openrouter.ai/api/v1/chat/completions';
        let isCustomEndpoint = false;
        let isOllamaDirectGenerate = false;
        let isOllamaDirectChat = false;

        if (apiEndpoint && !apiEndpoint.includes('openrouter.ai')) {
          isCustomEndpoint = true;
          const trimmedEndpoint = apiEndpoint.trim().replace(/\/$/, '');
          
          if (trimmedEndpoint.includes('/api/generate')) {
            fetchUrl = trimmedEndpoint;
            isOllamaDirectGenerate = true;
          } else if (trimmedEndpoint.includes('/api/chat')) {
            fetchUrl = trimmedEndpoint;
            isOllamaDirectChat = true;
          } else if (trimmedEndpoint.includes('/chat/completions') || trimmedEndpoint.includes('/v1/chat/completions')) {
            fetchUrl = trimmedEndpoint;
          } else {
            // Check if endpoint is likely Ollama base port
            if (trimmedEndpoint.includes('11434') || trimmedEndpoint.includes('ollama')) {
              fetchUrl = `${trimmedEndpoint}/api/chat`;
              isOllamaDirectChat = true;
            } else {
              fetchUrl = `${trimmedEndpoint}/chat/completions`;
            }
          }
        }

        let systemPrompt = resolvedSystem;
        let userPrompt = resolvedUser || prompt;

        const headers: { [key: string]: string } = {
          'Content-Type': 'application/json'
        };

        let bodyPayload: any;

        if (protocol === 'custom' && customBodyTemplate) {
          const messages = messagesPayload.map(m => ({
            role: m.role,
            content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || m.content?.[0] || "")
          }));

          let templateStr = customBodyTemplate;
          templateStr = templateStr.replace(/\$\{model\}/g, JSON.stringify(model));
          templateStr = templateStr.replace(/\$\{prompt\}/g, JSON.stringify(prompt));
          templateStr = templateStr.replace(/\$\{userPrompt\}/g, JSON.stringify(userPrompt));
          templateStr = templateStr.replace(/\$\{systemPrompt\}/g, JSON.stringify(systemPrompt));
          templateStr = templateStr.replace(/\$\{messages\}/g, JSON.stringify(messages));

          try {
            bodyPayload = JSON.parse(templateStr);
          } catch (e: any) {
            throw new Error(`Failed to parse custom JSON body template: ${e.message}. Template: ${templateStr}`);
          }
          
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
        } else if (protocol === 'anthropic') {
          if (apiKey) headers['x-api-key'] = apiKey;
          headers['anthropic-version'] = '2023-06-01';
          if (!isCustomEndpoint) {
             fetchUrl = 'https://api.anthropic.com/v1/messages';
          }

          bodyPayload = {
            model: model.replace('anthropic/', ''), 
            max_tokens: 4000,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }]
          };
        } else if (protocol === 'gemini') {
          if (!isCustomEndpoint && apiKey) {
            fetchUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model.replace('google/', '')}:generateContent?key=${apiKey}`;
          } else if (isCustomEndpoint && apiKey && !fetchUrl.includes('?key=')) {
            fetchUrl += `?key=${apiKey}`;
          }

          bodyPayload = {
            system_instruction: { parts: { text: systemPrompt } },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: { maxOutputTokens: 4000 }
          };
        } else {
          // Default: openai / openrouter / ollama
          if (apiKey) {
            headers['Authorization'] = `Bearer ${apiKey}`;
          }
          if (!isCustomEndpoint) {
            headers['HTTP-Referer'] = 'https://roamjelly.app';
            headers['X-Title'] = 'RoamJelly';
          }

          if (protocol === 'ollama' || isOllamaDirectGenerate) {
            if (fetchUrl.includes('/api/generate')) {
              bodyPayload = { model, prompt: prompt, stream: false };
            } else {
              bodyPayload = {
                model,
                messages: messagesPayload.map(m => ({
                  role: m.role,
                  content: typeof m.content === 'string' ? m.content : (m.content?.[0]?.text || m.content?.[0] || "")
                })),
                stream: false
              };
            }
          } else {
            bodyPayload = {
              model,
              messages: messagesPayload,
              max_tokens: 4000
            };
          }
        }

        const response = await fetch(fetchUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(bodyPayload)
        });

        // Fail fast on Auth failures (no retries)
        if (response.status === 401 || response.status === 403) {
          throw new Error(`API key invalid or forbidden (${response.status}). Stopping retries.`);
        }

        // Narrow Retry: Transient Rate Limits (429) -> Wait and retry
        if (response.status === 429) {
          console.warn(`Rate limited on model ${model} (attempt ${attempt + 1}/${maxRetries}), waiting...`);
          await sleep(Math.pow(2, attempt) * 1000 + 500); // Exponential backoff
          lastError = new Error(`429 rate limited on ${model}`);
          continue;
        }

        // Fail fast or try next model on Model Not Found (404)
        if (response.status === 404) {
          console.warn(`Model ${model} not found (404), skipping to next fallback...`);
          break; // Try next model in fallback list
        }

        if (!response.ok) {
          const errText = await response.text().catch(() => '');

          // Narrow Retry: Quota exhaustion -> Try next model
          if (isQuotaLimitedProviderError(response.status, errText)) {
            console.warn(`Model ${model} exhausted provider quota, skipping to next fallback...`);
            lastError = new Error(`402 insufficient quota on ${model}`);
            break; // Try next model
          }

          // Transient errors (502, 503, 504) -> Wait and retry
          if (response.status >= 500 && response.status <= 504) {
            console.warn(`Server temporary error ${response.status} on model ${model}, retrying...`);
            await sleep(Math.pow(2, attempt) * 1000); // Exponential backoff
            lastError = new Error(`Temporary ${response.status} server error on ${model}`);
            continue;
          }

          throw new Error(`API Error (${model}) on ${fetchUrl}: ${compactProviderError(response.status, errText)}`);
        }

        const data = await response.json();
        
        // Dynamic response payload adapter depending on protocol and model shapes
        let text = "";
        let usage = { prompt_tokens: 0, completion_tokens: 0 };

        if (protocol === 'custom' && customResponsePath) {
          const extracted = getNestedValue(data, customResponsePath);
          if (extracted !== undefined) {
            text = typeof extracted === 'string' ? extracted : JSON.stringify(extracted);
          } else {
            text = data.choices?.[0]?.message?.content || data.response || (typeof data === 'string' ? data : JSON.stringify(data));
          }
          usage = data.usage || {
            prompt_tokens: data.prompt_eval_count || 0,
            completion_tokens: data.eval_count || 0
          };
        } else if (protocol === 'anthropic' && data.content && Array.isArray(data.content)) {
          text = data.content.map((c: any) => c.text).join("");
          usage = {
            prompt_tokens: data.usage?.input_tokens || 0,
            completion_tokens: data.usage?.output_tokens || 0
          };
        } else if (protocol === 'gemini' && data.candidates && data.candidates.length > 0) {
          text = data.candidates[0].content?.parts?.map((p: any) => p.text).join("") || "";
          usage = {
            prompt_tokens: data.usageMetadata?.promptTokenCount || 0,
            completion_tokens: data.usageMetadata?.candidatesTokenCount || 0
          };
        } else if (data.choices?.[0]?.message?.content !== undefined) {
          text = data.choices[0].message.content;
          usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
        } else if (data.message?.content !== undefined) {
          text = data.message.content;
          usage = {
            prompt_tokens: data.prompt_eval_count || 0,
            completion_tokens: data.eval_count || 0
          };
        } else if (data.response !== undefined) {
          text = data.response;
          usage = {
            prompt_tokens: data.prompt_eval_count || 0,
            completion_tokens: data.eval_count || 0
          };
        } else {
          // General fallback
          text = typeof data === 'string' ? data : JSON.stringify(data);
        }

        if (text) {
          if (validator) {
            try {
              const result = validator(text);
              console.log(`Successfully generated and validated content using model: ${model}`);
              return {
                text: result,
                model: data.model || model,
                usage
              };
            } catch (e: any) {
              try {
                const repairedObj = parseAndRepairJSON(text);
                const revalidated = validator(JSON.stringify(repairedObj));
                console.log(`Successfully repaired and validated content using model: ${model}`);
                return {
                  text: revalidated,
                  model: data.model || model,
                  usage
                };
              } catch (repairErr: any) {
                throw new Error(
                  looksLikeStructuredOutput(text)
                    ? 'Model returned unusable structured output'
                    : 'Model ignored JSON-only response requirement'
                );
              }
            }
          }
          console.log(`Successfully generated content using model: ${model}`);
          return {
            text,
            model: data.model || model,
            usage
          };
        } else {
          throw new Error(`Model ${model} returned empty content`);
        }
      } catch (err: any) {
        if (err.message?.includes('Stopping retries')) throw err;
        console.warn(`Attempt failed with model ${model}, trying fallback options...`, err.message);
        lastError = err;
        break; // Try next model in fallback array
      }
    }
  }

  throw lastError || new Error('All fallback models failed.');
}

/**
 * Robustly parses and repairs malformed, truncated, or unescaped JSON text 
 * generated by LLMs (especially free tier models).
 */
export function parseAndRepairJSON(text: string): any {
  let clean = text.trim();
  
  // Try direct parse first
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Treat error as trigger to run repair
  }

  // Strip markdown code block wrapper if present
  if (clean.startsWith('```json')) {
    clean = clean.substring(7);
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3);
  }
  clean = clean.trim();

  // Extract from the first '{' to the last '}'
  const start = clean.indexOf('{');
  const end = clean.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.substring(start, end + 1);
  } else {
    // If no curly braces, try arrays
    const startArr = clean.indexOf('[');
    const endArr = clean.lastIndexOf(']');
    if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
      clean = clean.substring(startArr, endArr + 1);
    }
  }

  // Try parsing the extracted block
  try {
    return JSON.parse(clean);
  } catch (e) {
    // Proceed to robust character-by-character scan
  }

  let repaired = "";
  let inString = false;
  let escapeNext = false;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];

    if (escapeNext) {
      repaired += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      repaired += char;
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      if (inString) {
        // Look ahead to check if this is an authentic closing quote
        let nextChar = '';
        for (let j = i + 1; j < clean.length; j++) {
          if (!/\s/.test(clean[j])) {
            nextChar = clean[j];
            break;
          }
        }
        const isValidClosing = nextChar === ':' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === '';
        if (isValidClosing) {
          inString = false;
          repaired += '"';
        } else {
          // Unescaped double quote inside string -> escape it
          repaired += '\\"';
        }
      } else {
        inString = true;
        repaired += '"';
      }
      continue;
    }

    if (inString) {
      if (char === '\n') {
        repaired += '\\n';
        continue;
      }
      if (char === '\r') {
        repaired += '\\r';
        continue;
      }
      if (char === '\t') {
        repaired += '\\t';
        continue;
      }
    }

    repaired += char;
  }

  // Remove trailing commas before closing braces/brackets
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  // Try parsing the repaired string
  try {
    return JSON.parse(repaired);
  } catch (e) {
    // Truncation recovery: close unclosed quotes, brackets, and braces
  }

  // Brackets/braces tracking
  let openBraces = 0;
  let openBrackets = 0;
  let stringMode = false;
  let esc = false;

  for (let i = 0; i < repaired.length; i++) {
    const c = repaired[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\') {
      esc = true;
      continue;
    }
    if (c === '"') {
      stringMode = !stringMode;
      continue;
    }
    if (!stringMode) {
      if (c === '{') openBraces++;
      if (c === '}') {
        if (openBraces > 0) openBraces--;
      }
      if (c === '[') openBrackets++;
      if (c === ']') {
        if (openBrackets > 0) openBrackets--;
      }
    }
  }

  if (stringMode) {
    repaired += '"';
  }
  while (openBrackets > 0) {
    repaired += ']';
    openBrackets--;
  }
  while (openBraces > 0) {
    repaired += '}';
    openBraces--;
  }

  // Clean trailing commas after truncation closure
  repaired = repaired.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(repaired);
}
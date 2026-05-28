interface Env {
  DB: D1Database;
  DEFAULT_TOKEN_LIMIT: string;
}

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

const AVAILABLE_MODELS = [
  '@cf/meta/llama-3.2-11b-vision-instruct',
  '@cf/meta/llama-4-scout-17b-16e-instruct',
  '@cf/google/gemma-4-26b-a4b-it',
  '@cf/moonshotai/kimi-k2.6',
  '@cf/moonshotai/kimi-k2.5'
] as const;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }));

    if (url.pathname === '/api/models' && request.method === 'GET') {
      return json({ models: AVAILABLE_MODELS });
    }

    if (url.pathname === '/api/chat' && request.method === 'POST') {
      return withCors(await handleChat(request, env));
    }

    if (url.pathname === '/api/admin/user-plan' && request.method === 'POST') {
      return withCors(await handleSetPlan(request, env));
    }

    if (url.pathname.startsWith('/api/usage/') && request.method === 'GET') {
      return withCors(await handleUsage(url.pathname.split('/').pop() ?? '', env));
    }

    return withCors(new Response('Not Found', { status: 404 }));
  }
} satisfies ExportedHandler<Env>;

async function handleChat(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { userId: string; model: string; messages: ChatMessage[] };
  if (!body.userId || !body.model || !body.messages?.length) return json({ error: 'invalid_payload' }, 400);
  if (!AVAILABLE_MODELS.includes(body.model as (typeof AVAILABLE_MODELS)[number])) return json({ error: 'unsupported_model' }, 400);

  const user = await getOrCreateUser(body.userId, env);
  if (user.token_used >= user.token_limit) return json({ error: 'token_limit_reached', tokenUsed: user.token_used, tokenLimit: user.token_limit }, 403);

  const inputTokens = estimateTokens(body.messages.map((m) => m.content).join(' '));
  const outputText = `Mock response from ${body.model}`;
  const outputTokens = estimateTokens(outputText);
  const totalTokens = inputTokens + outputTokens;

  if (user.token_used + totalTokens > user.token_limit) {
    return json({ error: 'token_limit_reached', tokenUsed: user.token_used, tokenLimit: user.token_limit, requiredTokens: totalTokens }, 403);
  }

  await env.DB.prepare('UPDATE users SET token_used = token_used + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(totalTokens, body.userId).run();
  await env.DB.prepare('INSERT INTO usage_logs (user_id, model, input_tokens, output_tokens, total_tokens) VALUES (?, ?, ?, ?, ?)').bind(body.userId, body.model, inputTokens, outputTokens, totalTokens).run();

  return json({
    reply: outputText,
    usage: { inputTokens, outputTokens, totalTokens }
  });
}

async function handleSetPlan(request: Request, env: Env): Promise<Response> {
  const body = (await request.json()) as { userId: string; planName: string };
  if (!body.userId || !body.planName) return json({ error: 'invalid_payload' }, 400);

  const plan = await env.DB.prepare('SELECT name, token_limit FROM plans WHERE name = ?').bind(body.planName).first<{ name: string; token_limit: number }>();
  if (!plan) return json({ error: 'plan_not_found' }, 404);

  await getOrCreateUser(body.userId, env);
  await env.DB.prepare('UPDATE users SET plan_name = ?, token_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(plan.name, plan.token_limit, body.userId).run();

  return json({ ok: true, userId: body.userId, plan: plan.name, tokenLimit: plan.token_limit });
}

async function handleUsage(userId: string, env: Env): Promise<Response> {
  if (!userId) return json({ error: 'missing_user_id' }, 400);
  const user = await getOrCreateUser(userId, env);
  return json({
    userId: user.id,
    plan: user.plan_name,
    tokenUsed: user.token_used,
    tokenLimit: user.token_limit,
    remainingTokens: Math.max(0, user.token_limit - user.token_used)
  });
}

async function getOrCreateUser(userId: string, env: Env) {
  let user = await env.DB.prepare('SELECT id, name, plan_name, token_limit, token_used FROM users WHERE id = ?').bind(userId).first<any>();
  if (user) return user;

  const defaultLimit = Number.parseInt(env.DEFAULT_TOKEN_LIMIT || '200000', 10);
  await env.DB.prepare('INSERT INTO users (id, name, plan_name, token_limit, token_used) VALUES (?, ?, ?, ?, 0)').bind(userId, userId, 'free', defaultLimit).run();
  user = await env.DB.prepare('SELECT id, name, plan_name, token_limit, token_used FROM users WHERE id = ?').bind(userId).first<any>();
  return user;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET,POST,OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  return new Response(response.body, { status: response.status, headers });
}

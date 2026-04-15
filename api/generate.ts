export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { model, messages, response_format } = body;
    
    // 强制使用测试 Key 和 URL，排除环境变量干扰
    const apiKey = 'sk-bxGHYtJzVokDGX18ZqwnQqjo0PSpsNmX1eYGc91qYwXwEfPi';
    const customUrl = 'https://new.apipudding.com';

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'API key not configured on server' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let cleanUrl = customUrl.trim();
    if (cleanUrl.endsWith('/')) cleanUrl = cleanUrl.slice(0, -1);
    if (cleanUrl.endsWith('/v1beta')) cleanUrl = cleanUrl.slice(0, -7);
    if (cleanUrl.endsWith('/v1')) cleanUrl = cleanUrl.slice(0, -3);

    const url = `${cleanUrl}/v1/chat/completions`;

    const payload: any = { model, messages };
    if (response_format) payload.response_format = response_format;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.text();
    
    return new Response(data, {
      status: response.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
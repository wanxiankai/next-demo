interface FetchOptions extends RequestInit {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
}

// 这个fetcher在浏览器中运行
async function clientFetch(endpoint: string, options: FetchOptions = {}) {
  // 基础URL是相对路径，指向我们自己的BFF API
  const url = `/api${endpoint}`; 
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    config.body = JSON.stringify(options.data);
  }

  const res = await fetch(url, config);

  if (!res.ok) {
    // 可以在这里处理通用的客户端错误
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || `Client fetch error: ${res.status}`);
  }

  // 假设所有成功的API都返回JSON
  return res.json();
}

// 导出便捷方法
export const clientApi = {
  get: (endpoint: string, options: FetchOptions = {}) =>
    clientFetch(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint: string, data: any, options: FetchOptions = {}) =>
    clientFetch(endpoint, { ...options, method: 'POST', data }),
  
  // ... put, delete ...
};
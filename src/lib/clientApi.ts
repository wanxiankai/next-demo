import { IResponse } from './type';

interface FetchOptions<T = unknown> extends RequestInit {
  data?: T;
}

// 这个fetcher在浏览器中运行
async function clientFetch<TRequest = unknown, TResponse = unknown>(
  endpoint: string,
  options: FetchOptions<TRequest> = {}
): Promise<IResponse<TResponse>> {
  // 基础URL是相对路径，指向我们自己的BFF API
  const url = `/api${endpoint}`;

  // 合并用户传入的 headers
  const headers = new Headers(options.headers);

  // 防止修改用户设置的 Content-Type
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

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
  return await res.json();
}

// 导出便捷方法
export const clientApi = {
  get: <TResponse = unknown>(endpoint: string, options: FetchOptions = {}) =>
    clientFetch<unknown, TResponse>(endpoint, { ...options, method: 'GET' }),

  post: <TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    options: FetchOptions<TRequest> = {}
  ) =>
    clientFetch<TRequest, TResponse>(endpoint, { ...options, method: 'POST', data }),

  put: <TRequest = unknown, TResponse = unknown>(
    endpoint: string,
    data: TRequest,
    options: FetchOptions<TRequest> = {}
  ) =>
    clientFetch<TRequest, TResponse>(endpoint, { ...options, method: 'PUT', data }),

  delete: <TResponse = unknown>(endpoint: string, options: FetchOptions = {}) =>
    clientFetch<unknown, TResponse>(endpoint, { ...options, method: 'DELETE' }),
};
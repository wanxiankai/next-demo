import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// ------------------------------------------------------------------
// 1. 自动刷新Token的逻辑 (防止并发刷新)
// ------------------------------------------------------------------

// 这是一个模块级的Promise，用于防止多个请求同时刷新token
// 它确保在token刷新期间，所有其他失败的请求都会等待这一个刷新结果
let refreshPromise: Promise<string | null> | null = null;

async function getNewAccessToken(): Promise<string | null> {
  const cookieStore = cookies();
  const refreshToken = cookieStore.get('refresh_token')?.value;

  if (!refreshToken) {
    console.error('No refresh token found. User must re-login.');
    return null;
  }

  console.log('Attempting to refresh access token...');
  
  try {
    const apiBaseUrl = process.env.GO_API_URL;
    const res = await fetch(`${apiBaseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) {
      throw new Error('Failed to refresh token');
    }

    const { access_token, refresh_token, expires_in } = await res.json();

    // 更新 cookies
    cookieStore.set('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: expires_in,
      sameSite: 'lax',
    });
    // 可选：如果Go后端返回了新的refresh_token，也更新它
    if (refresh_token) {
       cookieStore.set('refresh_token', refresh_token, {
         httpOnly: true,
         secure: process.env.NODE_ENV === 'production',
         path: '/',
         maxAge: 60 * 60 * 24 * 30,
         sameSite: 'lax',
       });
    }

    console.log('Access token refreshed successfully.');
    return access_token;

  } catch (error) {
    console.error('Token refresh failed:', error);
    // 刷新失败，强制用户重新登录
    // 清除无效的 auth cookies
    cookieStore.delete('access_token');
    cookieStore.delete('refresh_token');
    return null;
  } finally {
    // 无论成功与否，都清除Promise锁，以便下次401可以触发新的刷新
    refreshPromise = null;
  }
}

// ------------------------------------------------------------------
// 2. 服务端 Fetch 封装器
// ------------------------------------------------------------------

interface ServerFetchOptions extends RequestInit {
  data?: any;
  // 允许在RSC中传递缓存控制
  cache?: RequestInit['cache'];
  next?: RequestInit['next'];
}

// 内部的fetch实现
async function _serverFetch(
  endpoint: string, 
  options: ServerFetchOptions, 
  isRetry: boolean = false
): Promise<Response> {
  
  const apiBaseUrl = process.env.GO_API_URL;
  const url = `${apiBaseUrl}${endpoint}`;
  
  const cookieStore = cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // 附加 Access Token
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = {
    ...options,
    headers,
  };

  if (options.data) {
    config.body = JSON.stringify(options.data);
  }
  
  // 执行请求
  const res = await fetch(url, config);

  // ---------------------------------
  // 核心：Token 过期与重试逻辑
  // ---------------------------------
  if (!res.ok && res.status === 401 && !isRetry) {
    console.log('Access token expired. Attempting refresh...');

    try {
      // 使用 singleton Promise 模式防止并发刷新
      if (!refreshPromise) {
        refreshPromise = getNewAccessToken();
      }
      const newAccessToken = await refreshPromise;

      if (newAccessToken) {
        console.log('Retrying original request with new token...');
        // 使用新token重试原始请求
        // 关键：将 isRetry 设为 true，防止无限循环
        return _serverFetch(endpoint, {
          ...options,
          // 确保重试时使用新token (虽然_serverFetch会重新读取cookie，但显示传递更安全)
          headers: {
            ...options.headers,
            'Authorization': `Bearer ${newAccessToken}`
          }
        }, true);
      } else {
        // 刷新失败，返回原始的401响应
        return res;
      }
    } catch (refreshError) {
      // 刷新过程中出错
      console.error('Error during token refresh process:', refreshError);
      return res; // 返回原始的401响应
    }
  }

  return res;
}

// ------------------------------------------------------------------
// 3. 导出的便捷方法
// ------------------------------------------------------------------

// 这个是对外暴露的主函数，它处理响应解析
async function serverFetch(endpoint: string, options: ServerFetchOptions) {
  const res = await _serverFetch(endpoint, options);

  if (!res.ok) {
    // 如果重试后仍然失败（或非401失败）
    // 在Route Handler中，我们可能想返回原始的status
    // 在Server Component中，我们可能想抛出错误
    // 暂时先统一定义为抛出错误
    const errorData = await res.json().catch(() => ({}));
    // 创建一个包含状态码的错误
    const error = new Error(errorData.message || `Server fetch error: ${res.status}`);
    (error as any).status = res.status;
    throw error;
  }
  
  // 处理 204 No Content 等情况
  if (res.status === 204) {
    return null;
  }
  
  return res.json();
}

export const serverApi = {
  get: (endpoint: string, options: ServerFetchOptions = {}) =>
    serverFetch(endpoint, { ...options, method: 'GET' }),
  
  post: (endpoint: string, data: any, options: ServerFetchOptions = {}) =>
    serverFetch(endpoint, { ...options, method: 'POST', data }),
    
  // ... put, delete ...
  
  // 暴露原始的 _serverFetch 以便在Route Handlers中获取原始Response对象
  // 这样可以在BFF层透传Go后端的响应状态码
  raw: _serverFetch,
};
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// 假设这是从Go后端成功登录后返回的数据结构
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number; // access_token 的有效期（秒）
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // 1. 调用你的Go后端认证API
    const apiBaseUrl = process.env.GO_API_URL;
    const res = await fetch(`${apiBaseUrl}/passport/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      return NextResponse.json({ error: 'Login failed' }, { status: 401 });
    }

    const { access_token, refresh_token, expires_in }: AuthResponse = await res.json();

    // 2. 将Tokens存储在HttpOnly Cookies中
    const cookieStore = await cookies();

    // 存储 Access Token
    cookieStore.set('access_token', access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: expires_in, // 和token有效期一致
      sameSite: 'lax', // 'strict' 或 'lax' 增强安全性
    });

    // 存储 Refresh Token (通常有效期更长)
    cookieStore.set('refresh_token', refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 假设30天
      sameSite: 'lax',
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
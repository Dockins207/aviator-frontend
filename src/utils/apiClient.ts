import { getToken } from './authUtils';

// Use the same URL resolution logic as the socket client to ensure consistency
const API_BASE_URL = (() => {
  const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL;
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const fallbackUrl = 'http://localhost:8001'; // Change to 8001 to match socket fallback
  
  console.log('API Client URL Configuration:', {
    NEXT_PUBLIC_WEBSOCKET_URL: websocketUrl,
    NEXT_PUBLIC_BACKEND_URL: backendUrl,
    fallbackUrl,
    selected: websocketUrl || backendUrl || fallbackUrl
  });
  
  return websocketUrl || backendUrl || fallbackUrl;
})();

// Log the API base URL during initialization
console.log('API Client initialized with base URL:', API_BASE_URL);

interface ApiClientOptions {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: any;
  headers?: Record<string, string>;
  requiresAuth?: boolean;
}

export class ApiError extends Error {
  status: number;
  data: any;
  
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export const apiClient = async <T = any>({
  path,
  method = 'GET',
  body,
  headers = {},
  requiresAuth = true,
}: ApiClientOptions): Promise<T> => {
  try {
    const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
    
    // Set up headers with content type
    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };
    
    // Add authorization header if required
    if (requiresAuth) {
      const token = getToken();
      if (!token) {
        console.error('Authentication required but token not found');
        throw new ApiError('Authentication token not found', 401);
      }
      
      requestHeaders.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    
    console.log(`🌍 API Request: ${method} ${url}`, { 
      headers: { 
        'Content-Type': requestHeaders['Content-Type'],
        Authorization: requestHeaders.Authorization ? 'Bearer ***' : undefined 
      },
      hasBody: !!body
    });
    
    // Use a more reliable timeout mechanism
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.error(`Request timeout after 5000ms: ${method} ${url}`);
    }, 5000); // 5 second timeout
    
    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      credentials: 'include',
      signal: controller.signal
    };
    
    // Add body to request if provided
    if (body && (method === 'POST' || method === 'PUT')) {
      requestOptions.body = JSON.stringify(body);
    }
    
    // Make the request with better error handling and prevent deep recursion
    try {
      // Check for deep recursion guard
      const recursionKey = `api_recursion_${url}`;
      if ((window as any)[recursionKey]) {
        console.warn(`Recursive API call detected: ${method} ${url}`);
        clearTimeout(timeoutId);
        throw new ApiError('Recursive API call prevented', 429);
      }
      
      // Set recursion guard
      (window as any)[recursionKey] = true;
      
      console.log(`🚀 Sending ${method} request to: ${url}`);
      const response = await fetch(url, requestOptions);
      
      // Clear timeout and recursion guard
      clearTimeout(timeoutId);
      (window as any)[recursionKey] = false;
      
      let data: any;
      
      try {
        data = await response.json();
      } catch (parseError) {
        console.error('Error parsing response JSON:', parseError);
        throw new ApiError('Failed to parse response as JSON', response.status);
      }
      
      if (!response.ok) {
        throw new ApiError(
          data.message || `API request failed with status ${response.status}`,
          response.status,
          data
        );
      }
      
      return data as T;
    } catch (fetchError) {
      // Always clear timeout
      clearTimeout(timeoutId);
      
      // Also clear recursion guard on error
      const recursionKey = `api_recursion_${url}`;
      (window as any)[recursionKey] = false;
      
      // Handle abort error specifically
      if (fetchError.name === 'AbortError') {
        throw new ApiError('Request timed out', 408);
      }
      
      throw fetchError;
    }
  } catch (error) {
    // Handle fetch errors with better detection of deep call stacks
    const stack = new Error().stack || '';
    const callDepth = (stack.match(/at apiClient/g) || []).length;
    
    // Detect potential recursive calls
    if (callDepth > 3) {
      console.error('Potential recursive API calls detected', { 
        callDepth, 
        path 
      });
      throw new ApiError('Too many nested API calls', 508);
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    throw new ApiError(
      error instanceof Error ? error.message : 'Unknown API error',
      500
    );
  }
};

// Convenience methods for different HTTP verbs
export const get = <T = any>(path: string, options?: Omit<ApiClientOptions, 'path' | 'method' | 'body'>) => {
  return apiClient<T>({ path, method: 'GET', ...options });
};

export const post = <T = any>(path: string, body?: any, options?: Omit<ApiClientOptions, 'path' | 'method' | 'body'>) => {
  return apiClient<T>({ path, method: 'POST', body, ...options });
};

export const put = <T = any>(path: string, body?: any, options?: Omit<ApiClientOptions, 'path' | 'method' | 'body'>) => {
  return apiClient<T>({ path, method: 'PUT', body, ...options });
};

export const del = <T = any>(path: string, options?: Omit<ApiClientOptions, 'path' | 'method' | 'body'>) => {
  return apiClient<T>({ path, method: 'DELETE', ...options });
};

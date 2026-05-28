export interface APIConfig {
  baseUrl: string;
  apiKey: string;
  chatModel: string;
  imageModel: string;
  bgImageUrl?: string;
  bgOpacity?: number;
  bgBlur?: number;
  bgFit?: 'cover' | 'contain' | 'auto';
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrls?: string[];
  isGenerating?: boolean;
  isError?: boolean;
  isDrawing?: boolean;
}

export interface AttachmentItem {
  id: string;
  name: string;
  type: 'image' | 'document';
  url: string;
  size: string;
  content?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  draftText?: string;
  draftAttachments?: AttachmentItem[];
  isPinned?: boolean;
}

export const defaultSystemPrompt = '';


export async function* streamChat(
  messages: Message[],
  config: APIConfig
): AsyncGenerator<string, void, unknown> {
  const url = `${config.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${config.apiKey}`,
  };

  const requestMessages = [];
  if (defaultSystemPrompt) {
    requestMessages.push({ role: 'system', content: defaultSystemPrompt });
  }

  requestMessages.push(...messages.map((m) => {
    if (m.role === 'user' && m.imageUrls && m.imageUrls.length > 0) {
      const contentParts: any[] = [{ type: 'text', text: m.content || '' }];
      m.imageUrls.forEach((url) => {
        contentParts.push({ type: 'image_url', image_url: { url } });
      });
      return { role: m.role, content: contentParts };
    }
    return { role: m.role, content: m.content };
  }));

  const body = JSON.stringify({
    model: config.chatModel,
    messages: requestMessages,
    stream: true,
  });

  const response = await fetch(url, { method: 'POST', headers, body });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Chat API Error (${response.status}): ${errorText}`);
  }

  if (!response.body) throw new Error('No response body');

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let done = false;

  while (!done) {
    const { value, done: readerDone } = await reader.read();
    done = readerDone;
    if (value) {
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((line) => line.trim() !== '');
      for (const line of lines) {
        if (line === 'data: [DONE]') return;
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.choices && data.choices[0].delta?.content) {
              yield data.choices[0].delta.content;
            }
          } catch (e) {
            console.warn('Failed to parse stream line', line);
          }
        }
      }
    }
  }
}

export function getRatioFromSize(size: string): string {
  if (size.includes('1792x1024')) return '16:9';
  if (size.includes('1024x1792')) return '9:16';
  if (size.includes('1024x768')) return '4:3';
  if (size.includes('768x1024')) return '3:4';
  return '1:1';
}

export async function generateImage(
  prompt: string, 
  config: APIConfig, 
  size: string = '1024x1024',
  quality: string = 'standard',
  style: string = 'vivid',
  imageUrls?: string[]
): Promise<string> {
  let url = `${config.baseUrl.replace(/\/+$/, '')}/images/generations`;

  // Standard sizes to pass to 'size' property
  let finalSize = size;
  if (size === '1024x1024_auto') {
    finalSize = '1024x1024';
  }

  // Parse width and height from size
  const parts = finalSize.split('x');
  const width = parts[0] ? parseInt(parts[0], 10) : 1024;
  const height = parts[1] ? parseInt(parts[1], 10) : 1024;
  const ratio = getRatioFromSize(finalSize);

  // Automatically append aspect ratio parameter to the end of prompt for Midjourney / SD / FLUX style backends
  let polishedPrompt = prompt;
  if (ratio !== '1:1') {
    if (!prompt.includes('--ar') && !prompt.includes('--aspect')) {
      polishedPrompt = `${prompt} --ar ${ratio}`;
    }
  }

  let requestOptions: RequestInit;

    if (imageUrls && imageUrls.length > 0) {
    url = `${config.baseUrl.replace(/\/+$/, '')}/images/edits`;
    const formData = new FormData();
    formData.append('prompt', polishedPrompt);
    formData.append('model', config.imageModel || 'gpt-image-2');
    formData.append('n', '1');
    formData.append('size', finalSize);
    
    imageUrls.forEach((dataUrl, index) => {
      if (dataUrl.startsWith('data:image')) {
        const arr = dataUrl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        const mime = mimeMatch ? mimeMatch[1] : 'image/png';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        const extMatch = mime.split('/')[1];
        const ext = extMatch ? extMatch : 'png';
        const file = new File([u8arr], `image${index + 1}.${ext}`, { type: mime });
        formData.append('image', file);
      }
    });

    const headers = new Headers();
    headers.append("Accept", "application/json");
    headers.append("Authorization", `Bearer ${config.apiKey}`);

    requestOptions = {
      method: "POST",
      headers: headers,
      body: formData,
      redirect: "follow"
    };

  } else {
    // Standard json payload
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.apiKey}`,
    };

    const bodyParams: any = {
      model: config.imageModel || 'gpt-image-2',
      prompt: polishedPrompt,
      n: 1,
      size: finalSize,
      width: width,
      height: height,
      aspect_ratio: ratio,
      ratio: ratio
    };

    if (quality && quality !== 'default') {
      bodyParams.quality = quality;
    }
    if (style && style !== 'default') {
      bodyParams.style = style;
    }

    requestOptions = {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(bodyParams)
    };
  }

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    const errorText = await response.text();
    let parsedMsg = '';
    try {
      const parsedJson = JSON.parse(errorText);
      parsedMsg = parsedJson.error?.message || parsedJson.message || '';
    } catch (_) {}

    if (response.status === 429) {
      const displayMsg = parsedMsg || '上游负载已满或频率过高';
      throw new Error(`[429 频率限制/负载超载] 当前绘画接口请求过多或服务商线路暂时饱和。请稍候（等待 5~15 秒）再次尝试发送。具体原因为: ${displayMsg}`);
    }
    throw new Error(`Image API Error (${response.status}): ${parsedMsg || errorText}`);
  }

  const data = await response.json();
  
  // High-reliability search function to recursively find an image url or base64 structure
  function findImageInObject(obj: any): string | null {
    if (!obj) return null;
    
    // If it's a string, check if it's a URL, a data URI, or raw base64 data
    if (typeof obj === 'string') {
      const trimmed = obj.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
        return trimmed;
      }
      // Matches raw base64 string
      if (trimmed.length > 500 && /^[A-Za-z0-9+/=]+$/.test(trimmed.slice(0, 100))) {
        return `data:image/png;base64,${trimmed}`;
      }
    }
    
    // If it's an array, search elements
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findImageInObject(item);
        if (found) return found;
      }
    }
    
    // If it's an object, search priority properties first
    if (typeof obj === 'object') {
      const priorityKeys = ['url', 'b64_json', 'image', 'image_url', 'img_url', 'output', 'imageBytes', 'base64'];
      for (const key of priorityKeys) {
        if (obj[key]) {
          const found = findImageInObject(obj[key]);
          if (found) return found;
        }
      }
      
      // Look through other properties
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && !priorityKeys.includes(key)) {
          const found = findImageInObject(obj[key]);
          if (found) return found;
        }
      }
    }
    
    return null;
  }

  const foundImage = findImageInObject(data);
  if (foundImage) {
    return foundImage;
  }
  
  console.error('Failed to parse image response payload:', data);
  throw new Error(`Image URL not found in response. Payload: ${JSON.stringify(data).slice(0, 150)}`);
}

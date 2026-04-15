import React, { useState, useRef } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import { Upload, Image as ImageIcon, Loader2, Sparkles, X, Copy, Check, Settings2, Type as TypeIcon, LayoutTemplate, MonitorPlay, Hash, Wand2, RefreshCw, Eye, EyeOff, ChevronDown, ChevronUp, Download, Maximize2, CheckCircle2, Circle, User, LogIn, UserPlus, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';

interface GeneratedImage {
  url: string;
  prompt: string;
  isRegenerating?: boolean;
  filename?: string;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const fetchWithRetry = async (url: string, options: RequestInit, maxRetries = 2) => {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errText = await response.text();
        let errMsg = errText;
        try {
          const errJson = JSON.parse(errText);
          if (errJson.error && errJson.error.message) {
            errMsg = errJson.error.message;
          }
        } catch (e) {}
        throw new Error(`API Error (${response.status}): ${errMsg}`);
      }
      return response;
    } catch (error: any) {
      lastError = error;
      if (i < maxRetries) {
        console.log(`Fetch failed, retrying (${i + 1}/${maxRetries})...`, error.message);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
      }
    }
  }
  throw lastError;
};

export default function App() {
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [sellingPoints, setSellingPoints] = useState('');
  
  // New configuration states
  const [language, setLanguage] = useState('无文字');
  const [model, setModel] = useState('nano banana 2');
  const [aspectRatio, setAspectRatio] = useState('3:4');
  const [resolution, setResolution] = useState('1K');
  const [quantity, setQuantity] = useState(1);

  const [isGenerating, setIsGenerating] = useState(false);
  const [isGeneratingSellingPoints, setIsGeneratingSellingPoints] = useState(false);
  const [isSellingPointsModalOpen, setIsSellingPointsModalOpen] = useState(false);
  const [sellingPointOptions, setSellingPointOptions] = useState<string[]>(['', '', '']);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  
  // Auth & User Center State
  const [currentUser, setCurrentUser] = useState<string | null>(localStorage.getItem('currentUser'));
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [isUserCenterOpen, setIsUserCenterOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [userSavedImages, setUserSavedImages] = useState<GeneratedImage[]>([]);
  
  // Image Generation State
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [imageGenerationProgress, setImageGenerationProgress] = useState(0);
  const [isPromptCollapsed, setIsPromptCollapsed] = useState(false);
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  
  // Regenerate Modal State
  const [regenerateModal, setRegenerateModal] = useState<{
    isOpen: boolean;
    index: number;
    prompt: string;
    model: string;
    resolution: string;
  }>({
    isOpen: false,
    index: -1,
    prompt: '',
    model: '',
    resolution: ''
  });
  
  // Settings Modal State
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleRegister = async () => {
    if (!authEmail || !authPassword) {
      setError('请输入邮箱和密码');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    if (users[authEmail]) {
      setError('该邮箱已注册');
      setTimeout(() => setError(null), 3000);
      return;
    }
    users[authEmail] = { password: authPassword, images: [] };
    localStorage.setItem('mockUsers', JSON.stringify(users));
    localStorage.setItem('currentUser', authEmail);
    setCurrentUser(authEmail);
    setIsRegisterModalOpen(false);
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleLogin = async () => {
    if (!authEmail || !authPassword) {
      setError('请输入邮箱和密码');
      setTimeout(() => setError(null), 3000);
      return;
    }
    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    if (!users[authEmail] || users[authEmail].password !== authPassword) {
      setError('邮箱或密码错误');
      setTimeout(() => setError(null), 3000);
      return;
    }
    localStorage.setItem('currentUser', authEmail);
    setCurrentUser(authEmail);
    setIsLoginModalOpen(false);
    setAuthEmail('');
    setAuthPassword('');
  };

  const handleLogout = () => {
    localStorage.removeItem('currentUser');
    setCurrentUser(null);
  };

  const saveImagesToUser = async (newImages: GeneratedImage[]) => {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    if (users[currentUser]) {
      const imagesWithId = newImages.map(img => ({
        ...img,
        filename: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
      }));
      users[currentUser].images = [...imagesWithId, ...(users[currentUser].images || [])];
      localStorage.setItem('mockUsers', JSON.stringify(users));
    }
  };

  const loadUserImages = async () => {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    if (users[currentUser]) {
      setUserSavedImages(users[currentUser].images || []);
    }
  };

  const handleDeleteImage = async (filename: string) => {
    if (!currentUser) return;
    const users = JSON.parse(localStorage.getItem('mockUsers') || '{}');
    if (users[currentUser]) {
      users[currentUser].images = users[currentUser].images.filter((img: any) => img.filename !== filename);
      localStorage.setItem('mockUsers', JSON.stringify(users));
      setUserSavedImages(users[currentUser].images);
    }
  };

  React.useEffect(() => {
    if (isUserCenterOpen) {
      loadUserImages();
    }
  }, [isUserCenterOpen, currentUser]);

  const languages = ['无文字', '中文', '英文', '日文', '泰文'];
  const models = ['nano banana 2', 'nanobananapro', 'nanobanana'];
  const aspectRatios = ['1:1', '3:4', '4:3', '9:16', '16:9'];
  const resolutions = ['1K', '2K', '4K'];
  const quantities = Array.from({ length: 15 }, (_, i) => i + 1);

  const processFiles = (files: FileList | File[]) => {
    const newFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const availableSlots = 6 - images.length;
    const filesToAdd = newFiles.slice(0, availableSlots);

    if (filesToAdd.length > 0) {
      setImages(prev => [...prev, ...filesToAdd]);
      
      filesToAdd.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImagePreviews(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }

    if (newFiles.length > availableSlots) {
      setError('最多只能上传 6 张图片。');
      setTimeout(() => setError(null), 3000);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCopy = async () => {
    if (result) {
      try {
        await navigator.clipboard.writeText(result);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy text: ', err);
      }
    }
  };

  const callAiApi = async (systemInstruction: string, promptText: string, imageParts: any[] = [], isJson = false) => {
    const modelName = '[特价]gemini-3-flash-preview';
    
    const messages: any[] = [];
    if (systemInstruction) {
      messages.push({ role: "system", content: systemInstruction });
    }
    
    const userContent: any[] = [];
    if (promptText) {
      userContent.push({ type: "text", text: promptText });
    }
    
    imageParts.forEach(part => {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}` }
      });
    });
    
    messages.push({ role: "user", content: userContent });

    const payload: any = {
      model: modelName,
      messages: messages,
    };

    if (isJson) {
      payload.response_format = { type: "json_object" };
      const lastMsg = messages[messages.length - 1];
      lastMsg.content.push({ type: "text", text: "\n请严格输出JSON对象格式，包含一个 'options' 数组字段，例如：{\"options\": [\"方案1\", \"方案2\", \"方案3\"]}" });
    }

    const response = await fetchWithRetry('/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    if (isJson) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.options && Array.isArray(parsed.options)) {
          return JSON.stringify(parsed.options);
        }
      } catch (e) {
        console.error("JSON parse fallback", e);
      }
    }
    return content;
  };

  const generateAutoSellingPoints = async () => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    if (images.length === 0) {
      setError('请先上传至少一张产品图片。');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsSellingPointsModalOpen(true);
    setIsGeneratingSellingPoints(true);
    setError(null);

    try {
      const imageParts = await Promise.all(images.map(async (img) => {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(img);
        });
        return {
          inlineData: {
            data: base64Data,
            mimeType: img.type,
          },
        };
      }));

      const systemInstruction = `你是一位资深的电商视觉营销专家和文案策划。你的任务是根据用户提供的产品图片，深度挖掘并提炼产品的核心卖点。
请输出3种不同风格或侧重点的专业卖点文案方案。
每个方案的文本内容必须严格按照以下格式和结构排版：

一、 产品名称
- 主推名称： [主推名称1] / [主推名称2]
二、 产品卖点
- [卖点1短标题]： [卖点1详细描述]
- [卖点2短标题]： [卖点2详细描述]
- [卖点3短标题]： [卖点3详细描述]
- [卖点4短标题]： [卖点4详细描述]
三、 适应人群
- [人群1]： [人群1描述]
- [人群2]： [人群2描述]
- [人群3]： [人群3描述]
四、 设计风格
- [风格1]： [风格1描述]
- [风格2]： [风格2描述]
- [风格3]： [风格3描述]`;
      const promptText = "请深度分析这些产品图片，严格按照要求的四部分结构（产品名称、产品卖点、适应人群、设计风格），提取3种不同版本的专业级别电商卖点。";

      const responseText = await callAiApi(systemInstruction, promptText, imageParts, true);

      let options = ['', '', ''];
      if (responseText) {
        try {
          const parsed = JSON.parse(responseText);
          if (Array.isArray(parsed) && parsed.length >= 3) {
            options = [parsed[0], parsed[1], parsed[2]];
          } else if (Array.isArray(parsed)) {
            options = [...parsed, '', '', ''].slice(0, 3);
          }
        } catch (e) {
          console.error("Failed to parse JSON response", e);
          options[0] = responseText;
        }
      }
      setSellingPointOptions(options);
      setSelectedOptionIndex(0);
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || '生成卖点过程中发生错误，请重试。';
      if (errMsg.includes('Failed to fetch')) {
        errMsg = '当前生图服务器拥挤，请稍后再试。';
      }
      setError(errMsg);
      setTimeout(() => setError(null), 3000);
      setIsSellingPointsModalOpen(false);
    } finally {
      setIsGeneratingSellingPoints(false);
    }
  };

  const generatePrompt = async () => {
    if (!currentUser) {
      setIsLoginModalOpen(true);
      return;
    }
    if (images.length === 0) {
      setError('请先上传至少一张产品图片。');
      setTimeout(() => setError(null), 3000);
      return;
    }

    setIsGenerating(true);
    setError(null);
    setResult(null);
    setIsCopied(false);
    setGeneratedImages([]);
    setIsPromptCollapsed(false);
    setSelectedImageIndices([]);

    try {
      const imageParts = await Promise.all(images.map(async (img) => {
        const base64Data = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(img);
        });
        return {
          inlineData: {
            data: base64Data,
            mimeType: img.type,
          },
        };
      }));

      const systemInstruction = `你是一位顶级的电商视觉总监和AI绘画提示词工程师。你的任务是根据用户提供的产品图片、产品卖点以及配置参数，生成一套高端时尚的电商详情页设计提示词。
请注意：除了主标题和副标题的内容需要根据用户选择的“画面语言”来决定语言种类外，【所有其他提示词内容必须全部使用中文】。

配置参数：
- 目标模型：${model}
- 画面文字语言：${language} （如果为“无文字”，则不生成主副标题；如果为中文/英文/日文/泰文，则主副标题使用对应语言）
- 尺寸比例：${aspectRatio}
- 清晰度：${resolution}
- 生成数量（详情页页数）：${quantity}页
- 产品卖点提示：${sellingPoints || '无特定卖点，请根据图片自行提取核心亮点'}

请严格按照以下结构输出最终的提示词：

# 整体设计规范
（请根据产品特性，设定一套统一的高端时尚设计规范）
- **色彩规范**：明确主色调、辅助色与背景色。
- **字体规范**：区分标题字体与正文字体，建立清晰的字号层级。必须明确主标题和副标题的具体字号（如：主标题 72pt，副标题 36pt）、具体字体（如：思源黑体/Helvetica等）。字体颜色需提供两种方案（如：深色背景用白色#FFFFFF，浅色背景用深灰#333333）。
- **视觉语言**：统一装饰元素与图标风格，保持合理留白以突出产品主体。
- **摄影风格**：采用高质感电商拍摄方式（如自然光或柔光），搭配浅景深增强层次。
- **画面质量**：要求高清分辨率（${resolution}）与强真实感。
- **尺寸比例**：${aspectRatio}

# 详情页内容规划（共 ${quantity} 页）
（请根据上传的产品图和产品卖点，为每一页单独设定内容结构。如果语言不是“无文字”，每页必须包含主标题和副标题。主标题严格控制在13个字符以内，副标题严格控制在18个字符以内。注意：直接输出标题内容，绝对不要在标题后面加上“(13字内)”或“(18字内)”等字数说明。）

${Array.from({ length: quantity }).map((_, i) => `## 第 ${i + 1} 页：[本页核心主题]
- **展示方式与视角**：[根据产品复杂程度选择，如正面、45°或特写]
- **设计目标与核心表达**：[明确本页要传达的信息]
- **产品呈现与占比**：[设定产品在画面中的位置和大小占比]
- **构图与排版**：[如居中、对称或分布式布局，图文排版方式]
- **文字区域与信息**：
  - 文字位置：[如：画面左上角留白处]
  - 主标题：[根据语言选项生成，<=13字，不带字数说明。若无文字则写“无”]
  - 副标题：[根据语言选项生成，<=18字，不带字数说明。若无文字则写“无”]
- **视觉重点与卖点**：[突出对应的卖点]
- **背景与装饰元素**：[搭配适合的背景元素与装饰元素增强画面表现]
- **氛围、情绪与光影**：[统一整体氛围、情绪关键词及光影效果]
- **AI生图Prompt(中文)**：[结合以上所有设定，写一段直接用于AI生图的中文Prompt，包含主体、环境、光影、构图等，并附带模型参数]`).join('\n\n')}
`;

      const responseText = await callAiApi(systemInstruction, "请根据这些图片和系统指令，生成电商详情页的生图提示词。", imageParts, false);

      setResult(responseText || '未能生成提示词，请重试。');
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || '生成过程中发生错误，请重试。';
      if (errMsg.includes('Failed to fetch')) {
        errMsg = '当前生图服务器拥挤，请稍后再试。';
      }
      setError(errMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const generateImages = async () => {
    if (!result || images.length === 0) return;
    setIsGeneratingImages(true);
    setGeneratedImages([]);
    setError(null);
    setImageGenerationProgress(0);
    setIsPromptCollapsed(true);
    setSelectedImageIndices([]);

    try {
      // Parse result to get overall guidelines and per-page prompts
      const parts = result.split(/## 第 \d+ 页[：:]/);
      const overallGuidelines = parts[0].replace('# 整体设计规范', '').trim();
      const pagePrompts = parts.slice(1);

      const base64Images = await Promise.all(images.map(async (img) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img);
        });
      }));

      const newImages: GeneratedImage[] = [];

      for (let i = 0; i < quantity; i++) {
        setImageGenerationProgress(Math.round((i / quantity) * 100));
        
        let pagePrompt = "";
        if (pagePrompts[i]) {
          pagePrompt = pagePrompts[i].trim();
        } else {
          pagePrompt = "高端电商产品图";
        }

        const finalPrompt = `【整体设计规范】：${overallGuidelines}\n\n【本页画面要求】：${pagePrompt}\n\n尺寸比例：${aspectRatio}，清晰度：${resolution}`;

        let actualImageModel = model;
        if (model === 'nano banana 2') {
          actualImageModel = resolution === '1K' ? '[官逆C]Nano banana 2' : '[官逆C]Nano banana 2-2k';
        } else if (model === 'nanobanana') {
          actualImageModel = '[官逆C]Nano banana(小香蕉)';
        } else if (model === 'nanobananapro') {
          actualImageModel = resolution === '1K' ? '[官逆C]Nano banana pro(大香蕉)' : '[官逆C]Nano banana pro-2k';
        }

        const userContent: any[] = [
          { type: "text", text: finalPrompt }
        ];
        
        base64Images.forEach(base64 => {
          userContent.push({
            type: "image_url",
            image_url: { url: base64 }
          });
        });

        const payload = {
          model: actualImageModel,
          messages: [
            {
              role: "user",
              content: userContent
            }
          ]
        };

        const response = await fetchWithRetry('/api/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (content) {
          // Extract markdown image URL: ![alt](url)
          const match = content.match(/!\[.*?\]\((.*?)\)/);
          if (match && match[1]) {
            newImages.push({ url: match[1], prompt: finalPrompt });
          } else {
            // Fallback: try to find any http link
            const urlMatch = content.match(/https?:\/\/[^\s)]+/);
            if (urlMatch) {
              newImages.push({ url: urlMatch[0], prompt: finalPrompt });
            } else if (content.startsWith('http')) {
              newImages.push({ url: content.trim(), prompt: finalPrompt });
            }
          }
          setGeneratedImages([...newImages]);
        }
      }
      setImageGenerationProgress(100);
      saveImagesToUser(newImages);
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || '生成图片过程中发生错误，请检查 API 配置或重试。';
      if (errMsg.includes('Failed to fetch')) {
        errMsg = '当前生图服务器拥挤，请稍后再试。';
      }
      setError(errMsg);
    } finally {
      setIsGeneratingImages(false);
    }
  };

  const toggleImageSelection = (index: number) => {
    setSelectedImageIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error('Network response was not ok');
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error("Download failed, falling back to open window", e);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  const handleBatchDownload = async () => {
    if (selectedImageIndices.length === 0) return;
    
    try {
      const zip = new JSZip();
      const folder = zip.folder("ecommerce-images");
      
      await Promise.all(selectedImageIndices.map(async (index) => {
        const img = generatedImages[index];
        if (img && img.url) {
          const response = await fetch(img.url, { mode: 'cors' });
          if (!response.ok) throw new Error(`Failed to fetch image ${index}`);
          const blob = await response.blob();
          folder?.file(`ecommerce-image-${index + 1}.png`, blob);
        }
      }));
      
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const zipUrl = window.URL.createObjectURL(zipBlob);
      
      const a = document.createElement('a');
      a.href = zipUrl;
      a.download = "ecommerce-images.zip";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(zipUrl);
    } catch (error) {
      console.error("Failed to create zip file", error);
      setError("批量下载压缩包失败，请重试。");
    }
  };

  const openRegenerateModal = (index: number) => {
    const targetImage = generatedImages[index];
    if (!targetImage) return;
    setRegenerateModal({
      isOpen: true,
      index,
      prompt: targetImage.prompt,
      model: model,
      resolution: resolution
    });
  };

  const regenerateSingleImage = async (index: number, customPrompt: string, customModel: string, customResolution: string) => {
    const targetImage = generatedImages[index];
    if (!targetImage) return;

    setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isRegenerating: true } : img));
    setError(null);

    try {
      const base64Images = await Promise.all(images.map(async (img) => {
        return new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(img);
        });
      }));

      let actualImageModel = customModel;
      if (customModel === 'nano banana 2') {
        actualImageModel = customResolution === '1K' ? '[官逆C]Nano banana 2' : '[官逆C]Nano banana 2-2k';
      } else if (customModel === 'nanobanana') {
        actualImageModel = '[官逆C]Nano banana(小香蕉)';
      } else if (customModel === 'nanobananapro') {
        actualImageModel = customResolution === '1K' ? '[官逆C]Nano banana pro(大香蕉)' : '[官逆C]Nano banana pro-2k';
      }

      const userContent: any[] = [
        { type: "text", text: customPrompt }
      ];
      
      base64Images.forEach(base64 => {
        userContent.push({
          type: "image_url",
          image_url: { url: base64 }
        });
      });

      const payload = {
        model: actualImageModel,
        messages: [{ role: "user", content: userContent }]
      };

      const response = await fetchWithRetry('/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      
      let newUrl = targetImage.url;
      if (content) {
        const match = content.match(/!\[.*?\]\((.*?)\)/);
        if (match && match[1]) {
          newUrl = match[1];
        } else {
          const urlMatch = content.match(/https?:\/\/[^\s)]+/);
          if (urlMatch) {
            newUrl = urlMatch[0];
          } else if (content.startsWith('http')) {
            newUrl = content.trim();
          }
        }
      }

      setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, url: newUrl, prompt: customPrompt, isRegenerating: false } : img));
    } catch (err: any) {
      console.error(err);
      let errMsg = err.message || '重新生成图片失败，请重试。';
      if (errMsg.includes('Failed to fetch')) {
        errMsg = '当前生图服务器拥挤，请稍后再试。';
      }
      setError(errMsg);
      setGeneratedImages(prev => prev.map((img, i) => i === index ? { ...img, isRegenerating: false } : img));
    }
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] text-gray-900 font-sans selection:bg-blue-200">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-20 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-blue-600 to-indigo-600 p-2 rounded-xl text-white shadow-md">
                <LayoutTemplate size={22} />
              </div>
              <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600">
                电商详情页生成器 <span className="text-sm font-medium text-blue-600 ml-2 px-2 py-0.5 bg-blue-50 rounded-full">Studio Genesis</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {currentUser ? (
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-500 hidden sm:inline-block">{currentUser}</span>
                <button 
                  onClick={() => setIsUserCenterOpen(true)}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <User size={16} />
                  个人中心
                </button>
                <button 
                  onClick={handleLogout}
                  className="text-sm font-medium text-gray-500 hover:text-red-600 transition-colors"
                >
                  退出
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => setIsLoginModalOpen(true)}
                  className="text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors flex items-center gap-1"
                >
                  <LogIn size={16} />
                  登录
                </button>
                <button 
                  onClick={() => setIsRegisterModalOpen(true)}
                  className="px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-1"
                >
                  <UserPlus size={16} />
                  注册
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto p-6 md:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
          
          {/* Left Column: Configuration Panel */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Image Upload Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2 text-gray-800">
                  <ImageIcon size={18} className="text-blue-600" />
                  产品图上传 <span className="text-xs font-normal text-gray-500">({images.length}/6)</span>
                </h2>
              </div>
              
              <div
                className={`relative border-2 border-dashed rounded-xl transition-all duration-200 p-4 ${
                  imagePreviews.length > 0 ? 'border-gray-200 bg-gray-50/30' : 'border-gray-300 hover:border-blue-400 bg-gray-50/50 hover:bg-blue-50/30'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
              >
                {imagePreviews.length > 0 ? (
                  <div className="grid grid-cols-3 gap-4">
                    {imagePreviews.map((preview, index) => (
                      <div key={index} className="relative group rounded-lg overflow-hidden bg-white border border-gray-200 aspect-square flex items-center justify-center">
                        <img
                          src={preview}
                          alt={`Product preview ${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-black/50 text-white p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                    {images.length < 6 && (
                      <label className="relative rounded-lg border-2 border-dashed border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50/30 aspect-square flex flex-col items-center justify-center cursor-pointer transition-colors">
                        <Upload size={20} className="text-gray-400 mb-1" />
                        <span className="text-xs text-gray-500">继续上传</span>
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center py-10 px-6 cursor-pointer min-h-[200px]">
                    <div className="bg-white p-4 rounded-full shadow-sm mb-4 border border-gray-100">
                      <Upload size={24} className="text-blue-600" />
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">点击或拖拽上传产品图</p>
                    <p className="text-xs text-gray-500 text-center">支持 JPG, PNG, WEBP (最多6张)</p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      multiple
                      onChange={handleImageUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Selling Points Input */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-semibold flex items-center gap-2 text-gray-800">
                  <TypeIcon size={18} className="text-blue-600" />
                  产品卖点提示词
                </h2>
                <button
                  onClick={generateAutoSellingPoints}
                  disabled={isGeneratingSellingPoints}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGeneratingSellingPoints ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Wand2 size={14} />
                  )}
                  AI写产品卖点
                </button>
              </div>
              <textarea
                value={sellingPoints}
                onChange={(e) => setSellingPoints(e.target.value)}
                placeholder="输入产品的核心卖点、材质、使用场景等，帮助AI更精准地生成画面描述..."
                className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 outline-none transition-all resize-none text-sm bg-gray-50/50 focus:bg-white"
              />
            </div>

            {/* Generation Parameters */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
              <h2 className="text-base font-semibold flex items-center gap-2 text-gray-800 border-b border-gray-100 pb-4">
                <Settings2 size={18} className="text-blue-600" />
                生图参数配置
              </h2>
              
              <div className="grid grid-cols-2 gap-6">
                {/* Language */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">画面语言</label>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {languages.map(lang => <option key={lang} value={lang}>{lang}</option>)}
                  </select>
                </div>

                {/* Model */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <MonitorPlay size={12} /> 模型选择
                  </label>
                  <select 
                    value={model} 
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {models.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>

                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">尺寸比例</label>
                  <select 
                    value={aspectRatio} 
                    onChange={(e) => setAspectRatio(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {aspectRatios.map(ratio => <option key={ratio} value={ratio}>{ratio}</option>)}
                  </select>
                </div>

                {/* Resolution */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">清晰度</label>
                  <select 
                    value={resolution} 
                    onChange={(e) => setResolution(e.target.value)}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {resolutions.map(res => <option key={res} value={res}>{res}</option>)}
                  </select>
                </div>

                {/* Quantity */}
                <div className="space-y-2 col-span-2">
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wider flex items-center gap-1">
                    <Hash size={12} /> 生成数量
                  </label>
                  <select 
                    value={quantity} 
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  >
                    {quantities.map(q => <option key={q} value={q}>{q} 张</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={generatePrompt}
              disabled={images.length === 0 || isGenerating}
              className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                images.length === 0 || isGenerating
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl active:scale-[0.99] transform'
              }`}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  正在深度解析与生成...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  生成详情页提示词
                </>
              )}
            </button>

            {/* Generate Images Button (Only visible if result exists) */}
            {result && (
              <button
                onClick={generateImages}
                disabled={isGeneratingImages}
                className={`w-full py-4 rounded-xl font-semibold text-base flex items-center justify-center gap-2 transition-all ${
                  isGeneratingImages
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white hover:from-emerald-600 hover:to-teal-700 shadow-lg hover:shadow-xl active:scale-[0.99] transform'
                }`}
              >
                {isGeneratingImages ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    正在生成电商图 ({imageGenerationProgress}%)...
                  </>
                ) : (
                  <>
                    <ImageIcon size={20} />
                    生成电商图
                  </>
                )}
              </button>
            )}

            {/* Error Toast / Alert */}
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 p-4 bg-gray-900 text-white rounded-xl shadow-2xl flex items-center gap-3"
                >
                  <span className="text-red-400">⚠️</span>
                  <span className="text-sm font-medium">{error}</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Right Column: Result Panel */}
          <div className="lg:col-span-7 flex flex-col gap-6 pb-10">
            
            {/* Prompt Box */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col shrink-0">
              <div 
                className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl cursor-pointer hover:bg-gray-100/50 transition-colors"
                onClick={() => result && setIsPromptCollapsed(!isPromptCollapsed)}
              >
                <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" />
                  生成电商详情页提示词
                </h2>
                
                <div className="flex items-center gap-3">
                  {/* Copy Button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopy(); }}
                    disabled={!result || isGenerating}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      !result || isGenerating
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : isCopied
                        ? 'bg-green-100 text-green-700 border border-green-200'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300 shadow-sm'
                    }`}
                  >
                    {isCopied ? (
                      <>
                        <Check size={16} />
                        已复制
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        一键复制提示词
                      </>
                    )}
                  </button>
                  {result && (
                    <div className="text-gray-400">
                      {isPromptCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </div>
                  )}
                </div>
              </div>
              
              <AnimatePresence initial={false}>
                {(!isPromptCollapsed || !result) && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-6 md:p-8">
                      <AnimatePresence mode="wait">
                        {isGenerating ? (
                          <motion.div
                            key="loading"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex flex-col items-center justify-center text-gray-400 space-y-6 py-12"
                          >
                            <div className="relative">
                              <div className="absolute inset-0 bg-indigo-100 rounded-full animate-ping opacity-60"></div>
                              <div className="bg-white p-4 rounded-full relative z-10 shadow-sm border border-gray-100">
                                <Sparkles size={32} className="text-indigo-500 animate-pulse" />
                              </div>
                            </div>
                            <div className="text-center space-y-2">
                              <p className="text-gray-600 font-medium">AI 正在构思电商详情页视觉方案...</p>
                              <p className="text-sm text-gray-400">正在结合产品特征与所选参数生成专业提示词</p>
                            </div>
                          </motion.div>
                        ) : result ? (
                          <motion.div
                            key="result"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="markdown-body prose prose-blue max-w-none"
                          >
                            <ReactMarkdown>{result}</ReactMarkdown>
                          </motion.div>
                        ) : (
                          <motion.div
                            key="empty"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center text-gray-400 py-12"
                          >
                            <div className="bg-gray-50 p-6 rounded-full mb-4 border border-gray-100">
                              <LayoutTemplate size={32} className="text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium mb-1">等待生成</p>
                            <p className="text-sm text-gray-400 text-center max-w-sm">
                              在左侧上传产品图并配置参数，点击生成按钮获取专业的 AI 绘画提示词
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Images Box */}
            {(generatedImages.length > 0 || isGeneratingImages) && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 flex flex-col shrink-0"
              >
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                  <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <ImageIcon size={18} className="text-emerald-600" />
                    生成的电商图
                  </h2>
                  <button
                    onClick={handleBatchDownload}
                    disabled={selectedImageIndices.length === 0 || isGeneratingImages}
                    className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedImageIndices.length === 0 || isGeneratingImages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-sm'
                    }`}
                  >
                    <Download size={16} />
                    批量下载 ({selectedImageIndices.length})
                  </button>
                </div>
                <div className="p-6 md:p-8">
                  {generatedImages.length === 0 && isGeneratingImages ? (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4">
                      <Loader2 size={32} className="animate-spin text-emerald-500" />
                      <p className="text-gray-500">正在生成电商图 ({imageGenerationProgress}%)...</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {generatedImages.map((imgObj, idx) => {
                        const isSelected = selectedImageIndices.includes(idx);
                        return (
                          <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 group relative flex items-center justify-center min-h-[200px]">
                            {imgObj.isRegenerating ? (
                              <div className="flex flex-col items-center justify-center space-y-3 p-12">
                                <Loader2 size={32} className="animate-spin text-emerald-500" />
                                <span className="text-sm text-gray-500 font-medium">重新生成中...</span>
                              </div>
                            ) : (
                              <>
                                <img src={imgObj.url} alt={`Generated ${idx + 1}`} className="w-full h-auto block" />
                                
                                {/* Checkbox */}
                                <div 
                                  className="absolute top-3 left-3 z-10 cursor-pointer"
                                  onClick={(e) => { e.stopPropagation(); toggleImageSelection(idx); }}
                                >
                                  {isSelected ? (
                                    <CheckCircle2 size={24} className="text-emerald-500 bg-white rounded-full" />
                                  ) : (
                                    <Circle size={24} className="text-white drop-shadow-md opacity-70 group-hover:opacity-100 transition-opacity" />
                                  )}
                                </div>

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-4">
                                  <button 
                                    onClick={() => setEnlargedImage(imgObj.url)}
                                    className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                    title="查看放大"
                                  >
                                    <Maximize2 size={20} />
                                  </button>
                                  <button 
                                    onClick={() => downloadImage(imgObj.url, `ecommerce-image-${idx + 1}.png`)}
                                    className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                    title="下载"
                                  >
                                    <Download size={20} />
                                  </button>
                                  <button 
                                    onClick={() => openRegenerateModal(idx)}
                                    className="p-3 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                                    title="重新生成图片"
                                  >
                                    <RefreshCw size={20} />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                      {isGeneratingImages && generatedImages.length > 0 && generatedImages.length < quantity && (
                        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-gray-50 flex items-center justify-center min-h-[200px]">
                          <div className="flex flex-col items-center justify-center space-y-3 p-12">
                            <Loader2 size={32} className="animate-spin text-emerald-500" />
                            <span className="text-sm text-gray-500 font-medium">生成中 ({imageGenerationProgress}%)...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: #e5e7eb;
          border-radius: 20px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background-color: #d1d5db;
        }
      `}} />

      {/* Selling Points Modal */}
      <AnimatePresence>
        {isSellingPointsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2 rounded-full">
                    <Wand2 size={20} className="text-gray-700" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">AI帮写方案选择</h3>
                    <p className="text-xs text-gray-500 mt-0.5">选择方案后可自由编辑，确认即可使用</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsSellingPointsModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 flex-1 overflow-y-auto flex flex-col gap-4">
                {isGeneratingSellingPoints ? (
                  <div className="flex flex-col items-center justify-center py-12 space-y-4">
                    <Loader2 size={32} className="animate-spin text-blue-600" />
                    <p className="text-sm text-gray-500">AI 正在为您精心构思 3 种卖点方案...</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-600">方案选择:</span>
                      <div className="flex gap-2">
                        {[0, 1, 2].map((index) => (
                          <button
                            key={index}
                            onClick={() => setSelectedOptionIndex(index)}
                            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                              selectedOptionIndex === index
                                ? 'bg-gray-900 text-white'
                                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                          >
                            方案{index + 1}
                          </button>
                        ))}
                      </div>
                    </div>

                    <textarea
                      value={sellingPointOptions[selectedOptionIndex] || ''}
                      onChange={(e) => {
                        const newOptions = [...sellingPointOptions];
                        newOptions[selectedOptionIndex] = e.target.value;
                        setSellingPointOptions(newOptions);
                      }}
                      className="w-full h-96 p-4 rounded-xl border border-gray-200 focus:border-gray-400 focus:ring-0 outline-none transition-all resize-none text-sm bg-gray-50 text-gray-800"
                    />

                    <button
                      onClick={() => {
                        setSellingPoints(sellingPointOptions[selectedOptionIndex]);
                        setIsSellingPointsModalOpen(false);
                      }}
                      className="w-full py-3.5 mt-2 rounded-xl font-semibold text-base bg-gray-900 text-white hover:bg-gray-800 transition-colors"
                    >
                      确认选择
                    </button>

                    <button
                      onClick={generateAutoSellingPoints}
                      className="flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition-colors py-2"
                    >
                      <RefreshCw size={16} />
                      重新帮写
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Regenerate Modal */}
      <AnimatePresence>
        {regenerateModal.isOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <RefreshCw size={20} className="text-blue-600" />
                  重新生成图片
                </h3>
                <button 
                  onClick={() => setRegenerateModal(prev => ({ ...prev, isOpen: false }))}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">图片提示词</label>
                  <textarea
                    value={regenerateModal.prompt}
                    onChange={(e) => setRegenerateModal(prev => ({ ...prev, prompt: e.target.value }))}
                    className="w-full h-40 p-4 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all resize-none"
                    placeholder="输入生图提示词..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">模型选择</label>
                    <select 
                      value={regenerateModal.model} 
                      onChange={(e) => setRegenerateModal(prev => ({ ...prev, model: e.target.value }))}
                      className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      {models.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">清晰度</label>
                    <select 
                      value={regenerateModal.resolution} 
                      onChange={(e) => setRegenerateModal(prev => ({ ...prev, resolution: e.target.value }))}
                      className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                    >
                      {resolutions.map(res => <option key={res} value={res}>{res}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3 bg-gray-50">
                <button
                  onClick={() => setRegenerateModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={() => {
                    setRegenerateModal(prev => ({ ...prev, isOpen: false }));
                    regenerateSingleImage(regenerateModal.index, regenerateModal.prompt, regenerateModal.model, regenerateModal.resolution);
                  }}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center gap-2"
                >
                  <RefreshCw size={16} />
                  重新生成
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Login Modal */}
      <AnimatePresence>
        {isLoginModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <LogIn size={20} className="text-blue-600" />
                  登录
                </h3>
                <button 
                  onClick={() => setIsLoginModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">邮箱</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="请输入邮箱"
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">密码</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleLogin}
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  登录
                </button>
                <div className="text-center mt-4">
                  <span className="text-sm text-gray-500">还没有账号？</span>
                  <button 
                    onClick={() => { setIsLoginModalOpen(false); setIsRegisterModalOpen(true); }}
                    className="text-sm text-blue-600 hover:underline ml-1"
                  >
                    去注册
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Register Modal */}
      <AnimatePresence>
        {isRegisterModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <UserPlus size={20} className="text-blue-600" />
                  注册
                </h3>
                <button 
                  onClick={() => setIsRegisterModalOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">邮箱</label>
                  <input
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="请输入邮箱"
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">密码</label>
                  <input
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="请输入密码"
                    className="w-full p-2.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
                <button
                  onClick={handleRegister}
                  className="w-full py-2.5 mt-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                >
                  注册
                </button>
                <div className="text-center mt-4">
                  <span className="text-sm text-gray-500">已有账号？</span>
                  <button 
                    onClick={() => { setIsRegisterModalOpen(false); setIsLoginModalOpen(true); }}
                    className="text-sm text-blue-600 hover:underline ml-1"
                  >
                    去登录
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Center Modal */}
      <AnimatePresence>
        {isUserCenterOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <User size={20} className="text-blue-600" />
                  个人中心 - 我的图库
                </h3>
                <button 
                  onClick={() => setIsUserCenterOpen(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors p-1"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-gray-50">
                {userSavedImages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                    <ImageIcon size={48} className="mb-4 opacity-50" />
                    <p>暂无生成的图片，快去生成一张吧！</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {userSavedImages.map((imgObj, idx) => (
                      <div key={idx} className="rounded-xl overflow-hidden border border-gray-200 shadow-sm bg-white group relative aspect-[3/4]">
                        <img src={imgObj.url} alt={`Saved ${idx + 1}`} className="w-full h-full object-cover" />
                        
                        {/* Delete Button */}
                        <button
                          onClick={() => imgObj.filename && handleDeleteImage(imgObj.filename)}
                          className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all z-10 shadow-sm"
                          title="删除图片"
                        >
                          <Trash2 size={16} />
                        </button>

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center gap-3">
                          <button 
                            onClick={() => setEnlargedImage(imgObj.url)}
                            className="p-2.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                            title="查看放大"
                          >
                            <Maximize2 size={18} />
                          </button>
                          <button 
                            onClick={() => downloadImage(imgObj.url, `ecommerce-saved-${idx + 1}.png`)}
                            className="p-2.5 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-all"
                            title="下载"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Enlarged Image Modal */}
      <AnimatePresence>
        {enlargedImage && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4" onClick={() => setEnlargedImage(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setEnlargedImage(null)}
                className="absolute -top-12 right-0 text-white/70 hover:text-white transition-colors p-2"
              >
                <X size={32} />
              </button>
              <img src={enlargedImage} alt="Enlarged" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

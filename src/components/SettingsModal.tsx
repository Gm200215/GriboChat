import { X, Loader2, Image as ImageIcon, CheckCircle2 } from 'lucide-react';
import React, { useState, useRef } from 'react';
import { APIConfig } from '../lib/api';

const getDomainOnly = (url: string): string => {
  if (!url) return '';
  // Strip protocol and any trailing path to isolate the host domain
  let cleaned = url.replace(/^(https?:\/\/)?/, '');
  cleaned = cleaned.replace(/\/.*$/, '');
  return cleaned;
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: APIConfig;
  onSave: (config: APIConfig) => void;
  bgTheme?: 'light' | 'dark';
}

export function SettingsModal({ isOpen, onClose, config, onSave, bgTheme }: SettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<APIConfig>(config);
  const [domainInput, setDomainInput] = useState<string>(() => getDomainOnly(config.baseUrl || ''));
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'api' | 'theme'>('api');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const isDarkBg = config.bgImageUrl && bgTheme === 'dark';
  const isLightBg = config.bgImageUrl && bgTheme === 'light';

  const overlayClasses = isDarkBg || isLightBg 
    ? "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md animate-in fade-in duration-200"
    : "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/35 backdrop-blur-xs animate-in fade-in duration-200";

  const modalClasses = isDarkBg
    ? "w-full max-w-md bg-[#18181B]/90 rounded-2xl shadow-2xl overflow-hidden border border-white/10 text-white backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col"
    : isLightBg
      ? "w-full max-w-md bg-white/92 rounded-2xl shadow-2xl overflow-hidden border border-[#E8E1D5]/60 text-gray-900 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200 flex flex-col"
      : "w-full max-w-md bg-[#FAF8F5] rounded-2xl shadow-xl overflow-hidden border border-[#E8E1D5] text-[#222222] animate-in fade-in zoom-in-95 duration-200 flex flex-col";

  const headerClasses = isDarkBg
    ? "flex border-b border-white/10 bg-white/5 pt-2 px-2 gap-1 relative items-end shrink-0"
    : isLightBg
      ? "flex border-b border-black/5 bg-black/[0.02] pt-2 px-2 gap-1 relative items-end shrink-0"
      : "flex border-b border-[#E8E1D5] bg-[#F4F0E8] pt-2 px-2 gap-1 relative items-end shrink-0";

  const tabActiveClasses = isDarkBg
    ? "px-4 py-2.5 text-[13px] font-semibold rounded-t-lg transition-all duration-200 bg-[#1A1A1E]/95 text-white border-t border-x border-white/10 shadow-[0_-2px_4px_rgba(0,0,0,0.1)] translate-y-px"
    : isLightBg
      ? "px-4 py-2.5 text-[13px] font-semibold rounded-t-lg transition-all duration-200 bg-white/95 text-gray-950 border-t border-x border-black/5 shadow-[0_-2px_4px_rgba(0,0,0,0.01)] translate-y-px"
      : "px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all duration-200 bg-[#FAF8F5] text-[#222222] border-t border-x border-[#E8E1D5] shadow-[0_-2px_4px_rgba(0,0,0,0.02)] translate-y-px";

  const tabInactiveClasses = isDarkBg
    ? "px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all duration-200 text-white/45 hover:text-white hover:bg-white/5 translate-y-px"
    : isLightBg
      ? "px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all duration-200 text-gray-500 hover:text-gray-900 hover:bg-black/[0.02] translate-y-px"
      : "px-4 py-2.5 text-[13px] font-medium rounded-t-lg transition-all duration-200 text-gray-500 hover:text-[#222222] hover:bg-[#E8E1D5]/50 translate-y-px";

  const labelClasses = isDarkBg
    ? "block text-[13px] font-medium text-white/70 mb-1.5"
    : isLightBg
      ? "block text-[13px] font-medium text-gray-700 mb-1.5"
      : "block text-[13px] font-medium text-[#222222] mb-1.5";

  const inputClasses = isDarkBg
    ? "w-full px-3 py-2 text-[13px] rounded-lg border border-white/10 bg-[#2D2D30]/65 placeholder-white/25 text-white focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878] transition-all"
    : isLightBg
      ? "w-full px-3 py-2 text-[13px] rounded-lg border border-gray-200 bg-white/80 placeholder-gray-400 text-gray-950 focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878] transition-all"
      : "w-full px-3 py-2 text-[13px] rounded-lg border border-[#E8E1D5] bg-white text-[#222222] focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878] transition-all";

  const subFooterClasses = isDarkBg
    ? "pt-2 flex flex-col sm:flex-row justify-between items-center bg-white/5 -mx-6 px-6 py-4 mt-6 border-t border-white/10 shrink-0"
    : isLightBg
      ? "pt-2 flex flex-col sm:flex-row justify-between items-center bg-black/[0.02] -mx-6 px-6 py-4 mt-6 border-t border-black/5 shrink-0"
      : "pt-2 flex flex-col sm:flex-row justify-between items-center bg-[#F4F0E8] -mx-6 px-6 py-4 mt-6 border-t border-[#E8E1D5] shrink-0";

  const subBoxClasses = isDarkBg
    ? "flex justify-between items-center bg-white/5 px-3 py-2 rounded-xl border border-white/10 transition-all"
    : isLightBg
      ? "flex justify-between items-center bg-black/[0.01] px-3 py-2 rounded-xl border border-black/5 transition-all"
      : "flex justify-between items-center bg-[#F4F0E8] px-3 py-2 rounded-xl border border-[#E8E1D5] transition-all";

  const uploadBoxClasses = isDarkBg
    ? "w-full h-32 rounded-xl border-2 border-dashed border-white/20 bg-white/5 hover:bg-white/10 hover:border-[#7D9878]/60 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer text-white/50 hover:text-[#7D9878] group shadow-sm hover:shadow-md"
    : isLightBg
      ? "w-full h-32 rounded-xl border-2 border-dashed border-black/10 bg-black/[0.02] hover:bg-black/[0.04] hover:border-[#7D9878]/40 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-[#7D9878] group shadow-sm hover:shadow-md"
      : "w-full h-32 rounded-xl border-2 border-dashed border-[#D4B996]/60 bg-[#F4F0E8]/40 hover:bg-[#F4F0E8] hover:border-[#7D9878]/60 transition-all duration-200 flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-[#7D9878] group shadow-sm hover:shadow-md";

  const closeButtonClasses = isDarkBg
    ? "text-white/45 hover:text-white hover:bg-white/10 rounded-full transition-all p-1.5 self-center mb-1 mr-1 active:scale-95"
    : isLightBg
      ? "text-gray-400 hover:text-gray-900 hover:bg-black/[0.06] rounded-full transition-all p-1.5 self-center mb-1 mr-1 active:scale-95"
      : "text-gray-400 hover:text-[#222222] hover:bg-[#E8E1D5]/50 rounded-full transition-all p-1.5 self-center mb-1 mr-1 active:scale-95";

  const selectClasses = isDarkBg
    ? "w-full px-3.5 py-2 text-[13px] rounded-xl border border-white/10 bg-[#2D2D30]/65 shadow-xs focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878]/15 text-white transition-all cursor-pointer select-none appearance-none font-medium pr-10"
    : isLightBg
      ? "w-full px-3.5 py-2 text-[13px] rounded-xl border border-gray-200 bg-white/80 shadow-xs focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878]/15 text-gray-900 transition-all cursor-pointer select-none appearance-none font-medium pr-10"
      : "w-full px-3.5 py-2 text-[13px] rounded-xl border border-[#E8E1D5] bg-white shadow-xs focus:outline-none focus:border-[#7D9878] focus:ring-1 focus:ring-[#7D9878]/15 text-[#222222] transition-all cursor-pointer select-none appearance-none font-medium pr-10";

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setLocalConfig((prev) => ({ ...prev, [name]: value }));
    setTestStatus('idle');
  };

  const handleRestoreApiDefaults = () => {
    setLocalConfig((prev) => ({
      ...prev,
      apiKey: '',
      chatModel: 'gpt-5.5',
      imageModel: 'gpt-image-2',
    }));
    setDomainInput('www.gribo.top');
    setTestStatus('idle');
  };

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig((prev) => ({ ...prev, bgOpacity: parseFloat(e.target.value) }));
  };

  const handleBlurChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalConfig((prev) => ({ ...prev, bgBlur: parseFloat(e.target.value) }));
  };

  const handleFitChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setLocalConfig((prev) => ({ ...prev, bgFit: e.target.value as any }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawUrl = event.target?.result as string;
        setLocalConfig((prev) => ({ ...prev, bgImageUrl: rawUrl }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestConnection = async () => {
    const cleanDomain = domainInput.trim().replace(/^(https?:\/\/)?/, '').replace(/\/.*$/, '');
    const normalizedBaseUrl = cleanDomain ? `https://${cleanDomain}/v1` : '';

    if (!normalizedBaseUrl || !localConfig.apiKey) {
      setTestStatus('error');
      setTestMessage('请先填写接口域名和密钥');
      return;
    }
    setTestStatus('loading');
    try {
      const url = `${normalizedBaseUrl}/chat/completions`;
      const body = JSON.stringify({
        model: localConfig.chatModel || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localConfig.apiKey}` },
        body
      });
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`HTTP ${res.status}: ${error}`);
      }
      setTestStatus('success');
      setTestMessage('连接成功，接口可用');
    } catch (e: any) {
      setTestStatus('error');
      setTestMessage(`连接失败: ${e.message}`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanDomain = domainInput.trim().replace(/^(https?:\/\/)?/, '').replace(/\/.*$/, '');
    const finalBaseUrl = cleanDomain ? `https://${cleanDomain}/v1` : '';
    onSave({
      ...localConfig,
      baseUrl: finalBaseUrl
    });
    onClose();
  };

  const testButtonClasses = isDarkBg
    ? "px-4 py-2 bg-white/10 border border-white/15 text-white rounded-lg hover:bg-white/15 hover:text-white transition-all text-[13px] font-medium disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer"
    : isLightBg
      ? "px-4 py-2 bg-white/75 border border-black/10 text-gray-900 rounded-lg hover:bg-white/90 hover:text-black transition-all text-[13px] font-medium disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer"
      : "px-4 py-2 bg-white border border-[#E8E1D5] text-[#222222] rounded-lg hover:bg-gray-50 hover:text-black transition-all text-[13px] font-medium disabled:opacity-50 active:scale-95 shadow-sm cursor-pointer";

  const submitButtonClasses = "px-5 py-2 bg-[#7D9878] text-white rounded-lg hover:bg-[#6b8566] hover:scale-105 hover:shadow-md active:scale-95 transition-all duration-200 text-[13px] shadow-sm font-medium cursor-pointer";

  const statusTextClasses = isDarkBg
    ? "text-[11px] font-semibold text-white/50 font-mono tracking-wider uppercase"
    : "text-[11px] font-semibold text-gray-500 font-mono tracking-wider uppercase";

  const replaceBtnClasses = isDarkBg
    ? "px-2.5 py-1 text-xs text-[#7D9878] bg-white/10 border border-[#7D9878]/30 rounded-lg hover:bg-[#7D9878]/15 hover:border-[#7D9878] transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer"
    : isLightBg
      ? "px-2.5 py-1 text-xs text-[#7D9878] bg-white/80 border border-[#7D9878]/30 rounded-lg hover:bg-[#7D9878]/5 hover:border-[#7D9878] transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer"
      : "px-2.5 py-1 text-xs text-[#7D9878] bg-white border border-[#7D9878]/30 rounded-lg hover:bg-[#7D9878]/5 hover:border-[#7D9878] transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer";

  const deleteBtnClasses = isDarkBg
    ? "px-2.5 py-1 text-xs text-red-400 bg-white/10 border border-red-500/30 rounded-lg hover:bg-red-500/10 hover:border-red-500 transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer"
    : isLightBg
      ? "px-2.5 py-1 text-xs text-red-500 bg-white/80 border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-500 transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer"
      : "px-2.5 py-1 text-xs text-red-500 bg-white border border-red-200 rounded-lg hover:bg-red-50 hover:border-red-500 transition-all font-medium flex items-center gap-1 active:scale-95 shadow-xs cursor-pointer";

  const uploadBtnClasses = isDarkBg
    ? "bg-[#2E2E30]/90 border border-white/10 text-white px-4 py-2 rounded-full text-[12px] font-semibold hover:bg-white hover:text-gray-950 hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
    : "bg-white/95 text-[#222222] px-4 py-2 rounded-full text-[12px] font-semibold hover:bg-white hover:scale-105 active:scale-95 transition-all shadow-md flex items-center gap-1.5 cursor-pointer";

  const helpTextClasses = isDarkBg
    ? "text-xs text-white/40 mt-1"
    : "text-xs text-gray-400 mt-1";

  const selectArrowClasses = isDarkBg
    ? "absolute inset-y-0 right-3 flex items-center pointer-events-none text-white/50"
    : "absolute inset-y-0 right-3 flex items-center pointer-events-none text-gray-400";

  const resetBtnClasses = isDarkBg
    ? "px-4 py-2 bg-white/5 border border-white/10 text-white/80 rounded-lg hover:bg-white/10 hover:text-white transition-all text-[13px] font-medium shadow-sm active:scale-95 cursor-pointer"
    : isLightBg
      ? "px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:text-black transition-all text-[13px] font-medium shadow-sm active:scale-95 cursor-pointer"
      : "px-4 py-2 bg-white border border-[#E8E1D5] text-gray-600 rounded-lg hover:bg-gray-50 hover:text-black transition-all text-[13px] font-medium shadow-sm active:scale-95 cursor-pointer";

  const numberBadgeClasses = isDarkBg
    ? "text-xs text-white/60 bg-white/10 px-2 py-0.5 rounded"
    : isLightBg
      ? "text-xs text-gray-600 bg-black/[0.04] px-2 py-0.5 rounded"
      : "text-xs text-gray-500 bg-[#F4F0E8] px-2 py-0.5 rounded";

  return (
    <div className={overlayClasses}>
      <div className={modalClasses}>
        <div className={headerClasses}>
          <button
            onClick={() => setActiveTab('api')}
            className={activeTab === 'api' ? tabActiveClasses : tabInactiveClasses}
          >
            接口设置
          </button>
          <button
            onClick={() => setActiveTab('theme')}
            className={activeTab === 'theme' ? tabActiveClasses : tabInactiveClasses}
          >
            主题设置
          </button>
          <div className="flex-1" />
          <button
            onClick={onClose}
            className={closeButtonClasses}
            title="关闭"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 overflow-y-auto max-h-[80vh] scrollbar-none">
          <form onSubmit={handleSubmit} className="space-y-4">
            {activeTab === 'api' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-left-2 duration-300">
                <div>
                  <label className={labelClasses}>
                    接口域名 (Domain)
                  </label>
                  <input
                    type="text"
                    name="domainInput"
                    value={domainInput}
                    onChange={(e) => {
                      setDomainInput(e.target.value);
                      setTestStatus('idle');
                    }}
                    placeholder="www.gribo.top"
                    className={inputClasses}
                    required
                  />
                  <p className={helpTextClasses}>
                    只需填写域名 (例如 <code className="font-mono bg-black/5 dark:bg-white/5 px-1 rounded">www.gribo.top</code>)，无需填写 <code className="font-mono text-xs opacity-75">https://</code> 协议前缀或 <code className="font-mono text-xs opacity-75">/v1</code> 尾缀，系统会自动完成格式化。
                  </p>
                </div>

                <div>
                  <label className={labelClasses}>
                    密钥 (API Key)
                  </label>
                  <input
                    type="password"
                    name="apiKey"
                    value={localConfig.apiKey}
                    onChange={handleChange}
                    placeholder="sk-..."
                    className={inputClasses}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClasses}>
                      对话模型 (Chat Model)
                    </label>
                    <input
                      type="text"
                      name="chatModel"
                      value={localConfig.chatModel}
                      onChange={handleChange}
                      className={inputClasses}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClasses}>
                       生图模型 (Image Model)
                    </label>
                    <input
                      type="text"
                      name="imageModel"
                      value={localConfig.imageModel}
                      onChange={handleChange}
                      className={inputClasses}
                      required
                    />
                  </div>
                </div>

                <div className={subFooterClasses}>
                  <div className="flex-1 w-full text-left mb-3 sm:mb-0">
                    {testStatus === 'loading' && <span className={`text-[13px] flex items-center gap-1.5 ${isDarkBg ? 'text-white/70' : 'text-gray-500'}`}><Loader2 size={14} className="animate-spin" /> 测试中...</span>}
                    {testStatus === 'success' && <span className="text-[13px] text-[#7D9878] font-medium flex items-center gap-1.5"><CheckCircle2 size={14} /> 连接成功，接口可用</span>}
                    {testStatus === 'error' && <span className="text-[13px] text-red-500 line-clamp-2" title={testMessage}>{testMessage}</span>}
                  </div>
                  <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={handleRestoreApiDefaults}
                      className={resetBtnClasses}
                    >
                      恢复默认
                    </button>
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testStatus === 'loading'}
                      className={testButtonClasses}
                    >
                      测试连接
                    </button>
                    <button
                      type="submit"
                      className={submitButtonClasses}
                    >
                      保存配置
                    </button>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'theme' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
                <div>
                  <label className={labelClasses}>背景图片</label>
                  <div className="flex flex-col gap-3">
                    {localConfig.bgImageUrl ? (
                      <div className="space-y-2.5">
                        <div className={subBoxClasses}>
                          <span className={statusTextClasses}>当前背景图已启用</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className={replaceBtnClasses}
                            >
                              替换背景
                            </button>
                            <button
                              type="button"
                              onClick={() => setLocalConfig(prev => ({ ...prev, bgImageUrl: '' }))}
                              className={deleteBtnClasses}
                            >
                              删除背景
                            </button>
                          </div>
                        </div>
                        <div className="relative w-full h-32 rounded-xl overflow-hidden border border-current/10 group shadow-inner">
                          <img src={localConfig.bgImageUrl} alt="Background" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-all duration-200 flex items-center justify-center backdrop-blur-[2px]">
                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className={uploadBtnClasses}
                            >
                              上传新图片
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div 
                        onClick={() => fileInputRef.current?.click()}
                        className={uploadBoxClasses}
                      >
                        <ImageIcon size={24} className="mb-2 opacity-50 group-hover:opacity-100 transition-opacity group-hover:scale-110 duration-200" />
                        <span className="text-[13px] font-medium">点击上传自定义背景图片</span>
                      </div>
                    )}
                    
                    <input
                      type="file"
                      accept="image/*"
                      ref={fileInputRef}
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelClasses}>
                      背景不透明度
                    </label>
                    <span className={numberBadgeClasses}>
                      {((localConfig.bgOpacity ?? 0.5) * 100).toFixed(0)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="1"
                    step="0.01"
                    value={localConfig.bgOpacity ?? 0.5}
                    onChange={handleOpacityChange}
                    className="w-full accent-[#7D9878] cursor-pointer"
                  />
                  <p className={helpTextClasses}>
                    调整背景图片的透明度以确保界面可读性
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className={labelClasses}>
                      背景模糊度 (毛玻璃化)
                    </label>
                    <span className={numberBadgeClasses}>
                      {(localConfig.bgBlur ?? 0)}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="1"
                    value={localConfig.bgBlur ?? 0}
                    onChange={handleBlurChange}
                    className="w-full accent-[#7D9878] cursor-pointer"
                  />
                  <p className={helpTextClasses}>
                    增加毛玻璃模糊，能够极大地提升任何浅色/深色背景图上的文字易读性
                  </p>
                </div>

                <div>
                  <label className={labelClasses}>
                    背景填充模式
                  </label>
                  <div className="relative">
                    <select
                      value={localConfig.bgFit ?? 'cover'}
                      onChange={handleFitChange}
                      className={selectClasses}
                    >
                      <option value="cover">铺满全屏 (推荐 - 自适应最佳效果)</option>
                      <option value="contain">等比完整展示 (完整呈现背景，不剪切)</option>
                      <option value="auto">原始尺寸居中 (仅按原始高宽比例渲染)</option>
                    </select>
                    <div className={selectArrowClasses}>
                      <span className="text-[9px] font-bold">▼</span>
                    </div>
                  </div>
                  <p className={helpTextClasses}>
                    根据图片的宽高比例选择最完美的裁剪及拉伸自适应方案。
                  </p>
                </div>
                
                <div className={subFooterClasses}>
                   <button
                      type="button"
                      onClick={() => setLocalConfig(prev => ({ ...prev, bgImageUrl: undefined, bgOpacity: 0.5, bgBlur: 0, bgFit: 'cover' }))}
                      className={resetBtnClasses}
                   >
                      恢复默认
                   </button>
                   <button
                      type="submit"
                      className={submitButtonClasses}
                    >
                      保存配置
                    </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef } from "react";
import { ArrowLeft, Download, Upload, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useStore from "@/store/useStore";
import { Card, CardTitle } from "@/components/shared/Card";
import { exportData, importData } from "@/utils/storage";
import { cn } from "@/lib/utils";

export default function Settings() {
  const navigate = useNavigate();
  const records = useStore((s) => s.records);
  const goals = useStore((s) => s.goals);
  const settings = useStore((s) => s.settings);
  const updateSettings = useStore((s) => s.updateSettings);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleExport = () => {
    const data = exportData({ records, goals, settings });
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rider-fashion-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("备份已下载");
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const data = importData(reader.result as string);
      if (data) {
        localStorage.setItem("rider-fashion-state-v1", JSON.stringify(data));
        window.location.reload();
      } else {
        showToast("备份文件无效");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleClear = () => {
    if (confirm("确定清空所有数据吗？此操作不可恢复。")) {
      localStorage.removeItem("rider-fashion-state-v1");
      window.location.reload();
    }
  };

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-full bg-white border border-mocha-100 flex items-center justify-center text-mocha-500 shadow-soft"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-2xl font-semibold text-mocha-800">设置</h1>
        </div>
      </header>

      <Card>
        <CardTitle>数据管理</CardTitle>
        <div className="mt-4 space-y-3">
          <button
            onClick={handleExport}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-mocha-50 hover:bg-mocha-100 transition-colors text-left"
          >
            <Download size={20} className="text-mocha-500" />
            <div>
              <p className="font-medium text-mocha-800">导出备份</p>
              <p className="text-xs text-mocha-400">下载 JSON 格式数据文件</p>
            </div>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-mocha-50 hover:bg-mocha-100 transition-colors text-left"
          >
            <Upload size={20} className="text-mocha-500" />
            <div>
              <p className="font-medium text-mocha-800">导入备份</p>
              <p className="text-xs text-mocha-400">从 JSON 文件恢复数据</p>
            </div>
          </button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />

          <button
            onClick={handleClear}
            className="w-full flex items-center gap-3 p-4 rounded-2xl bg-blush-50 hover:bg-blush-100 transition-colors text-left"
          >
            <Trash2 size={20} className="text-blush-500" />
            <div>
              <p className="font-medium text-blush-500">清空数据</p>
              <p className="text-xs text-blush-300">删除所有记录和设置</p>
            </div>
          </button>
        </div>
      </Card>

      <Card variant="sage">
        <CardTitle>关于时尚版</CardTitle>
        <p className="text-sm text-mocha-500 mt-3 leading-relaxed">
          这是 Rider 的时尚版（Fashion Edition），采用奶油莫兰迪色系、杂志风排版与柔和交互，与赛博版完全不同的设计语言和架构。
        </p>
        <p className="text-xs text-mocha-400 mt-4">Version 1.0.0</p>
      </Card>

      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 bg-mocha-800 text-white text-sm px-5 py-2.5 rounded-full shadow-soft-lg z-50">
          {toast}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { DailyRecord, Weather, WEATHER_OPTIONS } from "@/types";
import { cn, formatCurrency } from "@/lib/utils";
import { formatDateFull, today } from "@/utils/date";

interface RecordSheetProps {
  date?: string;
  record?: DailyRecord;
  open: boolean;
  onClose: () => void;
  onSave: (record: Partial<DailyRecord>) => void;
  onDelete?: () => void;
}

export default function RecordSheet({
  date = today(),
  record,
  open,
  onClose,
  onSave,
  onDelete,
}: RecordSheetProps) {
  const [orders, setOrders] = useState("");
  const [income, setIncome] = useState("");
  const [hours, setHours] = useState("");
  const [weather, setWeather] = useState<Weather>("sunny");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setOrders(record ? String(record.orders) : "");
      setIncome(record ? String(record.income) : "");
      setHours(record ? String(record.workHours) : "");
      setWeather(record?.weather || "sunny");
      setNote(record?.note || "");
    }
  }, [open, record]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      date,
      orders: Number(orders) || 0,
      income: Number(income) || 0,
      workHours: Number(hours) || 0,
      weather,
      note,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-mocha-900/20 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md bg-white rounded-t-[2.5rem] p-6 shadow-soft-lg animate-in slide-in-from-bottom duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-mocha-800">{record ? "编辑记录" : "新增记录"}</h2>
            <p className="text-sm text-mocha-400 mt-0.5">{formatDateFull(date)}</p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-mocha-50 flex items-center justify-center text-mocha-400 hover:text-mocha-600"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-mocha-400 mb-2">今日单量</label>
            <input
              type="number"
              inputMode="numeric"
              value={orders}
              onChange={(e) => setOrders(e.target.value)}
              placeholder="0"
              className="w-full text-3xl font-semibold text-mocha-800 bg-mocha-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-blush-200 placeholder:text-mocha-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-mocha-400 mb-2">收入 (元)</label>
              <input
                type="number"
                inputMode="decimal"
                value={income}
                onChange={(e) => setIncome(e.target.value)}
                placeholder="0"
                className="w-full text-lg font-semibold text-mocha-800 bg-mocha-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-sage-200 placeholder:text-mocha-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-mocha-400 mb-2">工时 (小时)</label>
              <input
                type="number"
                inputMode="decimal"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="0"
                className="w-full text-lg font-semibold text-mocha-800 bg-mocha-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-ocean-200 placeholder:text-mocha-200"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-mocha-400 mb-2">天气</label>
            <div className="flex gap-2 flex-wrap">
              {WEATHER_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setWeather(opt.value)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium border transition-all",
                    weather === opt.value
                      ? "bg-mocha-800 text-white border-mocha-800"
                      : "bg-white text-mocha-500 border-mocha-100 hover:border-mocha-200"
                  )}
                >
                  {opt.icon} {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-mocha-400 mb-2">备注</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="写点什么..."
              rows={2}
              className="w-full text-mocha-700 bg-mocha-50 rounded-2xl px-4 py-3 outline-none focus:ring-2 focus:ring-gold-200 placeholder:text-mocha-300 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          {record && onDelete && (
            <button
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="px-5 py-3.5 rounded-2xl text-sm font-semibold text-blush-500 bg-blush-50 hover:bg-blush-100 transition-colors"
            >
              删除
            </button>
          )}
          <button
            onClick={handleSave}
            className="flex-1 py-3.5 rounded-2xl text-sm font-semibold text-white bg-mocha-800 hover:bg-mocha-700 transition-colors shadow-soft"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

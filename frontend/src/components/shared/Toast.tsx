import { useEffect, useState, useCallback, type ReactNode } from "react";

type ToastType = "success" | "error" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
  exiting: boolean;
}

let addToastFn: ((type: ToastType, message: string) => void) | null = null;

export function toast(type: ToastType, message: string) {
  addToastFn?.(type, message);
}

const ICON: Record<ToastType, string> = {
  success: "✓",
  error: "✗",
  info: "i",
};

const STYLES: Record<ToastType, string> = {
  success: "bg-green-600 text-white",
  error: "bg-red-600 text-white",
  info: "bg-blue-600 text-white",
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  let idCounter = 0;

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++idCounter;
    setItems((prev) => [...prev, { id, type, message, exiting: false }]);
    setTimeout(() => {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 4000);
  }, []);

  useEffect(() => {
    addToastFn = add;
    return () => { addToastFn = null; };
  }, [add]);

  if (items.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${STYLES[item.type]} ${
            item.exiting ? "animate-slide-out-right" : "animate-slide-in-right"
          }`}
        >
          <span className="font-bold text-base leading-none">{ICON[item.type]}</span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}

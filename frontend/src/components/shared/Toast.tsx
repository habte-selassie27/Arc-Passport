import { useEffect, useState, useCallback, useRef } from "react";

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
  success: "toast--success",
  error: "toast--error",
  info: "toast--info",
};

export function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  const idCounterRef = useRef(0);

  const add = useCallback((type: ToastType, message: string) => {
    const id = ++idCounterRef.current;
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
    return () => {
      addToastFn = null;
    };
  }, [add]);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed top-4 right-4 z-[100] flex flex-col gap-2"
      style={{ maxWidth: "min(24rem, calc(100vw - 2rem))" }}
      role="status"
      aria-live="polite"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`toast ${STYLES[item.type]} ${item.exiting ? "toast--exit" : "toast--enter"}`}
        >
          <span className="font-bold" aria-hidden="true">
            {ICON[item.type]}
          </span>
          <span>{item.message}</span>
        </div>
      ))}
    </div>
  );
}

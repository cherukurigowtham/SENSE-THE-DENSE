"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  length?: number;
  onComplete: (code: string) => void;
  className?: string;
};

export default function OTPInputs({ length = 6, onComplete, className = "" }: Props) {
  const [values, setValues] = useState<string[]>(Array.from({ length }, () => ""));
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const setRef = (idx: number) => (el: HTMLInputElement | null) => {
    inputsRef.current[idx] = el;
  };

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  const code = useMemo(() => values.join(""), [values]);

  useEffect(() => {
    if (code.length === length && values.every(v => v !== "")) {
      onComplete(code);
    }
  }, [code, length, onComplete, values]);

  const onChange = (i: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 1);
    setValues(prev => {
      const next = [...prev]; next[i] = v;
      return next;
    });
    if (v && i < length - 1) inputsRef.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !values[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && i > 0) inputsRef.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) inputsRef.current[i + 1]?.focus();
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {values.map((v, i) => (
        <input
          key={i}
          ref={setRef(i)}
          value={v}
          onChange={onChange(i)}
          onKeyDown={onKeyDown(i)}
          inputMode="numeric"
          maxLength={1}
          className="w-10 h-12 text-center text-lg font-semibold rounded-xl border border-black/15 bg-white/90 focus:outline-none focus:ring-2 focus:ring-blue-400/70"
        />
      ))}
    </div>
  );
}

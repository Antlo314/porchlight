"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { Input } from "./Field";

export function PasswordInput({
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  const [shown, setShown] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={shown ? "text" : "password"}
        className={`pr-12 ${className}`.trim()}
      />
      <button
        type="button"
        onClick={() => setShown((v) => !v)}
        aria-label={shown ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-1 flex w-11 items-center justify-center rounded-xl text-ink-soft active:bg-porch-50"
      >
        <Icon name={shown ? "eye-off" : "eye"} className="h-5 w-5" />
      </button>
    </div>
  );
}

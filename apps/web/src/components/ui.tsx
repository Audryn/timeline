"use client";

import { useEffect, useId, useRef, type ComponentProps, type ReactNode } from "react";

export function Button({ type = "button", busy, disabled, ...props }: ComponentProps<"button"> & { busy?: boolean }) {
  return <button {...props} type={type} disabled={disabled || busy} aria-busy={busy || undefined} />;
}

export function TextField({ label, id, type = "text", ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <label htmlFor={inputId}>{label}<input {...props} id={inputId} type={type} /></label>;
}

export function Card({ as: Element = "section", ...props }: ComponentProps<"section"> & { as?: "section" | "article" }) {
  return <Element {...props} />;
}

export function RequestFeedback({ error, message, className, errorClassName, messageClassName }: {
  error: string; message: string; className: string; errorClassName: string; messageClassName: string;
}) {
  const feedback = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error || message) feedback.current?.focus();
  }, [error, message]);
  return <div ref={feedback} tabIndex={-1} className={className}>
    {error && <p role="alert" className={errorClassName}>{error}</p>}
    {message && <p role="status" className={messageClassName}>{message}</p>}
  </div>;
}

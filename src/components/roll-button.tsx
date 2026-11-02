"use client";

import React from "react";
import Link from "next/link";

interface RollTextProps {
  text: string;
}

export function RollText({ text }: RollTextProps) {
  const chars = Array.from(text);

  return (
    <span className="relative inline-flex items-center justify-center overflow-hidden">
      <span className="span-mother">
        {chars.map((char, index) => (
          <span key={index}>{char === " " ? "\u00A0" : char}</span>
        ))}
      </span>
      <span className="span-mother2" aria-hidden="true">
        {chars.map((char, index) => (
          <span key={index}>{char === " " ? "\u00A0" : char}</span>
        ))}
      </span>
    </span>
  );
}

export interface RollButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "emerald" | "rose";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconAfter?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  text?: string;
}

export function RollButton({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  loading = false,
  loadingText,
  text,
  className = "",
  disabled,
  ...props
}: RollButtonProps) {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const displayText = loading && loadingText ? loadingText : (text || (typeof children === "string" ? children : null));

  return (
    <button
      disabled={disabled || loading}
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading && !icon ? (
        <svg
          className="w-4 h-4 animate-spin shrink-0 relative z-10"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      ) : icon ? (
        <span className="shrink-0 relative z-10">{icon}</span>
      ) : null}

      {displayText ? (
        <RollText text={displayText} />
      ) : (
        children
      )}

      {iconAfter && <span className="shrink-0 relative z-10">{iconAfter}</span>}
    </button>
  );
}

export interface RollLinkProps
  extends React.ComponentPropsWithoutRef<typeof Link> {
  variant?: "primary" | "secondary" | "emerald" | "rose";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  iconAfter?: React.ReactNode;
  text?: string;
}

export function RollLink({
  children,
  variant = "primary",
  size = "md",
  icon,
  iconAfter,
  text,
  className = "",
  ...props
}: RollLinkProps) {
  const variantClass = `btn-${variant}`;
  const sizeClass = size === "sm" ? "btn-sm" : size === "lg" ? "btn-lg" : "";
  const displayText = text || (typeof children === "string" ? children : null);

  return (
    <Link
      className={`btn ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0 relative z-10">{icon}</span>}
      {displayText ? <RollText text={displayText} /> : children}
      {iconAfter && <span className="shrink-0 relative z-10">{iconAfter}</span>}
    </Link>
  );
}

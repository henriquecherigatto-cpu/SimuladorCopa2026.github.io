import * as React from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = {
  primary:
    "bg-brand-orange text-white hover:bg-brand-orange-dark active:bg-brand-orange-dark disabled:bg-brand-orange/50",
  secondary:
    "bg-white text-brand-graphite border border-black/10 hover:bg-black/5 active:bg-black/10 disabled:text-brand-graphite/40",
  ghost:
    "bg-transparent text-brand-graphite hover:bg-black/5 active:bg-black/10 disabled:text-brand-graphite/40",
  danger:
    "bg-white text-brand-error border border-brand-error/30 hover:bg-brand-error/10 disabled:text-brand-error/40",
};

const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-3 text-sm gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-base gap-2",
};

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

type ButtonAsButton = BaseProps &
  React.ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type ButtonAsLink = BaseProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
    href: string;
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    loading = false,
    fullWidth = false,
    icon,
    className,
    children,
    ...rest
  } = props;

  const classes = cn(
    "inline-flex items-center justify-center rounded-xl font-medium transition-colors cursor-pointer",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange focus-visible:ring-offset-2",
    "disabled:cursor-not-allowed",
    variantClasses[variant],
    sizeClasses[size],
    fullWidth && "w-full",
    className,
  );

  if ("href" in props && props.href) {
    const href = props.href;
    const anchorRest = rest as React.AnchorHTMLAttributes<HTMLAnchorElement>;
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {loading && <Loader2 className="size-4 animate-spin" />}
        {!loading && icon}
        {children}
      </Link>
    );
  }

  const buttonRest = rest as React.ButtonHTMLAttributes<HTMLButtonElement>;
  return (
    <button
      className={classes}
      disabled={loading || buttonRest.disabled}
      type={buttonRest.type ?? "button"}
      {...buttonRest}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {!loading && icon}
      {children}
    </button>
  );
}

"use client"

import * as React from "react"
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  XCircle,
} from "lucide-react"

import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { useToast } from "@/hooks/use-toast"

type VariantKey = "default" | "destructive" | "success" | "warning" | "info"

function defaultIconFor(variant: VariantKey): React.ReactNode | null {
  switch (variant) {
    case "destructive":
      return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />
    case "success":
      return (
        <CheckCircle2
          className="h-4 w-4 text-accent-emerald"
          aria-hidden="true"
        />
      )
    case "warning":
      return (
        <AlertTriangle
          className="h-4 w-4 text-accent-amber"
          aria-hidden="true"
        />
      )
    case "info":
      return <Info className="h-4 w-4 text-primary" aria-hidden="true" />
    default:
      return null
  }
}

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({
        id,
        title,
        description,
        action,
        icon,
        variant,
        ...props
      }) {
        const requested = (variant ?? "default") as string
        const knownVariants: VariantKey[] = [
          "default",
          "destructive",
          "success",
          "warning",
          "info",
        ]
        const iconKey = (
          knownVariants.includes(requested as VariantKey)
            ? (requested as VariantKey)
            : "default"
        ) as VariantKey

        const renderedIcon = icon ?? defaultIconFor(iconKey)

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex flex-1 items-start gap-3">
              {renderedIcon ? (
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
                  {renderedIcon}
                </span>
              ) : null}
              <div className="grid flex-1 gap-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}

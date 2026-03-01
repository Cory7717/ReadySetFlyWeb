import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[0.95rem] text-sm font-semibold tracking-[0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 transition-all duration-150 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default:
          "border border-primary-border bg-[linear-gradient(180deg,hsl(var(--primary)/0.92),hsl(var(--primary)))] text-primary-foreground shadow-[var(--shadow-rsf-button)] hover:-translate-y-px hover:brightness-[1.03] active:translate-y-[1px] active:shadow-[0px_6px_14px_-12px_rgba(15,23,42,0.4),0px_1px_0px_0px_hsl(var(--primary-border)/0.95)]",
        destructive:
          "border border-destructive-border bg-[linear-gradient(180deg,hsl(var(--destructive)/0.92),hsl(var(--destructive)))] text-destructive-foreground shadow-[0px_10px_20px_-14px_rgba(127,29,29,0.34),0px_3px_0px_0px_hsl(var(--destructive-border)/0.95)] hover:-translate-y-px active:translate-y-[1px]",
        outline:
          "border [border-color:var(--button-outline)] bg-[linear-gradient(180deg,hsl(var(--card)/0.98),hsl(var(--muted)/0.76))] text-foreground shadow-[0px_8px_18px_-16px_rgba(15,23,42,0.26),0px_2px_0px_0px_rgba(73,84,96,0.16)] hover:-translate-y-px hover:bg-[linear-gradient(180deg,hsl(var(--card)),hsl(var(--muted)/0.92))] active:translate-y-[1px] active:shadow-[0px_3px_10px_-10px_rgba(15,23,42,0.2),0px_1px_0px_0px_rgba(73,84,96,0.12)]",
        secondary:
          "border border-secondary-border bg-[linear-gradient(180deg,hsl(var(--secondary)/0.92),hsl(var(--secondary)))] text-secondary-foreground shadow-[0px_10px_20px_-14px_rgba(15,23,42,0.28),0px_3px_0px_0px_hsl(var(--secondary-border)/0.95)] hover:-translate-y-px active:translate-y-[1px]",
        ghost: "border border-transparent bg-transparent text-foreground shadow-none hover:bg-[hsl(var(--muted)/0.75)]",
      },
      size: {
        default: "min-h-10 px-4 py-2.5",
        sm: "min-h-8 rounded-[0.85rem] px-3 text-xs",
        lg: "min-h-11 rounded-[1rem] px-8 text-sm",
        icon: "h-10 w-10 rounded-[0.95rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }

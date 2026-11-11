import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { twMerge } from 'tailwind-merge'
import { clsx } from 'clsx'
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary'|'secondary'|'ghost'|'danger'; asChild?: boolean }
export function Button({ className, variant='primary', asChild=false, ...props }: Props) { const Comp = asChild ? Slot : 'button'; return <Comp className={twMerge(clsx('button', `button-${variant}`, className))} {...props} /> }

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) { return <div className={twMerge('card',className)} {...props} /> }

import * as React from 'react'
import { twMerge } from 'tailwind-merge'
export const Input = React.forwardRef<HTMLInputElement,React.InputHTMLAttributes<HTMLInputElement>>(function Input({className,...props},ref){return <input ref={ref} className={twMerge('input',className)} {...props}/>})

'use client'
import { motion, useReducedMotion } from 'motion/react'
export function Reveal({children,className}:{children:React.ReactNode;className?:string}){const reduce=useReducedMotion();return <motion.div className={className} initial={reduce?false:{opacity:1,y:10}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.15}} transition={{duration:.45,ease:[.22,1,.36,1]}}>{children}</motion.div>}

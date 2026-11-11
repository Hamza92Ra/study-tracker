'use client'
import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'
export function SignOut(){return <button className="button button-secondary" onClick={()=>signOut({callbackUrl:'/manage/login'})}><LogOut size={16}/> Sign out</button>}

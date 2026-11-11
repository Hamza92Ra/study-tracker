import { PublicNav } from './nav'
import Link from 'next/link'
export function PublicShell({children}:{children:React.ReactNode}){return <div className="page"><PublicNav/>{children}<footer className="footer"><div className="container footer-inner"><span>Study Ledger · A thoughtful record of learning.</span><Link href="/manage/login">Owner sign in</Link></div></footer></div>}

'use client'

import Link from 'next/link'
import { useState } from 'react'

type BrandProps = {
  href?: string
  avatarUrl?: string | null
  displayName?: string | null
}

export function Brand({ href = '/', avatarUrl, displayName }: BrandProps) {
  const src = avatarUrl || ''
  const [failedUrl, setFailedUrl] = useState<string | null>(null)
  const showAvatar = Boolean(src) && failedUrl !== src

  return (
    <Link className="brand" href={href}>
      <span className={showAvatar ? 'brand-mark brand-mark-photo' : 'brand-mark'} aria-hidden="true">
        {showAvatar ? (
          // User-selected HTTPS images and optimized, locally uploaded data URLs both work here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={34} height={34} referrerPolicy="no-referrer" onError={() => setFailedUrl(src)} />
        ) : (
          <span className="brand-initials" title={displayName || 'Study Ledger'}>SL</span>
        )}
      </span>
      <span>STUDY<span className="brand-light">/LEDGER</span></span>
    </Link>
  )
}

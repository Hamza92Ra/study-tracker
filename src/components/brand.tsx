import Link from 'next/link'

type BrandProps = { href?: string }

// Stable site identity, shared by every member regardless of their personal avatar.
export function Brand({ href = '/' }: BrandProps) {
  return (
    <Link className="brand" href={href}>
      <span className="brand-mark brand-mark-site" aria-hidden="true">
        {/* The asset is the approved Study Ledger emblem. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/study-ledger-logo.webp" width={46} height={46} alt="" />
      </span>
      <span>STUDY<span className="brand-light">/LEDGER</span></span>
    </Link>
  )
}

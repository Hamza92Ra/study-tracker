import Link from 'next/link'
export default function NotFound(){return <main className="container public-main"><div className="card panel empty-state"><h1>Page not found</h1><p>The page you requested is unavailable.</p><Link className="button button-primary" href="/">Back to overview</Link></div></main>}

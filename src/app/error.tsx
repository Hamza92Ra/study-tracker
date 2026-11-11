'use client'
export default function Error({reset}:{error:Error;reset:()=>void}){return <main className="container public-main"><div className="card panel empty-state"><h1>We couldn’t load this page</h1><p>Please try again in a moment.</p><button className="button button-primary" onClick={reset}>Try again</button></div></main>}

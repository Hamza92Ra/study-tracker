export function duration(seconds: number) {
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const h = Math.floor(minutes / 60), m = minutes % 60
  return m ? `${h}h ${m}m` : `${h}h`
}
export function hours(seconds: number) { return (seconds / 3600).toFixed(1) }
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(x => x[0]?.toUpperCase()).join('') }
export function slugify(name: string) { return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'subject' }

import { useState } from 'react'

function hashHue(text: string): number {
  let hash = 0
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return hash % 360
}

function initials(name: string): string {
  const words = name.split(/[\s-_]+/).filter(Boolean)
  return (words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2)).toUpperCase()
}

interface CoverProps {
  id: string
  name: string
  url: string | null
  className?: string
  imgClassName?: string
}

/** Image du modpack, ou visuel généré à partir de son nom s'il n'en a pas. */
export function Cover({ id, name, url, className = '', imgClassName = '' }: CoverProps) {
  const [failed, setFailed] = useState(false)

  if (url && !failed) {
    return (
      <div className={`overflow-hidden bg-ink-800 ${className}`}>
        <img
          src={url}
          alt=""
          draggable={false}
          loading="lazy"
          onError={() => setFailed(true)}
          className={`size-full object-cover ${imgClassName}`}
        />
      </div>
    )
  }

  const hue = hashHue(id)
  // Le positionnement vient de `className` (souvent « absolute inset-0 ») : le contenu a son propre
  // conteneur relatif, sinon « relative » et « absolute » se contrediraient et le visuel ne remplirait pas le cadre.
  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{
        background: `radial-gradient(120% 90% at 20% 10%, hsl(${hue} 65% 42%), transparent 60%),
          linear-gradient(135deg, hsl(${(hue + 30) % 360} 55% 24%), hsl(${(hue + 70) % 360} 45% 12%))`
      }}
    >
      <div className="relative flex size-full items-center justify-center">
        <div className="pixel-grid absolute inset-0 opacity-70" />
        <span className="font-display text-[clamp(2.5rem,8vw,7rem)] font-bold tracking-tight text-white/15 select-none">
          {initials(name)}
        </span>
      </div>
    </div>
  )
}

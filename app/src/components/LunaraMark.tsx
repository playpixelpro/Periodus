import '../styles/brand.css'

export const LUNARA_CRESCENT_PATH =
  'M49.2 5.8C39.1 9.4 31.9 19.1 31.9 30.5c0 12.3 8.7 22.6 20.3 25A28.8 28.8 0 0 1 32 63C14.9 63 1 49.1 1 32S14.9 1 32 1c6.3 0 12.2 1.9 17.2 4.8Z'

interface LunaraMarkProps {
  className?: string
  decorative?: boolean
  label?: string
  size?: number
}

/**
 * The canonical Lunara brand mark.
 *
 * Keep the geometry in sync with the source SVGs under app/brand when native
 * launcher or splash assets are regenerated.
 */
export function LunaraMark({
  className = '',
  decorative = false,
  label = 'Periodus',
  size = 32,
}: LunaraMarkProps) {
  return (
    <img
      src="/icons/icon-192.png"
      alt={decorative ? '' : label}
      aria-hidden={decorative || undefined}
      width={size}
      height={size}
      className={`lunara-crescent brand-icon-img${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius: size > 40 ? '22%' : '6px',
        objectFit: 'contain',
        display: 'block',
      }}
      onError={(e) => {
        // Fallback to SVG if image fails
        e.currentTarget.style.display = 'none'
      }}
    />
  )
}

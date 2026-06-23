/**
 * AppIcon — Reusable Aynite logo component.
 *
 * Always renders with a light container background (even in dark mode)
 * and the Aynite "A" logo SVG. Designed to match the styling used in
 * the About tab and Home view.
 */

const APP_LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <circle cx="512" cy="512" r="512" fill="#403A35"/>
  <g transform="translate(512, 512)">
    <polygon points="-40,-324 40,-324 -180,320 -260,320" fill="#FFFFFF"/>
    <polygon points="-40,-324 40,-324 260,320 180,320" fill="#FFFFFF"/>
    <polygon points="-100,320 100,320 72.67,240 -72.67,240" fill="#FFFFFF"/>
  </g>
</svg>`

interface AppIconProps {
  /** Container size (e.g. "w-20 h-20"). The logo SVG fills proportionally inside. */
  containerClassName?: string
  /** Logo SVG size (e.g. "w-14 h-14"). */
  logoSvgClassName?: string
}

export function AppIcon({
  containerClassName = 'w-20 h-20',
  logoSvgClassName = 'w-14 h-14',
}: AppIconProps) {
  return (
    <div
      className={`${containerClassName} rounded-2xl bg-white flex items-center justify-center shadow-lg shadow-black/10 ring-1 ring-black/5 overflow-hidden`}
    >
      <div
        className={logoSvgClassName}
        style={{
          backgroundImage: `url("data:image/svg+xml;base64,${btoa(APP_LOGO_SVG)}")`,
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
        }}
      />
    </div>
  )
}

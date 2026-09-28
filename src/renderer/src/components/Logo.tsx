import { LOGO_PALETTE, LOGO_PIXELS } from '../../../shared/logo'

const rects = LOGO_PIXELS.flatMap((row, y) =>
  [...row].flatMap((key, x) => (LOGO_PALETTE[key] ? [{ x, y, fill: LOGO_PALETTE[key] }] : []))
)

export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={className}
      aria-hidden="true"
    >
      {rects.map(({ x, y, fill }) => (
        <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />
      ))}
    </svg>
  )
}

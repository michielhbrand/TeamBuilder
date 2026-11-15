const NICE_MULTIPLIERS = [1, 2, 5]

export function niceTicks(max: number, maxCount = 5): { ticks: number[]; top: number } {
  if (!(max > 0)) {
    return { ticks: [0, 1], top: 1 }
  }

  let step = 1
  for (let power = 1; ; power *= 10) {
    const found = NICE_MULTIPLIERS.map((multiplier) => multiplier * power).find(
      (candidate) => Math.ceil(max / candidate) + 1 <= maxCount,
    )
    if (found !== undefined) {
      step = found
      break
    }
  }

  const top = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = 0; value <= top; value += step) {
    ticks.push(value)
  }

  return { ticks, top }
}

export function axisMaxDays(values: number[]): number {
  const largest = values.length > 0 ? Math.max(...values) : 0

  return Math.max(40, Math.ceil(largest / 20) * 20)
}

export function dayTickStep(pixelsPerDay: number, minimumGap = 72): number {
  return [20, 40, 60].find((step) => step * pixelsPerDay >= minimumGap) ?? 60
}

export function thinStep(bandWidth: number, labelWidth: number): number {
  return Math.max(1, Math.ceil(labelWidth / Math.max(1, bandWidth)))
}

export function truncateLabel(text: string, pixels: number, charWidth = 6.8): string {
  const chars = Math.max(1, Math.floor(pixels / charWidth))

  return text.length > chars ? `${text.slice(0, Math.max(1, chars - 1))}…` : text
}

export function barPath(
  x: number,
  y: number,
  width: number,
  height: number,
  round: boolean,
): string {
  const r = round ? Math.min(4, height, width / 2) : 0
  const right = x + width
  const bottom = y + height

  if (r <= 0) {
    return `M${x},${y}H${right}V${bottom}H${x}Z`
  }

  return `M${x},${bottom}V${y + r}Q${x},${y} ${x + r},${y}H${right - r}Q${right},${y} ${right},${y + r}V${bottom}Z`
}

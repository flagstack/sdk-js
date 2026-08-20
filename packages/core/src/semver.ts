interface ParsedSemver {
  major: string
  minor: string
  patch: string
  prerelease: string[]
}

export function compareSemver(left: string, right: string): number | undefined {
  const parsedLeft = parseSemver(left)
  const parsedRight = parseSemver(right)
  if (!parsedLeft || !parsedRight) {
    return undefined
  }

  for (const key of ['major', 'minor', 'patch'] as const) {
    const comparison = compareIntegerStrings(parsedLeft[key], parsedRight[key])
    if (comparison !== 0) {
      return comparison
    }
  }
  return comparePrerelease(parsedLeft.prerelease, parsedRight.prerelease)
}

function parseSemver(input: string): ParsedSemver | undefined {
  const trimmed = input.trim()
  const value = trimmed.startsWith('v') ? trimmed : `v${trimmed}`
  const match = /^v(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?)?$/.exec(value)
  if (!match) {
    return undefined
  }
  const prerelease = match[4]?.split('.') ?? []
  if (prerelease.some((identifier) => /^\d+$/.test(identifier) && identifier.length > 1 && identifier.startsWith('0'))) {
    return undefined
  }
  return {
    major: match[1] as string,
    minor: match[2] ?? '0',
    patch: match[3] ?? '0',
    prerelease,
  }
}

function compareIntegerStrings(left: string, right: string): number {
  if (left === right) return 0
  if (left.length !== right.length) return left.length < right.length ? -1 : 1
  return left < right ? -1 : 1
}

function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0
  if (left.length === 0) return 1
  if (right.length === 0) return -1

  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    const leftIdentifier = left[index] as string
    const rightIdentifier = right[index] as string
    if (leftIdentifier === rightIdentifier) continue
    const leftNumeric = /^\d+$/.test(leftIdentifier)
    const rightNumeric = /^\d+$/.test(rightIdentifier)
    if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1
    if (leftNumeric) return compareIntegerStrings(leftIdentifier, rightIdentifier)
    return leftIdentifier < rightIdentifier ? -1 : 1
  }
  if (left.length === right.length) return 0
  return left.length < right.length ? -1 : 1
}

// Normalises a client IP address for rate limiting (feature 1, criterion 16).
// Pure TypeScript with no imports, so both the Deno edge function and Vitest can use it.
//
// - IPv4 is written as four plain decimal numbers.
// - IPv4-mapped IPv6 (::ffff:a.b.c.d) is treated as IPv4.
// - Other IPv6 is fully expanded, then only its first 64 bits are kept, because one
//   household or device usually owns a whole /64.
// Anything that doesn't parse returns null ("no usable IP").

function parseIpv4(text: string): number[] | null {
  const parts = text.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => (/^\d{1,3}$/.test(part) ? Number(part) : NaN))
  return octets.every((octet) => Number.isInteger(octet) && octet <= 255) ? octets : null
}

function parseIpv6(text: string): number[] | null {
  if (text.includes('%')) return null // zone IDs never come from a public client

  // A trailing IPv4 part (such as ::ffff:1.2.3.4) becomes two 16-bit groups.
  let address = text
  const lastColon = address.lastIndexOf(':')
  const tail = address.slice(lastColon + 1)
  if (tail.includes('.')) {
    const octets = parseIpv4(tail)
    if (!octets) return null
    const high = ((octets[0] << 8) | octets[1]).toString(16)
    const low = ((octets[2] << 8) | octets[3]).toString(16)
    address = `${address.slice(0, lastColon + 1)}${high}:${low}`
  }

  const halves = address.split('::')
  if (halves.length > 2) return null
  const head = halves[0] === '' ? [] : halves[0].split(':')
  const rest = halves.length === 2 && halves[1] !== '' ? halves[1].split(':') : []
  const missing = 8 - head.length - rest.length
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null

  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest]
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/i.test(group))) return null
  return groups.map((group) => parseInt(group, 16))
}

export function normalizeIp(raw: string): string | null {
  const text = raw.trim()
  if (text === '') return null

  const ipv4 = parseIpv4(text)
  if (ipv4) return ipv4.join('.')

  if (!text.includes(':')) return null
  const groups = parseIpv6(text)
  if (!groups) return null

  // ::ffff:a.b.c.d is an IPv4 address.
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    return [groups[6] >> 8, groups[6] & 0xff, groups[7] >> 8, groups[7] & 0xff].join('.')
  }

  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`
}

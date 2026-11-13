import { describe, expect, it } from 'vitest'
import { normalizeIp } from './ip.ts'

describe('normalizeIp', () => {
  it('keeps IPv4 as four plain numbers', () => {
    expect(normalizeIp('203.0.113.7')).toBe('203.0.113.7')
    expect(normalizeIp(' 203.0.113.7 ')).toBe('203.0.113.7')
    expect(normalizeIp('203.000.113.007')).toBe('203.0.113.7')
  })

  it('treats IPv4-mapped IPv6 as IPv4', () => {
    expect(normalizeIp('::ffff:203.0.113.7')).toBe('203.0.113.7')
    expect(normalizeIp('::FFFF:cb00:7107')).toBe('203.0.113.7')
    expect(normalizeIp('0:0:0:0:0:ffff:203.0.113.7')).toBe('203.0.113.7')
  })

  it('keeps the first 64 bits of IPv6, however it is written', () => {
    const expected = '2001:db8:0:1::/64'
    expect(normalizeIp('2001:db8:0:1::5')).toBe(expected)
    expect(normalizeIp('2001:0DB8:0000:0001:0000:0000:0000:0009')).toBe(expected)
    expect(normalizeIp('2001:db8:0:1:aaaa:bbbb:cccc:dddd')).toBe(expected)
  })

  it('expands :: before taking the first 64 bits', () => {
    // "2001:db8::1" means 2001:db8:0:0:0:0:0:1, so its /64 is 2001:db8:0:0.
    expect(normalizeIp('2001:db8::1')).toBe('2001:db8:0:0::/64')
    expect(normalizeIp('::1')).toBe('0:0:0:0::/64')
  })

  it('returns null for anything that is not an address', () => {
    for (const value of [
      '',
      'unknown',
      '256.1.1.1',
      '1.2.3',
      '1.2.3.4.5',
      '2001:db8:::1',
      '1:2:3:4:5:6:7:8:9',
      'fe80::1%eth0',
      'g::1',
    ]) {
      expect(normalizeIp(value)).toBeNull()
    }
  })
})

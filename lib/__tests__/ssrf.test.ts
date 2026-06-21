import { describe, it, expect } from 'vitest';
import { isPrivateIp } from '@/lib/ssrf';

describe('isPrivateIp', () => {
  it('flags loopback and private v4 ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.0.1', '169.254.169.254', '100.64.0.1', '0.0.0.0']) {
      expect(isPrivateIp(ip)).toBe(true);
    }
  });
  it('allows public v4 addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34', '172.15.0.1', '172.32.0.1']) {
      expect(isPrivateIp(ip)).toBe(false);
    }
  });
  it('flags loopback/link-local/ULA v6 and maps v4-in-v6', () => {
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('fe80::1')).toBe(true);
    expect(isPrivateIp('fc00::1')).toBe(true);
    expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
    expect(isPrivateIp('2606:4700:4700::1111')).toBe(false);
  });
  it('treats unparseable input as unsafe', () => {
    expect(isPrivateIp('not-an-ip')).toBe(true);
  });
});

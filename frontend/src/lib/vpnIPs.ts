/**
 * VPN / Tor / Anonymous Proxy IP detection.
 * Covers the most common exit node ranges used by attackers.
 */

interface VPNRange {
  prefix: string;
  provider: string;
}

const VPN_PREFIXES: VPNRange[] = [
  // Tor exit nodes
  { prefix: "185.220.101.", provider: "Tor Exit Node" },
  { prefix: "185.220.102.", provider: "Tor Exit Node" },
  { prefix: "185.220.103.", provider: "Tor Exit Node" },
  { prefix: "199.249.230.", provider: "Tor Exit Node" },
  { prefix: "192.42.116.",  provider: "Tor Exit Node" },
  { prefix: "176.10.99.",   provider: "Tor Exit Node" },
  { prefix: "62.102.148.",  provider: "Tor Exit Node" },
  { prefix: "171.25.193.",  provider: "Tor Exit Node" },
  // NordVPN
  { prefix: "185.220.",     provider: "NordVPN / Tor" },
  { prefix: "194.165.",     provider: "NordVPN" },
  { prefix: "77.247.110.",  provider: "NordVPN" },
  { prefix: "178.175.",     provider: "NordVPN" },
  // Mullvad VPN
  { prefix: "193.32.",      provider: "Mullvad VPN" },
  { prefix: "185.65.134.",  provider: "Mullvad VPN" },
  { prefix: "185.65.135.",  provider: "Mullvad VPN" },
  { prefix: "10.124.",      provider: "Mullvad VPN" },
  // ProtonVPN
  { prefix: "185.159.157.", provider: "ProtonVPN" },
  { prefix: "185.159.158.", provider: "ProtonVPN" },
  { prefix: "37.120.141.",  provider: "ProtonVPN" },
  // Surfshark
  { prefix: "156.146.",     provider: "Surfshark VPN" },
  { prefix: "45.80.151.",   provider: "Surfshark VPN" },
  { prefix: "89.187.175.",  provider: "Surfshark VPN" },
  // ExpressVPN
  { prefix: "119.13.",      provider: "ExpressVPN" },
  { prefix: "165.231.",     provider: "ExpressVPN" },
  // IPVanish
  { prefix: "198.8.",       provider: "IPVanish" },
  { prefix: "209.222.",     provider: "IPVanish" },
  // PIA (Private Internet Access)
  { prefix: "209.58.",      provider: "PIA VPN" },
  { prefix: "74.82.28.",    provider: "PIA VPN" },
  // Anonymous proxies / datacenter VPN hosts
  { prefix: "91.240.118.",  provider: "Anonymous Proxy" },
  { prefix: "95.173.136.",  provider: "VPN / Proxy" },
  { prefix: "80.66.76.",    provider: "Anonymous Proxy" },
  // Vultr (common cheap VPN hosting)
  { prefix: "95.179.",      provider: "Vultr VPN Host" },
  { prefix: "45.76.",       provider: "Vultr VPN Host" },
  { prefix: "45.77.",       provider: "Vultr VPN Host" },
  { prefix: "207.246.",     provider: "Vultr VPN Host" },
  // Linode / Akamai
  { prefix: "45.33.",       provider: "Linode VPN Host" },
  { prefix: "172.104.",     provider: "Linode VPN Host" },
  { prefix: "45.79.",       provider: "Linode VPN Host" },
  // Hetzner
  { prefix: "5.78.",        provider: "Hetzner VPN Host" },
  { prefix: "49.13.",       provider: "Hetzner VPN Host" },
  { prefix: "116.202.",     provider: "Hetzner VPN Host" },
  // DigitalOcean
  { prefix: "165.227.",     provider: "DigitalOcean VPN Host" },
  { prefix: "104.248.",     provider: "DigitalOcean VPN Host" },
  // OVH
  { prefix: "51.77.",       provider: "OVH VPN Host" },
  { prefix: "51.75.",       provider: "OVH VPN Host" },
];

const VPN_SPECIFIC: Record<string, string> = {
  "185.220.101.34": "Tor Exit Node",
  "91.240.118.222": "VPN / Proxy (RU)",
  "45.33.32.156":   "Linode VPN Host",
  "95.173.136.70":  "VPN / Proxy",
  "185.220.101.1":  "Tor Exit Node",
};

export function getVPNLabel(ip: string): string | null {
  if (!ip) return null;
  if (VPN_SPECIFIC[ip]) return VPN_SPECIFIC[ip];
  for (const { prefix, provider } of VPN_PREFIXES) {
    if (ip.startsWith(prefix)) return provider;
  }
  return null;
}

export function isVPN(ip: string): boolean {
  return getVPNLabel(ip) !== null;
}

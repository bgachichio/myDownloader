// Bech32m checksum check (BIP 350), used by the support test. Returns true for a valid address string.
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GEN = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function polymod(values) {
  let chk = 1;
  for (const v of values) {
    const top = chk >>> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ v;
    for (let i = 0; i < 5; i++) if ((top >>> i) & 1) chk ^= GEN[i];
  }
  return chk >>> 0;
}

export function isValidBech32m(address) {
  if (address !== address.toLowerCase()) return false;
  const pos = address.lastIndexOf('1');
  if (pos < 1 || pos + 7 > address.length || address.length > 90) return false;
  const hrp = address.slice(0, pos);
  const data = [];
  for (const ch of address.slice(pos + 1)) {
    const d = CHARSET.indexOf(ch);
    if (d === -1) return false;
    data.push(d);
  }
  const hrpExpanded = [...hrp].map((c) => c.charCodeAt(0) >> 5)
    .concat([0], [...hrp].map((c) => c.charCodeAt(0) & 31));
  return polymod(hrpExpanded.concat(data)) === 0x2bc830a3;
}

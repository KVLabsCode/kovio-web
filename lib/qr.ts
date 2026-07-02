import QRCode from 'qrcode';

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

// A PNG data URL — handy for embedding a QR as an <img src> in raw HTML (e.g. the
// self-contained full-screen player), where an inline SVG string is awkward.
export function qrPngDataUrl(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 512,
    errorCorrectionLevel: 'M',
    color: { dark: '#000000', light: '#ffffff' },
  });
}

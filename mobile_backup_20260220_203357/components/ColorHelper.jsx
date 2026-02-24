const hexToRgb = (hex) => {
  let c = hex.replace("#", "");

  if (c.length === 3) {
    c = c
      .split("")
      .map((x) => x + x)
      .join("");
  }

  const bigint = parseInt(c, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
};

const getLuminance = ({ r, g, b }) => {
  const normalize = (v) => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  };

  const R = normalize(r);
  const G = normalize(g);
  const B = normalize(b);

  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};

export default function getReadableTextColor(bgColor) {
  if (!bgColor) return "#FFFFFF";

  const rgb = hexToRgb(bgColor);
  const luminance = getLuminance(rgb);

  return luminance < 0.4 ? "#FFFFFF" : "#191918";
}

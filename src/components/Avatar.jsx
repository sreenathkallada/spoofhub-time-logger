export default function Avatar({ initials, color, name, size = 32 }) {
  const bg = color && /^#?[0-9a-f]{6}$/i.test(color) ? (color.startsWith('#') ? color : `#${color}`) : '#5B6470';
  return (
    <span className="avatar" style={{ background: bg, width: size, height: size, fontSize: size * 0.4 }} title={name}>
      {initials || (name || '?').slice(0, 1).toUpperCase()}
    </span>
  );
}

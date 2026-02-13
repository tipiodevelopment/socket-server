export function VioLogo({ className = "w-6 h-6", color = "white" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path
        d="M20 30 L50 90 L55 80 L30 30 Z"
        fill={color}
        opacity="0.9"
      />
      <path
        d="M50 90 L100 20 L85 20 L50 72 Z"
        fill={color}
      />
      <path
        d="M45 55 L70 55 L58 30 Z"
        fill={color}
      />
    </svg>
  );
}

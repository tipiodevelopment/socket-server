import { useTheme } from '@/contexts/ThemeContext';
import logoWhite from '@assets/vio-logo-white_1771918397529.png';
import logoBlack from '@assets/vio-logo-black_1771918397531.png';

export function VioLogo({ className = "h-6", size }: { className?: string; size?: 'sm' | 'md' | 'lg'; color?: string }) {
  const { theme } = useTheme();
  const src = theme === 'dark' ? logoWhite : logoBlack;
  const alt = 'Vio';

  const sizeClass = size === 'lg' ? 'h-8' : size === 'sm' ? 'h-4' : '';

  return (
    <img
      src={src}
      alt={alt}
      className={`${sizeClass || className} w-auto object-contain`}
      data-testid="img-vio-logo"
    />
  );
}

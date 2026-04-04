import type { SVGProps } from 'react';
import { useId } from 'react';

type TaskNebulaLogoProps = SVGProps<SVGSVGElement> & {
  compact?: boolean;
};

export function TaskNebulaLogo({ compact = false, className, ...props }: TaskNebulaLogoProps) {
  const size = compact ? 28 : 36;
  const baseId = useId().replace(/:/g, '');
  const shellId = `${baseId}-shell`;
  const coreId = `${baseId}-core`;
  const cloudBlueId = `${baseId}-cloud-blue`;
  const cloudVioletId = `${baseId}-cloud-violet`;
  const orbitId = `${baseId}-orbit`;
  const glowId = `${baseId}-glow`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <defs>
        <linearGradient id={shellId} x1="4.5" y1="4" x2="31.5" y2="32.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#171A24" />
          <stop offset="55%" stopColor="#0E1017" />
          <stop offset="100%" stopColor="#090A10" />
        </linearGradient>
        <radialGradient id={cloudBlueId} cx="36%" cy="38%" r="76%">
          <stop offset="0%" stopColor="#E9FBFF" />
          <stop offset="26%" stopColor="#88DEFF" />
          <stop offset="62%" stopColor="#417FFF" />
          <stop offset="100%" stopColor="rgba(65,127,255,0)" />
        </radialGradient>
        <radialGradient id={cloudVioletId} cx="62%" cy="48%" r="74%">
          <stop offset="0%" stopColor="#F1EAFF" />
          <stop offset="32%" stopColor="#A38CFF" />
          <stop offset="100%" stopColor="rgba(163,140,255,0)" />
        </radialGradient>
        <radialGradient id={coreId} cx="38%" cy="34%" r="72%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="44%" stopColor="#D6F6FF" />
          <stop offset="76%" stopColor="#7ED5FF" />
          <stop offset="100%" stopColor="#3F69FF" />
        </radialGradient>
        <linearGradient id={orbitId} x1="8.5" y1="27" x2="27.5" y2="9" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#5ED7FF" />
          <stop offset="56%" stopColor="#8C86FF" />
          <stop offset="100%" stopColor="#F7FBFF" />
        </linearGradient>
        <filter id={glowId} x="-42%" y="-42%" width="184%" height="184%">
          <feGaussianBlur stdDeviation="2.8" />
        </filter>
      </defs>

      <rect x="1" y="1" width="34" height="34" rx="10" fill={`url(#${shellId})`} stroke="rgba(255,255,255,0.11)" />

      <g opacity="0.88" filter={`url(#${glowId})`}>
        <circle cx="15.6" cy="17.2" r="6.6" fill={`url(#${cloudBlueId})`} />
        <circle cx="20.8" cy="18.8" r="5.9" fill={`url(#${cloudVioletId})`} opacity="0.82" />
      </g>

      <g opacity="0.9">
        <g>
          <ellipse cx="18" cy="18" rx="11.2" ry="5.25" fill="none" stroke={`url(#${orbitId})`} strokeWidth="1.45" />
          <circle cx="29.2" cy="18" r="1.12" fill="#F4FBFF" />
        </g>
        <g transform="rotate(60 18 18)">
          <ellipse cx="18" cy="18" rx="11.2" ry="5.25" fill="none" stroke={`url(#${orbitId})`} strokeWidth="1.45" />
          <circle cx="29.2" cy="18" r="1.04" fill="#72D8FF" />
        </g>
        <g transform="rotate(-60 18 18)">
          <ellipse cx="18" cy="18" rx="11.2" ry="5.25" fill="none" stroke={`url(#${orbitId})`} strokeWidth="1.45" />
          <circle cx="29.2" cy="18" r="1.04" fill="#A992FF" />
        </g>
      </g>

      <circle cx="18" cy="18" r="4.8" fill={`url(#${coreId})`} />
      <circle cx="18" cy="18" r="1.34" fill="#FFFFFF" opacity="0.96" />
    </svg>
  );
}

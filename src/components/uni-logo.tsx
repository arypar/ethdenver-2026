'use client';

export function UniLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="15" fill="url(#logo-grad)" fillOpacity="0.15" stroke="url(#logo-grad)" strokeWidth="1.2" />
      <path
        d="M12 22V14c0-2.2 1.8-4 4-4s4 1.8 4 4"
        stroke="url(#logo-grad)"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="20" cy="14" r="1.6" fill="#FF007A" />
      <circle cx="12" cy="22" r="1.6" fill="#D973A3" />
      <defs>
        <linearGradient id="logo-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#FF007A" />
          <stop offset="1" stopColor="#D973A3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

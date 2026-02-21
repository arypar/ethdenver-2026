'use client';

export function UniLogo({ className = 'w-7 h-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className}>
      <circle cx="16" cy="16" r="15" fill="url(#ct-grad)" fillOpacity="0.12" stroke="url(#ct-grad)" strokeWidth="1.2" />
      {/* Chain links */}
      <rect x="7" y="11" width="8" height="10" rx="4" stroke="url(#ct-grad)" strokeWidth="2" fill="none" />
      <rect x="17" y="11" width="8" height="10" rx="4" stroke="#FF007A" strokeWidth="2" fill="none" />
      {/* Overlap highlight */}
      <line x1="17" y1="13.5" x2="17" y2="18.5" stroke="#D973A3" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="ct-grad" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#FF007A" />
          <stop offset="1" stopColor="#D973A3" />
        </linearGradient>
      </defs>
    </svg>
  );
}

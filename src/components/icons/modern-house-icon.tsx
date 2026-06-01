import React from 'react';

export const ModernHouseIcon = ({ className = '', ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    {...props}
  >
    {/* Orange background with shadow built-in if needed, but we'll style it in CSS mostly. Just base shape here. */}
    <rect width="100" height="100" rx="24" fill="#FF5722" />
    
    {/* House Outline (White) */}
    <path
      d="M25 45L50 25L75 45V75H25V45Z"
      stroke="white"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Door */}
    <path
      d="M40 75V55H60V75"
      stroke="white"
      strokeWidth="8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

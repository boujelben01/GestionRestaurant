import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Base({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1.25em"
      height="1.25em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const MenuIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </Base>
)
export const CloseIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Base>
)
export const CartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 4h2.2l2 11h10.4l1.9-8H6.2" />
    <circle cx="9" cy="19.5" r="1.3" />
    <circle cx="17" cy="19.5" r="1.3" />
  </Base>
)
export const UserIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20c.8-3.6 3.7-5.4 7.5-5.4s6.7 1.8 7.5 5.4" />
  </Base>
)
export const EyeIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </Base>
)
export const EyeOffIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 3l18 18M10.6 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-3 3.8M6.3 7.4A15.7 15.7 0 0 0 2.5 12S6 18.5 12 18.5c1.5 0 2.8-.4 4-1M9.9 9.9a3 3 0 0 0 4.2 4.2" />
  </Base>
)
export const PhoneIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 4h3.5l1.7 4.3-2.2 1.4a11 11 0 0 0 6.3 6.3l1.4-2.2L20 15.5V19a1.5 1.5 0 0 1-1.6 1.5C10.7 20 4 13.3 3.5 5.6A1.5 1.5 0 0 1 5 4Z" />
  </Base>
)
export const MailIcon = (p: IconProps) => (
  <Base {...p}>
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7.5 8 6 8-6" />
  </Base>
)
export const PinIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
    <circle cx="12" cy="10" r="2.4" />
  </Base>
)
export const AlertIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 3.5 2.8 19.5h18.4L12 3.5ZM12 10v4.5M12 17.2v.1" />
  </Base>
)
export const CheckIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Base>
)
export const InfoIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.5M12 7.8v.1" />
  </Base>
)
export const ChevronDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m6 9.5 6 6 6-6" />
  </Base>
)
/** Flèche directionnelle : s'inverse automatiquement en RTL. */
export const ArrowIcon = ({ className = '', ...p }: IconProps) => (
  <Base className={`rtl:-scale-x-100 ${className}`} {...p}>
    <path d="M4.5 12h15M13.5 6l6 6-6 6" />
  </Base>
)
export const PlateIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="4.6" />
  </Base>
)
export const SearchIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </Base>
)
export const StarIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="m12 3.8 2.5 5.1 5.6.8-4 3.9.9 5.6-5-2.6-5 2.6.9-5.6-4-3.9 5.6-.8L12 3.8Z" />
  </Base>
)
export const ClockIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.2 2" />
  </Base>
)
export const ExternalIcon = ({ className = '', ...p }: IconProps) => (
  <Base className={`rtl:-scale-x-100 ${className}`} {...p}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 4 18.5v-11A1.5 1.5 0 0 1 5.5 6H10" />
  </Base>
)
export const MinusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 12h14" />
  </Base>
)
export const PlusIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M5 12h14" />
  </Base>
)
export const TrashIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5A1.5 1.5 0 0 0 8.5 21h7a1.5 1.5 0 0 0 1.5-1.5L18 7M9 7V4.5h6V7" />
  </Base>
)
export const BagIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M5 8h14l-1 12H6L5 8ZM9 8V6.5a3 3 0 0 1 6 0V8" />
  </Base>
)
export const BikeIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="6" cy="16" r="3.2" />
    <circle cx="18" cy="16" r="3.2" />
    <path d="M6 16l4-8h4l4 8M10 8H8M14 8l-2 8" />
  </Base>
)
export const TableIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M3 9h18M5 9l1 10M19 9l-1 10M12 9v10" />
  </Base>
)
export const BellIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16ZM10 20.5a2 2 0 0 0 4 0" />
  </Base>
)
export const BellOffIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M6 16V11a6 6 0 0 1 9-5.2M18 11v5l1.5 2h-15M10 20.5a2 2 0 0 0 4 0M3 3l18 18" />
  </Base>
)
export const EditIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4" />
  </Base>
)
export const ArrowUpIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 19V5M6 11l6-6 6 6" />
  </Base>
)
export const ArrowDownIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M12 5v14M6 13l6 6 6-6" />
  </Base>
)
export const SettingsIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
  </Base>
)
export const UsersIcon = (p: IconProps) => (
  <Base {...p}>
    <circle cx="9" cy="8.5" r="3.2" />
    <path d="M3 20c.6-3.4 3-5 6-5s5.4 1.6 6 5M16 5.5a3 3 0 0 1 0 6M18 15.2c1.6.7 2.7 2.2 3 4.8" />
  </Base>
)
export const ChartIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
  </Base>
)
export const RefreshIcon = (p: IconProps) => (
  <Base {...p}>
    <path d="M20 11a8 8 0 0 0-14.5-4M4 13a8 8 0 0 0 14.5 4M5 3v4h4M19 21v-4h-4" />
  </Base>
)
export const HeartIcon = ({ filled = false, ...p }: IconProps & { filled?: boolean }) => (
  <Base {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 7.5 2.7c0 5.6-7.5 10.2-7.5 10.2Z" />
  </Base>
)

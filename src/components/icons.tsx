import type { SVGProps } from 'react'

const PATHS = {
  closet: 'M12 4.5a1.75 1.75 0 1 1 1.75 1.75c-.97 0-1.75.78-1.75 1.75v.75M12 8.75 3.6 14.8c-.8.58-.39 1.85.6 1.85h15.6c.99 0 1.4-1.27.6-1.85L12 8.75Z',
  outfit: 'M8 3h8l1 4-3 2v12h-4V9L7 7l1-4ZM10 3c0 1.1.9 2 2 2s2-.9 2-2',
  sparkle: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8L19 16Z',
  bag: 'M5 8h14l-1 13H6L5 8ZM9 8V6a3 3 0 0 1 6 0v2',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21c.8-4 4-6 8-6s7.2 2 8 6',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM20 20l-4-4',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6 6 18',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4V8ZM12 17a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  thumbUp: 'M7 11v9H4v-9h3Zm0 0 4-7c1.5 0 2.5 1 2 3l-.5 3H19c1 0 1.8 1 1.5 2l-1.6 6c-.3 1.2-1.2 2-2.4 2H7',
  thumbDown: 'M7 13V4H4v9h3Zm0 0 4 7c1.5 0 2.5-1 2-3l-.5-3H19c1 0 1.8-1 1.5-2l-1.6-6C18.6 4.8 17.7 4 16.5 4H7',
  check: 'M5 12.5 10 17l9-10',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.5 2.5 3.5 5.5 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-5.5-3.5-9s1-6.5 3.5-9Z',
  briefcase: 'M4 8h16v11H4V8ZM9 8V5h6v3M4 13h16',
  dice: 'M5 5h14v14H5V5ZM9 9h.01M15 9h.01M12 12h.01M9 15h.01M15 15h.01',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 22, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  )
}

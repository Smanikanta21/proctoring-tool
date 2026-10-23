const paths = {
  shield: 'M12 3 4 6v6c0 4.5 8 9 8 9s8-4.5 8-9V6l-8-3Zm-4 9 3 3 5-6',
  grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
  book: 'M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4V4Zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3V4Z',
  camera: 'M15 8l6-3v14l-6-3M3 6h12v12H3z',
  screen: 'M3 4h18v13H3zM8 21h8M12 17v4',
  expand: 'M8 3H3v5M16 3h5v5M21 16v5h-5M3 16v5h5',
  check: 'm5 12 4 4L19 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  left: 'M20 12H4m6-6-6 6 6 6',
  clock: 'M12 8v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  flag: 'M5 21V3m0 1c6-4 8 4 14 0v10c-6 4-8-4-14 0',
  lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',
  activity: 'M3 12h4l3-8 4 16 3-8h4',
  info: 'M12 11v6m0-10v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  warning: 'm12 3 10 18H2L12 3Zm0 6v5m0 3v.1',
  wifi: 'M3 8a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 16a5 5 0 0 1 6 0m-3 4v.1',
  help: 'M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 3m0 4v.1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  close: 'm6 6 12 12M6 18 18 6',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  refresh: 'M20 7a8 8 0 1 0 1 8M20 3v5h-5',
};

export default function Icon({ name, size = 20, ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d={paths[name] || paths.info} />
    </svg>
  );
}

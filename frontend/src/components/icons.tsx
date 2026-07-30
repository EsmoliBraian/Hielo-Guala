import type { SVGProps } from "react";

/**
 * Minimal stroke-icon set (no external icon library dependency).
 * All icons inherit color via currentColor, default 20px, 1.75 stroke.
 */
function iconBase(props: SVGProps<SVGSVGElement>) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

/**
 * Brand mark — minimalist geometric fox head. Flat fills (not currentColor
 * like the utility icons above), since it's the logo, not a UI glyph.
 */
export function IconFoxLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={22}
      height={22}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      {...props}
    >
      <path
        d="M4 3 L12 11 L20 11 L28 3 L30 16 Q30 20 26 22 L20 27 Q16 31 12 27 L6 22 Q2 20 2 16 Z"
        fill="#FACC15"
      />
      <path d="M5 7 L10.5 10.2 L6.3 13.2 Z" fill="#FFFFFF" />
      <path d="M27 7 L21.5 10.2 L25.7 13.2 Z" fill="#FFFFFF" />
      <path d="M12 16.5 L20 16.5 L16 29 Z" fill="#FFFFFF" />
      <circle cx="12.6" cy="15" r="1.3" fill="#0F172A" />
      <circle cx="19.4" cy="15" r="1.3" fill="#0F172A" />
      <circle cx="16" cy="18.3" r="1" fill="#0F172A" />
    </svg>
  );
}

export function IconSnowflake(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 2v20M12 2l-2.5 2.5M12 2l2.5 2.5M12 22l-2.5-2.5M12 22l2.5-2.5" />
      <path d="M4.5 7l15 10M4.5 7l3.4.5M4.5 7l1-3.3" />
      <path d="M19.5 17l-15-10M19.5 17l-3.4-.5M19.5 17l-1 3.3" />
      <path d="M19.5 7l-15 10M19.5 7l-1-3.3M19.5 7l3.4.5" />
      <path d="M4.5 17l15-10M4.5 17l1 3.3M4.5 17l-3.4-.5" />
    </svg>
  );
}

export function IconPhone(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M6.6 10.8c1.4 2.8 3.8 5.2 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.5.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.2.2 2.4.6 3.5.1.4 0 .8-.2 1l-2.2 2.3Z" />
    </svg>
  );
}

export function IconClock(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconCheckCircle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.3 2.3L15.5 9.5" />
    </svg>
  );
}

export function IconAlertTriangle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 3.5 21.5 20h-19L12 3.5Z" />
      <path d="M12 10v4" />
      <path d="M12 17.2v.1" />
    </svg>
  );
}

export function IconPackage(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M21 8.5 12 4 3 8.5 12 13l9-4.5Z" />
      <path d="M3 8.5V16l9 4.5 9-4.5V8.5" />
      <path d="M12 13v7.5" />
    </svg>
  );
}

export function IconPlus(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconX(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  );
}

export function IconChevronDown(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconTag(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M20.5 12.5 12.8 20.2a1.5 1.5 0 0 1-2.1 0l-7-7a1.5 1.5 0 0 1 0-2.1L11.4 3.4a1.5 1.5 0 0 1 1-.4H19a1.5 1.5 0 0 1 1.5 1.5v6.6a1.5 1.5 0 0 1-.4 1Z" />
      <circle cx="16" cy="8" r="1.5" />
    </svg>
  );
}

export function IconTrendingUp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="m3 16 6-6 4 4 8-9" />
      <path d="M15 5h6v6" />
    </svg>
  );
}

export function IconInbox(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M3.5 12h4.2l1.6 2.5h5.4l1.6-2.5h4.2" />
      <path d="M5 5.5h14L21 12v6a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18v-6l2-6.5Z" />
    </svg>
  );
}

export function IconRefresh(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconBase(props)}>
      <path d="M3.5 12a8.5 8.5 0 0 1 14.6-5.9L20.5 8.5" />
      <path d="M20.5 4.5v4h-4" />
      <path d="M20.5 12a8.5 8.5 0 0 1-14.6 5.9L3.5 15.5" />
      <path d="M3.5 19.5v-4h4" />
    </svg>
  );
}

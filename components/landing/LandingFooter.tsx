import Image from "next/image";
import Link from "next/link";

const footerLinks = [
  {
    heading: "Company",
    links: [
      { label: "Privacy Policy", href: "#" },
      { label: "Terms of Service", href: "#" },
    ],
  },
  {
    heading: "Ecosystem",
    links: [
      { label: "Compliance", href: "#" },
      { label: "Security", href: "#" },
    ],
  },
  {
    heading: "Support",
    links: [{ label: "Status", href: "#" }],
  },
];

export default function LandingFooter() {
  return (
    <footer style={{ background: "#0a0f1e" }}>
      <div className="max-w-6xl mx-auto px-6 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2.5 mb-3">
              <Image
                src="/anaxi-logo.png"
                alt=""
                width={24}
                height={24}
                className="h-6 w-6 object-contain"
                style={{ opacity: 0.85 }}
              />
              <span
                className="text-sm font-semibold uppercase tracking-[0.1em]"
                style={{ color: "rgba(255,255,255,0.85)" }}
              >
                Anaxi
              </span>
            </div>
            <p
              className="text-xs leading-relaxed max-w-[200px]"
              style={{ color: "rgba(255,255,255,0.35)" }}
            >
              The modern academic ledger for progressive educational institutions globally.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.heading}>
              <h4
                className="text-2xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "rgba(255,255,255,0.28)" }}
              >
                {group.heading}
              </h4>
              <ul className="flex flex-col gap-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs transition-colors duration-150 footer-link"
                      style={{ color: "rgba(255,255,255,0.45)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="pt-6 flex items-center justify-between flex-wrap gap-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <p className="text-2xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            © 2025 Anaxi Institutional Intelligence. All rights reserved.
          </p>
          <p className="text-2xs" style={{ color: "rgba(255,255,255,0.18)" }}>
            Built for the world&apos;s most ambitious schools.
          </p>
        </div>
      </div>
    </footer>
  );
}

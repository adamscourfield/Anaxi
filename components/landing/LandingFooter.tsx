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
    <footer className="bg-white border-t border-[var(--outline-variant)]">
      <div className="max-w-6xl mx-auto px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1">
            <span className="text-lg font-semibold text-[var(--on-surface)]">Anaxi</span>
            <p className="text-xs text-[var(--on-surface-variant)] leading-relaxed mt-2 max-w-[200px]">
              The modern academic ledger for progressive educational institutions globally.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.heading}>
              <h4 className="text-2xs font-semibold uppercase tracking-widest text-[var(--on-surface-variant)] mb-3">
                {group.heading}
              </h4>
              <ul className="flex flex-col gap-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-[var(--on-surface-variant)] hover:text-[var(--on-surface)] transition-colors duration-150"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-6 border-t border-[var(--outline-variant)]">
          <p className="text-2xs text-[var(--on-surface-variant)]">
            © 2024 Anaxi Institutional Intelligence. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

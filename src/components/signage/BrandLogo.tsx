export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      <span className="text-brand-cream">Shake</span>
      <span className="text-brand-red">Tastic</span>
    </span>
  );
}

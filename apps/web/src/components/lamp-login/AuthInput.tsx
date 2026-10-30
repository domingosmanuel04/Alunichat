import type { InputHTMLAttributes, ReactNode } from 'react';

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon: ReactNode;
};

export function AuthInput({ label, icon, id, className = '', ...props }: AuthInputProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label htmlFor={inputId} className="block space-y-2">
      <span className="text-[13px] font-medium tracking-wide text-white/55">{label}</span>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35 transition-colors duration-300 group-focus-within:text-lamp-amber">
          {icon}
        </span>
        <input
          id={inputId}
          className={`w-full rounded-xl border border-white/10 bg-black/25 py-3.5 pl-11 pr-4 text-[15px] text-white/90 outline-none transition-all duration-300 placeholder:text-white/30 focus:border-lamp-amber/45 focus:bg-black/35 focus:shadow-[0_0_0_3px_rgba(245,194,107,0.12)] ${className}`}
          {...props}
        />
      </div>
    </label>
  );
}

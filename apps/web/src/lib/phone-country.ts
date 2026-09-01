/** Country dial-code helpers for contact phone display. */

export type PhoneCountry = {
  iso: string;
  name: string;
  dial: string;
  flag: string;
};

/** Longest prefixes first so e.g. +258 wins over +25. */
const COUNTRIES: PhoneCountry[] = [
  { iso: 'AO', name: 'Angola', dial: '244', flag: '🇦🇴' },
  { iso: 'MZ', name: 'Moçambique', dial: '258', flag: '🇲🇿' },
  { iso: 'CV', name: 'Cabo Verde', dial: '238', flag: '🇨🇻' },
  { iso: 'GW', name: 'Guiné-Bissau', dial: '245', flag: '🇬🇼' },
  { iso: 'ST', name: 'São Tomé e Príncipe', dial: '239', flag: '🇸🇹' },
  { iso: 'PT', name: 'Portugal', dial: '351', flag: '🇵🇹' },
  { iso: 'BR', name: 'Brasil', dial: '55', flag: '🇧🇷' },
  { iso: 'US', name: 'Estados Unidos', dial: '1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canadá', dial: '1', flag: '🇨🇦' },
  { iso: 'GB', name: 'Reino Unido', dial: '44', flag: '🇬🇧' },
  { iso: 'ES', name: 'Espanha', dial: '34', flag: '🇪🇸' },
  { iso: 'FR', name: 'França', dial: '33', flag: '🇫🇷' },
  { iso: 'DE', name: 'Alemanha', dial: '49', flag: '🇩🇪' },
  { iso: 'IT', name: 'Itália', dial: '39', flag: '🇮🇹' },
  { iso: 'NL', name: 'Países Baixos', dial: '31', flag: '🇳🇱' },
  { iso: 'BE', name: 'Bélgica', dial: '32', flag: '🇧🇪' },
  { iso: 'CH', name: 'Suíça', dial: '41', flag: '🇨🇭' },
  { iso: 'ZA', name: 'África do Sul', dial: '27', flag: '🇿🇦' },
  { iso: 'NG', name: 'Nigéria', dial: '234', flag: '🇳🇬' },
  { iso: 'KE', name: 'Quénia', dial: '254', flag: '🇰🇪' },
  { iso: 'GH', name: 'Gana', dial: '233', flag: '🇬🇭' },
  { iso: 'CI', name: 'Costa do Marfim', dial: '225', flag: '🇨🇮' },
  { iso: 'SN', name: 'Senegal', dial: '221', flag: '🇸🇳' },
  { iso: 'CM', name: 'Camarões', dial: '237', flag: '🇨🇲' },
  { iso: 'CD', name: 'RD Congo', dial: '243', flag: '🇨🇩' },
  { iso: 'CG', name: 'Congo', dial: '242', flag: '🇨🇬' },
  { iso: 'NA', name: 'Namíbia', dial: '264', flag: '🇳🇦' },
  { iso: 'ZW', name: 'Zimbábue', dial: '263', flag: '🇿🇼' },
  { iso: 'ZM', name: 'Zâmbia', dial: '260', flag: '🇿🇲' },
  { iso: 'BW', name: 'Botswana', dial: '267', flag: '🇧🇼' },
  { iso: 'AR', name: 'Argentina', dial: '54', flag: '🇦🇷' },
  { iso: 'CL', name: 'Chile', dial: '56', flag: '🇨🇱' },
  { iso: 'CO', name: 'Colômbia', dial: '57', flag: '🇨🇴' },
  { iso: 'MX', name: 'México', dial: '52', flag: '🇲🇽' },
  { iso: 'PE', name: 'Peru', dial: '51', flag: '🇵🇪' },
  { iso: 'UY', name: 'Uruguai', dial: '598', flag: '🇺🇾' },
  { iso: 'PY', name: 'Paraguai', dial: '595', flag: '🇵🇾' },
  { iso: 'IN', name: 'Índia', dial: '91', flag: '🇮🇳' },
  { iso: 'CN', name: 'China', dial: '86', flag: '🇨🇳' },
  { iso: 'AE', name: 'Emirados Árabes', dial: '971', flag: '🇦🇪' },
  { iso: 'SA', name: 'Arábia Saudita', dial: '966', flag: '🇸🇦' },
  { iso: 'TR', name: 'Turquia', dial: '90', flag: '🇹🇷' },
  { iso: 'PL', name: 'Polónia', dial: '48', flag: '🇵🇱' },
  { iso: 'RO', name: 'Roménia', dial: '40', flag: '🇷🇴' },
  { iso: 'UA', name: 'Ucrânia', dial: '380', flag: '🇺🇦' },
  { iso: 'RU', name: 'Rússia', dial: '7', flag: '🇷🇺' },
  { iso: 'JP', name: 'Japão', dial: '81', flag: '🇯🇵' },
  { iso: 'AU', name: 'Austrália', dial: '61', flag: '🇦🇺' },
].sort((a, b) => b.dial.length - a.dial.length);

export function digitsOnly(phone?: string | null): string {
  if (!phone) return '';
  return phone.replace(/@.*/, '').replace(/\D/g, '');
}

export function detectCountry(phone?: string | null): PhoneCountry | null {
  const digits = digitsOnly(phone);
  if (!digits) return null;
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && digits.length > c.dial.length + 4) {
      if (c.dial === '1' && digits.length !== 11) continue;
      return c;
    }
  }
  for (const c of COUNTRIES) {
    if (digits.startsWith(c.dial) && digits.length >= c.dial.length + 6) {
      return c;
    }
  }
  return null;
}

export function isPendingWhatsAppPhone(phone?: string | null): boolean {
  if (!phone) return false;
  return phone.includes('@lid');
}

export function formatPhoneDisplay(phone?: string | null): {
  country: PhoneCountry | null;
  e164: string;
  national: string;
  label: string;
  pending?: boolean;
} {
  if (!phone) {
    return { country: null, e164: '—', national: '—', label: '—', pending: false };
  }

  if (phone.includes('@lid')) {
    return {
      country: null,
      e164: 'Número a sincronizar',
      national: '—',
      label: 'Número a sincronizar',
      pending: true,
    };
  }

  const normalized = phone.includes('@s.whatsapp.net')
    ? phone.replace(/@.*/, '')
    : phone;

  const digits = digitsOnly(normalized);
  const country = detectCountry(digits);
  if (!digits) {
    return { country: null, e164: '—', national: '—', label: '—', pending: false };
  }
  if (!country && digits.length > 15) {
    return {
      country: null,
      e164: 'Número a sincronizar',
      national: '—',
      label: 'Número a sincronizar',
      pending: true,
    };
  }
  if (!country) {
    return {
      country: null,
      e164: `+${digits}`,
      national: digits,
      label: `+${digits}`,
      pending: false,
    };
  }
  const national = digits.slice(country.dial.length);
  const spaced =
    national.length > 6
      ? national.replace(/(\d{2,3})(?=\d)/g, '$1 ').trim()
      : national;
  return {
    country,
    e164: `+${country.dial} ${spaced}`,
    national: spaced,
    label: `${country.flag} +${country.dial} ${spaced}`,
    pending: false,
  };
}

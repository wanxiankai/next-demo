import { COMMON } from '@/constants';
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: process.env.NEXT_PUBLIC_BIZ_ENV === 'global' ? COMMON.INTL_SUPPORTED_LOCALES : COMMON.CN_SUPPORTED_LOCALES,

  // Used when no locale matches
  defaultLocale: process.env.NEXT_PUBLIC_BIZ_ENV === 'global' ? COMMON.INTL_DEFAULT_LOCALE : COMMON.CN_DEFAULT_LOCALE
});
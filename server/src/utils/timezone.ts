// US area code → IANA timezone mapping
// Covers the 4 main US continental timezones. Defaults to America/Los_Angeles (Pacific).

const EASTERN = 'America/New_York';
const CENTRAL = 'America/Chicago';
const MOUNTAIN = 'America/Denver';
const PACIFIC = 'America/Los_Angeles';

// Map area codes to the 4 US timezones. Covers ~90% of US numbers.

const AREA_CODE_TZ: Record<number, string> = {};

// Eastern Time area codes (most numerous — NY, FL, GA, OH, PA, VA, NC, etc.)
for (const code of [
  201, 202, 203, 207, 212, 215, 216, 220, 223, 234, 239, 240, 248, 251, 252, 256, 260, 267, 269, 272, 276, 301, 302,
  304, 305, 312, 313, 315, 317, 321, 326, 330, 334, 336, 339, 340, 341, 347, 351, 352, 364, 380, 386, 401, 404, 407,
  410, 412, 413, 419, 423, 434, 440, 443, 464, 470, 475, 478, 484, 502, 508, 513, 516, 517, 518, 540, 551, 557, 561,
  567, 570, 571, 574, 585, 586, 601, 603, 606, 607, 609, 610, 614, 616, 617, 631, 646, 656, 667, 678, 681, 689, 703,
  704, 706, 716, 717, 718, 724, 727, 732, 734, 740, 754, 757, 762, 764, 765, 769, 770, 772, 774, 781, 786, 802, 803,
  804, 810, 812, 813, 814, 828, 839, 843, 845, 848, 850, 856, 857, 859, 860, 862, 863, 864, 865, 878, 901, 904, 908,
  910, 912, 914, 917, 919, 920, 929, 931, 934, 937, 941, 947, 954, 959, 973, 978, 980, 984, 985,
]) {
  AREA_CODE_TZ[code] = EASTERN;
}

// Central Time area codes (TX, IL, MN, WI, MO, etc.)
for (const code of [
  205, 210, 214, 217, 219, 224, 225, 228, 229, 231, 254, 262, 270, 281, 309, 314, 316, 318, 319, 320, 325, 331, 346,
  361, 385, 405, 409, 414, 417, 430, 432, 469, 479, 501, 504, 507, 512, 515, 520, 563, 573, 580, 608, 612, 615, 618,
  620, 630, 636, 641, 651, 660, 662, 682, 701, 708, 712, 713, 714, 715, 731, 737, 763, 773, 779, 806, 815, 816, 817,
  830, 832, 835, 847, 870, 872, 903, 913, 915, 918, 936, 938, 940, 943, 952, 956, 972, 979,
]) {
  AREA_CODE_TZ[code] = CENTRAL;
}

// Mountain Time area codes (CO, AZ, NM, UT, MT, etc.)
for (const code of [303, 307, 385, 406, 435, 480, 505, 520, 575, 602, 623, 719, 720, 775, 801, 928, 970]) {
  AREA_CODE_TZ[code] = MOUNTAIN;
}

// Pacific Time area codes (CA, WA, OR, NV)
for (const code of [
  206, 208, 209, 213, 253, 310, 323, 341, 360, 408, 415, 424, 425, 442, 458, 503, 509, 510, 530, 541, 559, 562, 619,
  626, 628, 650, 657, 661, 669, 702, 707, 714, 725, 747, 760, 805, 818, 831, 858, 909, 916, 925, 949, 951, 971,
]) {
  AREA_CODE_TZ[code] = PACIFIC;
}

/**
 * Detect timezone from a US phone number using area code.
 * Returns IANA timezone string. Defaults to America/Los_Angeles (Pacific).
 */
export function timezoneFromPhone(phoneNumber: string): string {
  // Strip to digits only
  const digits = phoneNumber.replace(/\D/g, '');

  // US numbers: +1 (country code) + 10 digits, or just 10 digits
  let areaCode: number | undefined;
  if (digits.length === 11 && digits.startsWith('1')) {
    areaCode = parseInt(digits.substring(1, 4), 10);
  } else if (digits.length === 10) {
    areaCode = parseInt(digits.substring(0, 3), 10);
  }

  if (areaCode) {
    const tz = AREA_CODE_TZ[areaCode];
    if (tz) return tz;
  }

  return PACIFIC; // Default for "almost all in PST"
}

const QUIET_START = 21; // 9pm
const QUIET_END = 9; // 9am

function getHourInTimezone(timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  } catch {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: PACIFIC,
      hour: 'numeric',
      hour12: false,
    });
    return parseInt(formatter.format(new Date()), 10);
  }
}

/**
 * Check if it's currently quiet hours (9pm–9am) in the given timezone.
 */
export function isQuietHours(timezone: string): boolean {
  const hour = getHourInTimezone(timezone);
  return hour >= QUIET_START || hour < QUIET_END;
}

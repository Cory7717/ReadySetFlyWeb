/**
 * Format a price number to currency string
 * @param price - Number or string price value
 * @returns Formatted price like "$500,000" or empty string if invalid
 */
export function formatPrice(price: string | number | null | undefined): string {
  if (!price) return "";
  
  const numPrice = typeof price === "string" ? parseFloat(price) : price;
  
  if (isNaN(numPrice)) return "";
  
  return `$${numPrice.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format a phone number to standard US format
 * @param phone - Raw phone number string (digits only or with formatting)
 * @returns Formatted phone like "(512) 412-1762" or original if invalid
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");
  
  // Handle different lengths
  if (digits.length === 10) {
    // Standard US format: (XXX) XXX-XXXX
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else if (digits.length === 11 && digits[0] === "1") {
    // Handle leading 1: 1-XXX-XXX-XXXX becomes (XXX) XXX-XXXX
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  
  // Return original if not standard length
  return phone;
}

/**
 * Format phone number as user types in input field
 * @param value - Current input value
 * @returns Formatted value with proper spacing and dashes
 */
export function formatPhoneInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Format as user types
  if (digits.length <= 3) {
    return digits;
  } else if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  } else if (digits.length <= 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  } else {
    // Limit to 10 digits
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  }
}

/**
 * Format price as user types in input field  
 * @param value - Current input value
 * @returns Number string without formatting (for controlled input)
 */
export function formatPriceInput(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, "");
  
  // Return just digits (no commas) for input value
  // Display formatting will be handled separately
  return digits;
}

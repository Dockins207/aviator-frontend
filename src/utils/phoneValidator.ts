/**
 * Phone Number Validation Utility for Frontend
 * Supports Kenyan phone number formats
 */
export interface PhoneValidationResult {
  isValid: boolean;
  normalizedNumber?: string;
  error?: string;
  supportedFormats?: string[];
}

export class PhoneValidator {
  /**
   * Validate and normalize phone number
   * @param phoneNumber Raw phone number input
   * @returns Validation result with normalized number
   */
  static validate(phoneNumber: string): PhoneValidationResult {
    // Remove all non-digit characters
    const digitsOnly = phoneNumber.replace(/[^\d]/g, '');

    // Supported formats
    const supportedFormats = [
      '07XXXXXXXX',   // Safaricom, Airtel, Orange
      '01XXXXXXXX',   // Landline
      '254XXXXXXXXX'  // International format
    ];

    // Validation rules
    if (!digitsOnly) {
      return {
        isValid: false,
        error: 'Phone number cannot be empty',
        supportedFormats
      };
    }

    // Normalize local Kenyan formats
    let normalizedNumber = digitsOnly;
    
    // Convert local format (07/01) to international
    if (normalizedNumber.startsWith('07') || normalizedNumber.startsWith('01')) {
      normalizedNumber = '254' + normalizedNumber.slice(1);
    }

    // Validate international format
    const isValidFormat = /^254(7|1)\d{8}$/.test(normalizedNumber);

    if (!isValidFormat) {
      return {
        isValid: false,
        error: 'Invalid phone number format. Use 07XXXXXXXX or 254XXXXXXXXX',
        normalizedNumber,
        supportedFormats
      };
    }

    return {
      isValid: true,
      normalizedNumber,
      supportedFormats
    };
  }

  /**
   * Quick validation without detailed error information
   * @param phoneNumber Raw phone number input
   * @returns Boolean indicating validity
   */
  static isValid(phoneNumber: string): boolean {
    return this.validate(phoneNumber).isValid;
  }

  /**
   * Normalize phone number to international format
   * @param phoneNumber Raw phone number input
   * @returns Normalized phone number or null if invalid
   */
  static normalize(phoneNumber: string): string | null {
    const result = this.validate(phoneNumber);
    if (!result.isValid) return null;
    
    // Add + prefix for international format
    return `+${result.normalizedNumber}`;
  }
}

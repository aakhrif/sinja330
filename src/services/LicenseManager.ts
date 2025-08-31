import * as crypto from 'crypto';

export interface LicenseValidationResult {
  valid: boolean;
  error?: string;
  expiresAt?: Date;
  remainingTime?: string;
  payload?: any;
}

export class LicenseManager {
  private static readonly SECRET_KEY = 'VolumeBot-Secret-2025-Solana-Trading';

  /**
   * Validate a license key
   * @param licenseKey License key to validate
   * @returns Validation result
   */
  public static validateLicenseKey(licenseKey: string): LicenseValidationResult {
    try {
      if (!licenseKey || !licenseKey.startsWith('VB-')) {
        return { valid: false, error: 'Invalid license key format' };
      }

      // Extract payload and signature
      const keyPart = licenseKey.substring(3); // Remove 'VB-' prefix
      const [payloadB64, signature] = keyPart.split('.');

      if (!payloadB64 || !signature) {
        return { valid: false, error: 'Malformed license key' };
      }

      // Verify signature
      const hmac = crypto.createHmac('sha256', this.SECRET_KEY);
      hmac.update(payloadB64);
      const expectedSignature = hmac.digest('base64');

      if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid license key signature' };
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString());

      // Check expiry
      const now = Date.now();
      if (now > payload.exp) {
        const expiredDate = new Date(payload.exp).toLocaleString();
        return { valid: false, error: `License key expired on ${expiredDate}` };
      }

      // Calculate remaining time
      const remainingMs = payload.exp - now;
      const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
      const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

      return {
        valid: true,
        payload,
        expiresAt: new Date(payload.exp),
        remainingTime: `${remainingHours}h ${remainingMinutes}m`
      };

    } catch (error) {
      return { valid: false, error: 'Failed to validate license key' };
    }
  }

  /**
   * Check if license is valid and not expired
   * @param licenseKey License key to check
   * @returns True if valid and not expired
   */
  public static isValidLicense(licenseKey: string): boolean {
    const result = this.validateLicenseKey(licenseKey);
    return result.valid;
  }
}

/**
 * Normalizes a phone number to E.164-like format (without the '+')
 * for WhatsApp API compatibility.
 * 
 * Default country code is '92' (Pakistan).
 */
function normalizePhoneNumber(phone) {
    if (!phone) return null;

    // 1. Convert to string and remove all non-digits
    let normalized = phone.toString().replace(/\D/g, "");

    // 2. Handle '00' prefix (e.g., 0092... -> 92...)
    if (normalized.startsWith("00")) {
        normalized = normalized.slice(2);
    }

    // 3. Handle numbers starting with '0' (e.g., 0306... -> 92306...)
    if (normalized.startsWith("0")) {
        normalized = "92" + normalized.slice(1);
    }

    // 4. Handle cases where the number is already just the subscriber part (e.g., 306...)
    if (normalized.length === 10 && normalized.startsWith("3")) {
        normalized = "92" + normalized;
    }

    return normalized;
}

module.exports = {
    normalizePhoneNumber
};

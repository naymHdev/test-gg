import { parsePhoneNumberFromString } from 'libphonenumber-js';

export const isValidPhoneNumber = (phoneNumber: string): boolean => {
    if (!phoneNumber) return false;

    try {
        const parsed = parsePhoneNumberFromString(phoneNumber);

        // Return true only if valid format and real-world valid number
        return parsed ? parsed.isValid() : false;
    } catch (error) {
        return false;
    }
};

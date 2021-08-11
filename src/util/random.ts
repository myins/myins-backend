import crypto from "crypto";

export const randomCode = (length: number = 2) => {
    return crypto.randomBytes(length / 2).toString('hex');
}
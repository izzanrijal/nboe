// Airline-style booking code generator
// Pool excludes ambiguous chars: O/0/I/1
const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateBookingCode(length = 6): string {
  let code = "";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  for (let i = 0; i < length; i++) {
    code += CHARS[array[i] % CHARS.length];
  }
  return code;
}

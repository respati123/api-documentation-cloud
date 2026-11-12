export const PASSWORD_MIN_LENGTH = 10
export const PASSWORD_MAX_LENGTH = 256

export function isPasswordLengthValid(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && password.length <= PASSWORD_MAX_LENGTH
}

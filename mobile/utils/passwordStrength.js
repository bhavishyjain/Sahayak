const PASSWORD_MIN_LENGTH = 8;
const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const DIGIT_RE = /\d/;

export function getPasswordStrength(password) {
  const value = String(password || "");

  return {
    minLength: value.length >= PASSWORD_MIN_LENGTH,
    uppercase: UPPERCASE_RE.test(value),
    lowercase: LOWERCASE_RE.test(value),
    digit: DIGIT_RE.test(value),
  };
}

export function isStrongPassword(password) {
  const checks = getPasswordStrength(password);
  return Object.values(checks).every(Boolean);
}

export function getPasswordStrengthMessage(t) {
  return t("auth.passwordStrength.requirements");
}

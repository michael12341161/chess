export const PASSWORD_MIN_LENGTH = 12;

export function getPasswordIssues(password = '') {
  const checks = [
    { valid: password.length >= PASSWORD_MIN_LENGTH, message: `at least ${PASSWORD_MIN_LENGTH} characters` },
    { valid: /[a-z]/.test(password), message: 'a lowercase letter' },
    { valid: /[A-Z]/.test(password), message: 'an uppercase letter' },
    { valid: /\d/.test(password), message: 'a number' },
    { valid: /[^A-Za-z0-9]/.test(password), message: 'a symbol' },
  ];

  return checks.filter((check) => !check.valid).map((check) => check.message);
}

export function validatePassword(password = '') {
  const issues = getPasswordIssues(password);
  return {
    valid: issues.length === 0,
    issues,
    message: issues.length ? `Password must include ${issues.join(', ')}.` : '',
  };
}

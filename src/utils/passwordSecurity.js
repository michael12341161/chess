export const PASSWORD_MIN_LENGTH = 12;

const PASSWORD_CHECKS = [
  { valid: (password) => password.length >= PASSWORD_MIN_LENGTH, message: `at least ${PASSWORD_MIN_LENGTH} characters` },
  { valid: (password) => /[a-z]/.test(password), message: 'a lowercase letter' },
  { valid: (password) => /[A-Z]/.test(password), message: 'an uppercase letter' },
  { valid: (password) => /\d/.test(password), message: 'a number' },
  { valid: (password) => /[^A-Za-z0-9]/.test(password), message: 'a symbol' },
];

export function getPasswordIssues(password = '') {
  const issues = [];
  for (const check of PASSWORD_CHECKS) {
    if (!check.valid(password)) issues.push(check.message);
  }
  return issues;
}

export function validatePassword(password = '') {
  const issues = getPasswordIssues(password);
  return {
    valid: issues.length === 0,
    issues,
    message: issues.length ? `Password must include ${issues.join(', ')}.` : '',
  };
}

/**
 * Form validation utility functions
 */

export interface ValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

/**
 * Validates email format
 * @param email - Email string to validate
 * @returns True if valid email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates password strength
 * @param password - Password string to validate
 * @param minLength - Minimum required length
 * @returns True if password meets requirements
 */
export function isValidPassword(
  password: string,
  minLength: number = 6
): boolean {
  return password.length >= minLength;
}

/**
 * Validates that two passwords match
 * @param password - Original password
 * @param confirmPassword - Confirmation password
 * @returns True if passwords match
 */
export function passwordsMatch(
  password: string,
  confirmPassword: string
): boolean {
  return password === confirmPassword;
}

/**
 * Validates required field
 * @param value - Field value
 * @returns True if field has value
 */
export function isRequired(value: any): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return !isNaN(value);
  return value != null;
}

/**
 * Validates seller registration form
 * @param formData - Form data object
 * @param translations - Translation function
 * @returns Validation result with errors
 */
export function validateSellerForm(
  formData: any,
  translations?: any
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  // Email validation
  const trimmedEmail = formData.email?.trim();
  if (!trimmedEmail) {
    errors.email = translations?.("EmailRequired") || "Email is required";
    isValid = false;
  } else if (!isValidEmail(trimmedEmail)) {
    errors.email = translations?.("InvalidEmail") || "Invalid email format";
    isValid = false;
  }

  // Password validation
  if (!formData.password) {
    errors.password =
      translations?.("PasswordRequired") || "Password is required";
    isValid = false;
  } else if (!isValidPassword(formData.password, 6)) {
    errors.password =
      translations?.("PasswordTooShort") ||
      "Password must be at least 6 characters";
    isValid = false;
  }

  // Confirm password validation
  if (!formData.confirmPassword) {
    errors.confirmPassword =
      translations?.("ConfirmPasswordRequired") || "Please confirm password";
    isValid = false;
  } else if (!passwordsMatch(formData.password, formData.confirmPassword)) {
    errors.confirmPassword =
      translations?.("PasswordsDoNotMatch") || "Passwords do not match";
    isValid = false;
  }

  // Gender validation
  if (!formData.gender) {
    errors.gender = translations?.("GenderRequired") || "Gender is required";
    isValid = false;
  }

  // Age validation (if provided)
  if (
    formData.age &&
    (isNaN(formData.age) || formData.age < 0 || formData.age > 150)
  ) {
    errors.age = translations?.("InvalidAge") || "Please enter a valid age";
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validates category form
 * @param formData - Category form data
 * @param translations - Translation function
 * @returns Validation result with errors
 */
export function validateCategoryForm(
  formData: any,
  translations?: any
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  if (!formData.displayname || !formData.displayname.trim()) {
    errors.displayname =
      translations?.("DisplayNameRequired") || "Display name is required";
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validates specification form
 * @param formData - Specification form data
 * @param translations - Translation function
 * @returns Validation result with errors
 */
export function validateSpecificationForm(
  formData: any,
  translations?: any
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  if (!formData.displayname || !formData.displayname.trim()) {
    errors.displayname =
      translations?.("DisplayNameRequired") || "Display name is required";
    isValid = false;
  }

  if (!formData.product) {
    errors.product = translations?.("ProductRequired") || "Product is required";
    isValid = false;
  }

  // Validate custom attributes
  const validAttributes = formData.customAttributes?.filter(
    (attr: any) => attr.key.trim() && attr.value.trim()
  );

  if (!validAttributes || validAttributes.length === 0) {
    errors.attributes =
      translations?.("AttributesRequired") ||
      "At least one attribute is required";
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Validates option form (for variations)
 * @param formData - Option form data
 * @param variationShortname - Variation type shortname
 * @param translations - Translation function
 * @returns Validation result with errors
 */
export function validateOptionForm(
  formData: any,
  variationShortname: string,
  translations?: any
): ValidationResult {
  const errors: Record<string, string> = {};
  let isValid = true;

  // At least one name is required
  if (!formData.name_en?.trim() && !formData.name_ar?.trim()) {
    errors.name =
      translations?.("OptionNameRequired") ||
      "At least one option name is required";
    isValid = false;
  }

  // Color value is required for color variations
  if (variationShortname === "colors" && !formData.value?.trim()) {
    errors.value =
      translations?.("ColorValueRequired") || "Color value is required";
    isValid = false;
  }

  return { isValid, errors };
}

/**
 * Sanitizes string input (trims whitespace and removes dangerous characters)
 * @param input - Input string
 * @returns Sanitized string
 */
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[<>]/g, "");
}

/**
 * Validates and formats custom attributes array
 * @param attributes - Array of {key, value} objects
 * @returns Object with key-value pairs
 */
export function formatCustomAttributes(attributes: any[]): Record<string, any> {
  const result: Record<string, any> = {};

  attributes.forEach((attr: any) => {
    if (attr.key?.trim() && attr.value?.trim()) {
      result[sanitizeInput(attr.key)] = sanitizeInput(attr.value);
    }
  });

  return result;
}

/**
 * Checks if a shortname is valid (alphanumeric, underscore, hyphen)
 * @param shortname - Shortname to validate
 * @returns True if valid
 */
export function isValidShortname(shortname: string): boolean {
  const shortnameRegex = /^[a-zA-Z0-9_-]+$/;
  return shortnameRegex.test(shortname);
}

/**
 * Generates a shortname from a display name
 * @param displayName - Display name
 * @returns Generated shortname
 */
export function generateShortname(displayName: string): string {
  return displayName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

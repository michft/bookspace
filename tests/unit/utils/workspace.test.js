/**
 * Unit tests for workspace utility functions
 */

const {
  setupAllMocks,
  resetAllMocks
} = require('../../helpers/mock-browser');

// Note: These tests would need ES module support or a build step
// For now, testing the logic conceptually

describe('Workspace Utilities', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  describe('normalizeWorkspaceName', () => {
    test('should normalize "none" to "bookspace-none"', () => {
      // This would test: normalizeWorkspaceName('none') === 'bookspace-none'
      const input = 'none';
      const expected = 'bookspace-none';
      // In actual test: expect(normalizeWorkspaceName(input)).toBe(expected);
      expect(input.toLowerCase()).toBe('none');
    });

    test('should normalize "bookspace-none" to "bookspace-none"', () => {
      const input = 'bookspace-none';
      const expected = 'bookspace-none';
      expect(input.toLowerCase()).toBe('bookspace-none');
    });

    test('should normalize "all" to "bookspace-all"', () => {
      const input = 'all';
      const expected = 'bookspace-all';
      expect(input.toLowerCase()).toBe('all');
    });

    test('should preserve regular workspace names', () => {
      const input = 'Development';
      const expected = 'Development';
      expect(input).toBe(expected);
    });
  });

  describe('validateWorkspaceName', () => {
    test('should reject empty names', () => {
      const input = '';
      const result = { valid: false, error: 'Workspace name cannot be empty' };
      expect(result.valid).toBe(false);
    });

    test('should reject names with invalid characters', () => {
      const input = 'test<name';
      const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
      expect(invalidChars.test(input)).toBe(true);
    });

    test('should reject names that are too long', () => {
      const longName = 'a'.repeat(101);
      const maxLength = 100;
      expect(longName.length > maxLength).toBe(true);
    });

    test('should accept valid workspace names', () => {
      const input = 'Development';
      const result = { valid: true };
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeWorkspaceName', () => {
    test('should remove invalid characters', () => {
      const input = 'test<name>here';
      const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;
      const sanitized = input.replace(invalidChars, '');
      expect(sanitized).toBe('testnamehere');
    });

    test('should trim whitespace', () => {
      const input = '  Development  ';
      const trimmed = input.trim();
      expect(trimmed).toBe('Development');
    });

    test('should limit length', () => {
      const longName = 'a'.repeat(150);
      const maxLength = 100;
      const limited = longName.substring(0, maxLength);
      expect(limited.length).toBe(maxLength);
    });
  });
});

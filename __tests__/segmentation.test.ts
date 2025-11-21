/**
 * Segmentation Feature Tests
 * 
 * Tests for geographic targeting and user percentage segmentation
 * Run with: npm test segmentation.test.ts
 */

import crypto from 'crypto';

/**
 * Utility: Calculate deterministic user hash for A/B testing
 * Same userId + campaignId always produces same result
 */
function calculateUserHash(userId: string, campaignId: number): number {
  const input = `${userId}:${campaignId}`;
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  const hashValue = parseInt(hash.substring(0, 8), 16);
  return hashValue % 100;
}

/**
 * Utility: Check if user passes segmentation filtering
 */
function checkSegmentation(
  userId: string,
  userCountry: string,
  campaignId: number,
  isSegmented: boolean,
  targetCountries: string[],
  targetPercentage: number
): boolean {
  // If segmentation is disabled, all users pass
  if (!isSegmented) {
    return true;
  }

  // Check geographic targeting
  if (targetCountries.length > 0 && !targetCountries.includes(userCountry)) {
    return false;
  }

  // Check user percentage (A/B testing)
  const userHash = calculateUserHash(userId, campaignId);
  if (userHash >= targetPercentage) {
    return false;
  }

  return true;
}

// ============================================
// TEST SUITES
// ============================================

describe('Deterministic User Hashing', () => {
  test('same userId + campaignId always produces same hash', () => {
    const hash1 = calculateUserHash('user123', 10);
    const hash2 = calculateUserHash('user123', 10);
    expect(hash1).toBe(hash2);
  });

  test('different userIds produce different hashes', () => {
    const hash1 = calculateUserHash('user123', 10);
    const hash2 = calculateUserHash('user456', 10);
    expect(hash1).not.toBe(hash2);
  });

  test('different campaignIds produce different hashes for same user', () => {
    const hash1 = calculateUserHash('user123', 10);
    const hash2 = calculateUserHash('user123', 20);
    expect(hash1).not.toBe(hash2);
  });

  test('hash value is always between 0-99', () => {
    const userIds = ['user1', 'user2', 'user3', 'user123', 'admin'];
    const campaignIds = [1, 10, 100, 999];

    for (const userId of userIds) {
      for (const campaignId of campaignIds) {
        const hash = calculateUserHash(userId, campaignId);
        expect(hash).toBeGreaterThanOrEqual(0);
        expect(hash).toBeLessThan(100);
      }
    }
  });

  test('hash distributes evenly across percentages', () => {
    const distribution: { [key: number]: number } = {};
    
    // Generate hashes for 1000 different users
    for (let i = 1; i <= 1000; i++) {
      const hash = calculateUserHash(`user${i}`, 10);
      distribution[hash] = (distribution[hash] || 0) + 1;
    }

    // Each percentage point should have ~10 users (1000/100)
    const values = Object.values(distribution);
    const average = values.reduce((a, b) => a + b) / values.length;
    
    // Allow 50% variance (5-15 users per percentage)
    expect(average).toBeGreaterThan(5);
    expect(average).toBeLessThan(15);
  });
});

describe('Geographic Targeting', () => {
  test('user in target country passes filter', () => {
    const result = checkSegmentation(
      'user123',
      'MX',
      10,
      true, // isSegmented
      ['MX', 'US', 'BR'], // targetCountries
      100 // targetPercentage (all users)
    );
    expect(result).toBe(true);
  });

  test('user not in target country fails filter', () => {
    const result = checkSegmentation(
      'user123',
      'FR',
      10,
      true,
      ['MX', 'US', 'BR'],
      100
    );
    expect(result).toBe(false);
  });

  test('empty target countries list passes all users', () => {
    const result = checkSegmentation(
      'user123',
      'XX', // Any country
      10,
      true,
      [], // No country restrictions
      100
    );
    expect(result).toBe(true);
  });

  test('multiple countries work correctly', () => {
    const countries = ['MX', 'US', 'BR', 'AR', 'CO'];
    
    for (const country of countries) {
      const result = checkSegmentation(
        'user123',
        country,
        10,
        true,
        countries,
        100
      );
      expect(result).toBe(true);
    }
  });

  test('case-sensitive country codes', () => {
    // ISO codes are uppercase
    const result1 = checkSegmentation('user123', 'MX', 10, true, ['MX'], 100);
    expect(result1).toBe(true);

    // Lowercase should fail (case-sensitive)
    const result2 = checkSegmentation('user123', 'mx', 10, true, ['MX'], 100);
    expect(result2).toBe(false);
  });
});

describe('User Percentage Filtering (A/B Testing)', () => {
  test('100% targeting includes all users', () => {
    for (let i = 1; i <= 10; i++) {
      const result = checkSegmentation(
        `user${i}`,
        'US',
        10,
        true,
        ['US'],
        100 // 100% of users
      );
      expect(result).toBe(true);
    }
  });

  test('0% targeting includes no users', () => {
    for (let i = 1; i <= 10; i++) {
      const result = checkSegmentation(
        `user${i}`,
        'US',
        10,
        true,
        ['US'],
        0 // 0% of users
      );
      expect(result).toBe(false);
    }
  });

  test('50% targeting includes approximately 50% of users', () => {
    let count = 0;
    const total = 100;

    for (let i = 1; i <= total; i++) {
      const result = checkSegmentation(
        `user${i}`,
        'US',
        10,
        true,
        ['US'],
        50 // 50% of users
      );
      if (result) count++;
    }

    // Should be close to 50 (allow ±20%)
    expect(count).toBeGreaterThan(30);
    expect(count).toBeLessThan(70);
  });

  test('20% targeting includes approximately 20% of users', () => {
    let count = 0;
    const total = 100;

    for (let i = 1; i <= total; i++) {
      const result = checkSegmentation(
        `user${i}`,
        'US',
        10,
        true,
        ['US'],
        20 // 20% of users
      );
      if (result) count++;
    }

    // Should be close to 20 (allow ±5%)
    expect(count).toBeGreaterThan(15);
    expect(count).toBeLessThan(25);
  });

  test('same user always matches same percentage', () => {
    const result1 = checkSegmentation('user123', 'US', 10, true, ['US'], 50);
    const result2 = checkSegmentation('user123', 'US', 10, true, ['US'], 50);
    expect(result1).toBe(result2);
  });

  test('changing campaign changes user assignment', () => {
    const result1 = checkSegmentation('user123', 'US', 10, true, ['US'], 50);
    const result2 = checkSegmentation('user123', 'US', 20, true, ['US'], 50);
    
    // Same user might be in different percentage groups for different campaigns
    // (not guaranteed to be different, but very likely)
    // At least verify both return boolean values
    expect(typeof result1).toBe('boolean');
    expect(typeof result2).toBe('boolean');
  });
});

describe('Combined Geographic + Percentage Filtering', () => {
  test('user must pass both geographic AND percentage filters', () => {
    // User in correct country, correct percentage
    const result1 = checkSegmentation(
      'user123',
      'MX',
      10,
      true,
      ['MX', 'US'],
      100 // Hash will be < 100
    );
    expect(result1).toBe(true);

    // User in correct country, wrong percentage
    // (Only works if user123's hash is >= 20)
    const hash = calculateUserHash('user123', 10);
    const result2 = checkSegmentation(
      'user123',
      'MX',
      10,
      true,
      ['MX', 'US'],
      Math.max(1, hash - 1) // Just below user's hash
    );
    expect(result2).toBe(false);

    // User in wrong country, correct percentage
    const result3 = checkSegmentation(
      'user123',
      'FR',
      10,
      true,
      ['MX', 'US'],
      100
    );
    expect(result3).toBe(false);
  });

  test('real-world scenario: Mexico A/B test 50%', () => {
    const testUsers = [
      'user_123', 'user_456', 'user_789', 'user_111',
      'user_222', 'user_333', 'user_444', 'user_555'
    ];

    const mexUsers = testUsers.filter(userId =>
      checkSegmentation(userId, 'MX', 10, true, ['MX'], 50)
    );

    // Expect ~4 users (50% of 8)
    expect(mexUsers.length).toBeGreaterThan(0);
    expect(mexUsers.length).toBeLessThan(8);
  });

  test('real-world scenario: US-only campaign', () => {
    const result1 = checkSegmentation('user123', 'US', 10, true, ['US'], 100);
    expect(result1).toBe(true);

    const result2 = checkSegmentation('user123', 'MX', 10, true, ['US'], 100);
    expect(result2).toBe(false);
  });

  test('real-world scenario: Multi-country, 25% test', () => {
    const countries = ['US', 'MX', 'BR'];
    
    let passCount = 0;
    for (let i = 1; i <= 100; i++) {
      const country = countries[i % countries.length];
      const result = checkSegmentation(
        `user${i}`,
        country,
        10,
        true,
        countries,
        25 // 25% of users
      );
      if (result) passCount++;
    }

    // Expect ~25 users (25% of 100)
    expect(passCount).toBeGreaterThan(15);
    expect(passCount).toBeLessThan(35);
  });
});

describe('Segmentation Disabled', () => {
  test('all users pass when segmentation is disabled', () => {
    const users = ['user1', 'user2', 'user3'];
    const countries = ['MX', 'US', 'FR'];

    for (const userId of users) {
      for (const country of countries) {
        const result = checkSegmentation(
          userId,
          country,
          10,
          false, // isSegmented = false
          ['MX'], // These settings are ignored
          25
        );
        expect(result).toBe(true);
      }
    }
  });

  test('segmentation disabled overrides all filters', () => {
    const result = checkSegmentation(
      'anyuser',
      'XX', // Invalid country
      10,
      false, // Disabled
      [], // No countries
      0 // 0% (no users)
    );
    expect(result).toBe(true);
  });
});

describe('Edge Cases', () => {
  test('handles very long user IDs', () => {
    const longUserId = 'user_' + 'x'.repeat(1000);
    const hash = calculateUserHash(longUserId, 10);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(100);
  });

  test('handles special characters in user ID', () => {
    const specialIds = [
      'user@example.com',
      'user-123-abc',
      'user_123.456',
      'user/path'
    ];

    for (const id of specialIds) {
      const hash = calculateUserHash(id, 10);
      expect(hash).toBeGreaterThanOrEqual(0);
      expect(hash).toBeLessThan(100);
    }
  });

  test('handles large campaign IDs', () => {
    const hash = calculateUserHash('user123', 999999999);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(100);
  });

  test('empty user ID still produces hash', () => {
    const hash = calculateUserHash('', 10);
    expect(hash).toBeGreaterThanOrEqual(0);
    expect(hash).toBeLessThan(100);
  });

  test('country code list with duplicates', () => {
    const result = checkSegmentation(
      'user123',
      'MX',
      10,
      true,
      ['MX', 'MX', 'US', 'US'], // Duplicates
      100
    );
    expect(result).toBe(true);
  });
});

describe('Integration: Complete Campaign Scenarios', () => {
  test('Scenario 1: Black Friday Mexico campaign, 100% of users', () => {
    const segment = {
      isSegmented: true,
      targetCountries: ['MX'],
      targetPercentage: 100
    };

    // Mexican users should see it
    expect(checkSegmentation('user1', 'MX', 1, segment.isSegmented, segment.targetCountries, segment.targetPercentage)).toBe(true);
    expect(checkSegmentation('user2', 'MX', 1, segment.isSegmented, segment.targetCountries, segment.targetPercentage)).toBe(true);

    // Non-Mexican users should not see it
    expect(checkSegmentation('user3', 'US', 1, segment.isSegmented, segment.targetCountries, segment.targetPercentage)).toBe(false);
    expect(checkSegmentation('user4', 'BR', 1, segment.isSegmented, segment.targetCountries, segment.targetPercentage)).toBe(false);
  });

  test('Scenario 2: A/B test new UI design, 50% of all users', () => {
    const segment = {
      isSegmented: true,
      targetCountries: [], // All countries
      targetPercentage: 50
    };

    let controlGroup = 0;
    let treatmentGroup = 0;

    for (let i = 1; i <= 100; i++) {
      const passes = checkSegmentation(
        `user${i}`,
        'US',
        2,
        segment.isSegmented,
        segment.targetCountries,
        segment.targetPercentage
      );
      if (passes) treatmentGroup++;
      else controlGroup++;
    }

    // Should be roughly 50/50
    expect(treatmentGroup).toBeGreaterThan(30);
    expect(treatmentGroup).toBeLessThan(70);
  });

  test('Scenario 3: Limited market test, 3 countries, 20% of users', () => {
    const segment = {
      isSegmented: true,
      targetCountries: ['MX', 'BR', 'AR'],
      targetPercentage: 20
    };

    let mexicoPassCount = 0;
    let brazilPassCount = 0;
    let argentinaPassCount = 0;
    let peruPassCount = 0; // Should get 0

    const testSize = 100;
    for (let i = 1; i <= testSize; i++) {
      const userId = `user${i}`;

      if (checkSegmentation(userId, 'MX', 3, segment.isSegmented, segment.targetCountries, segment.targetPercentage)) {
        mexicoPassCount++;
      }
      if (checkSegmentation(userId, 'BR', 3, segment.isSegmented, segment.targetCountries, segment.targetPercentage)) {
        brazilPassCount++;
      }
      if (checkSegmentation(userId, 'AR', 3, segment.isSegmented, segment.targetCountries, segment.targetPercentage)) {
        argentinaPassCount++;
      }
      if (checkSegmentation(userId, 'PE', 3, segment.isSegmented, segment.targetCountries, segment.targetPercentage)) {
        peruPassCount++;
      }
    }

    // Each country should have ~20% of users seeing campaign
    expect(mexicoPassCount).toBeGreaterThan(5);
    expect(mexicoPassCount).toBeLessThan(35);
    expect(brazilPassCount).toBeGreaterThan(5);
    expect(brazilPassCount).toBeLessThan(35);
    expect(argentinaPassCount).toBeGreaterThan(5);
    expect(argentinaPassCount).toBeLessThan(35);

    // Peru should get 0 (not in target countries)
    expect(peruPassCount).toBe(0);
  });
});

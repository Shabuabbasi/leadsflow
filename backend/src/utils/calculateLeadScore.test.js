import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateLeadScore } from './calculateLeadScore.js';

test('scores a high-intent business lead near the top of the range', () => {
  const score = calculateLeadScore({
    email: 'buyer@company.com',
    phone: '+1 555 123 4567',
    service: 'Web Development',
    budgetRange: '$5000+',
    message:
      'We need a complete business website and are ready to start this month with an approved budget, detailed requirements, and an internal project team ready to collaborate.',
    source: 'wordpress',
  });

  assert.equal(score, 100);
});

test('scores a low-information lead lower and always stays in range', () => {
  const score = calculateLeadScore({
    email: 'person@gmail.com',
    phone: '123',
    service: 'UI/UX Design',
    budgetRange: 'Not specified',
    message: 'Call me',
    source: 'manual',
  });

  assert.equal(score, 33);
  assert.ok(score >= 0 && score <= 100);
});

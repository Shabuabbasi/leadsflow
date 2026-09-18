const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'hotmail.com',
  'outlook.com',
  'yahoo.com',
]);

function budgetScore(budgetRange = '') {
  const budget = budgetRange.toLowerCase().replace(/,/g, '');
  if (budget.includes('5000+')) return 40;
  if (budget.includes('1000') && budget.includes('5000')) return 30;
  if (budget.includes('500') && budget.includes('1000')) return 18;
  return 8;
}

function calculateLeadScore(lead) {
  let score = budgetScore(lead.budgetRange);

  const service = String(lead.service || '').toLowerCase();
  score += service.includes('web development') ? 15 : 10;

  const messageLength = String(lead.message || '').trim().length;
  score += messageLength >= 120 ? 20 : messageLength >= 50 ? 14 : 7;

  if (String(lead.phone || '').replace(/\D/g, '').length >= 10) score += 10;

  const emailDomain = String(lead.email || '').split('@')[1]?.toLowerCase();
  score += emailDomain && !FREE_EMAIL_DOMAINS.has(emailDomain) ? 10 : 5;

  score += lead.source === 'wordpress' ? 5 : 3;

  return Math.min(100, Math.max(0, score));
}

export { calculateLeadScore };

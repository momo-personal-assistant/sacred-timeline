/**
 * Company generator for graph datasets
 * Creates realistic B2B customer companies with tier-based attributes
 */

import { randomInt, randomChoice, randomPastDate } from '../../generate-samples/utils';
import { COMPANY_NAMES, INDUSTRIES } from '../config';
import type { Company } from '../types';

/**
 * Generate companies for a scenario
 * @param count Number of companies to generate
 * @returns Array of companies with tier distribution (20% enterprise, 40% growth, 40% startup)
 */
export function generateCompanies(count: number): Company[] {
  const companies: Company[] = [];

  for (let i = 0; i < count; i++) {
    // Tier distribution: 20% enterprise, 40% growth, 40% startup
    const tier: Company['tier'] =
      i < count * 0.2 ? 'enterprise' : i < count * 0.6 ? 'growth' : 'startup';

    // Employee count based on tier
    const employee_count =
      tier === 'enterprise'
        ? randomInt(500, 5000)
        : tier === 'growth'
          ? randomInt(50, 499)
          : randomInt(5, 49);

    companies.push({
      id: `company_${i + 1}`,
      name: COMPANY_NAMES[i % COMPANY_NAMES.length],
      tier,
      employee_count,
      industry: randomChoice(INDUSTRIES),
      created_at: randomPastDate(730), // Created within last 2 years
      metadata: {
        tier,
        priority: tier === 'enterprise' ? 'high' : tier === 'growth' ? 'medium' : 'normal',
      },
    });
  }

  return companies;
}

/**
 * Get company by ID
 */
export function getCompanyById(companies: Company[], id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}

/**
 * Get companies by tier
 */
export function getCompaniesByTier(companies: Company[], tier: Company['tier']): Company[] {
  return companies.filter((c) => c.tier === tier);
}

/**
 * Get random company
 */
export function randomCompany(companies: Company[]): Company {
  return randomChoice(companies);
}

/**
 * Get random company weighted by tier (enterprise more likely)
 */
export function randomCompanyWeighted(companies: Company[]): Company {
  // 50% chance to pick enterprise if available, 30% growth, 20% startup
  const roll = Math.random();

  const enterprises = companies.filter((c) => c.tier === 'enterprise');
  const growth = companies.filter((c) => c.tier === 'growth');
  const startups = companies.filter((c) => c.tier === 'startup');

  if (roll < 0.5 && enterprises.length > 0) {
    return randomChoice(enterprises);
  } else if (roll < 0.8 && growth.length > 0) {
    return randomChoice(growth);
  } else if (startups.length > 0) {
    return randomChoice(startups);
  }

  // Fallback to any company
  return randomChoice(companies);
}

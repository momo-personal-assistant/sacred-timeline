#!/usr/bin/env tsx
/**
 * Test script for Day 2: Company & User generators
 */

import { SCENARIO_NORMAL } from './config';
import { generateCompanies, getCompaniesByTier } from './generators/companies';
import { generateUsers, getUsersByRole } from './generators/users';

console.log('🧪 Testing Day 2: Company & User Generators\n');

// =============================================================================
// Test Companies
// =============================================================================

console.log('📊 Testing Company Generation...\n');

const companies = generateCompanies(SCENARIO_NORMAL.companies);

console.log(`✅ Generated ${companies.length} companies`);
console.log(`   Enterprise: ${getCompaniesByTier(companies, 'enterprise').length}`);
console.log(`   Growth:     ${getCompaniesByTier(companies, 'growth').length}`);
console.log(`   Startup:    ${getCompaniesByTier(companies, 'startup').length}`);

console.log('\n📋 Sample Companies:\n');
companies.slice(0, 3).forEach((company) => {
  console.log(`   ${company.name} (${company.tier})`);
  console.log(`      ID: ${company.id}`);
  console.log(`      Industry: ${company.industry}`);
  console.log(`      Employees: ${company.employee_count}`);
  console.log('');
});

// =============================================================================
// Test Users
// =============================================================================

console.log('👥 Testing User Generation...\n');

const users = generateUsers({
  customer: SCENARIO_NORMAL.users.customer,
  support: SCENARIO_NORMAL.users.support,
  engineering: SCENARIO_NORMAL.users.engineering,
  sales: SCENARIO_NORMAL.users.sales,
  product: SCENARIO_NORMAL.users.product,
  companies,
});

console.log(`✅ Generated ${users.length} users`);
console.log(`   Customer:    ${getUsersByRole(users, 'customer').length}`);
console.log(`   Support:     ${getUsersByRole(users, 'support').length}`);
console.log(`   Engineering: ${getUsersByRole(users, 'engineering').length}`);
console.log(`   Sales:       ${getUsersByRole(users, 'sales').length}`);
console.log(`   Product:     ${getUsersByRole(users, 'product').length}`);

console.log('\n📋 Sample Users:\n');

// Show one user from each role
const roles: Array<'customer' | 'support' | 'engineering' | 'sales' | 'product'> = [
  'customer',
  'support',
  'engineering',
  'sales',
  'product',
];

roles.forEach((role) => {
  const user = getUsersByRole(users, role)[0];
  if (user) {
    console.log(`   ${user.name} (${user.role})`);
    console.log(`      ID: ${user.id}`);
    console.log(`      Email: ${user.email}`);
    if (user.company_id) {
      const company = companies.find((c) => c.id === user.company_id);
      console.log(`      Company: ${company?.name}`);
    }
    console.log('');
  }
});

// =============================================================================
// Validation
// =============================================================================

console.log('✅ Validation Summary:\n');

// Check all customers have companies
const customersWithCompanies = users.filter((u) => u.role === 'customer' && u.company_id).length;
const totalCustomers = getUsersByRole(users, 'customer').length;

console.log(
  `   [${customersWithCompanies === totalCustomers ? '✅' : '❌'}] All customers have companies: ${customersWithCompanies}/${totalCustomers}`
);

// Check internal users don't have companies
const internalWithoutCompanies = users.filter((u) => u.role !== 'customer' && !u.company_id).length;
const totalInternal = users.length - totalCustomers;

console.log(
  `   [${internalWithoutCompanies === totalInternal ? '✅' : '❌'}] Internal users have no company: ${internalWithoutCompanies}/${totalInternal}`
);

// Check company tier distribution
const enterpriseCount = getCompaniesByTier(companies, 'enterprise').length;
const expectedEnterprise = Math.floor(companies.length * 0.2);
const enterpriseOk = Math.abs(enterpriseCount - expectedEnterprise) <= 1;

console.log(
  `   [${enterpriseOk ? '✅' : '❌'}] Enterprise tier ~20%: ${enterpriseCount}/${companies.length}`
);

console.log('\n✅ Day 2 Tests Complete!\n');

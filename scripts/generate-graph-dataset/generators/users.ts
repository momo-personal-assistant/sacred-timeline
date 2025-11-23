/**
 * User generator for graph datasets
 * Creates internal team members and customer users
 */

import { randomInt, randomChoice, randomPastDate } from '../../generate-samples/utils';
import type { User, Company } from '../types';

// =============================================================================
// Name Data
// =============================================================================

const FIRST_NAMES = [
  'Alice',
  'Bob',
  'Carol',
  'David',
  'Eve',
  'Frank',
  'Grace',
  'Henry',
  'Iris',
  'Jack',
  'Kate',
  'Leo',
  'Mary',
  'Nathan',
  'Olivia',
  'Peter',
  'Quinn',
  'Rachel',
  'Sam',
  'Tina',
  'Uma',
  'Victor',
  'Wendy',
  'Xander',
  'Yara',
  'Zoe',
  'Alex',
  'Blake',
  'Casey',
  'Drew',
  'Elliot',
  'Finley',
];

const LAST_NAMES = [
  'Smith',
  'Johnson',
  'Williams',
  'Brown',
  'Jones',
  'Garcia',
  'Miller',
  'Davis',
  'Rodriguez',
  'Martinez',
  'Hernandez',
  'Lopez',
  'Gonzalez',
  'Wilson',
  'Anderson',
  'Thomas',
  'Taylor',
  'Moore',
  'Jackson',
  'Martin',
  'Lee',
  'Walker',
  'Hall',
  'Allen',
  'Young',
  'King',
  'Wright',
  'Scott',
];

// =============================================================================
// Email Domain Data
// =============================================================================

const INTERNAL_DOMAINS = [
  'momo.ai', // Our company
];

const CUSTOMER_DOMAINS = [
  'acme.com',
  'techstart.io',
  'globalsoft.com',
  'dataflow.io',
  'cloudpeak.com',
  'innovatelabs.ai',
  'nextgen.io',
  'smartbiz.co',
];

// =============================================================================
// User Generation
// =============================================================================

/**
 * Generate users for a scenario
 */
export function generateUsers(params: {
  customer: number;
  support: number;
  engineering: number;
  sales: number;
  product: number;
  companies: Company[];
}): User[] {
  const users: User[] = [];
  let userIdCounter = 1;

  // Helper to create a user
  const createUser = (role: User['role'], company_id?: string): User => {
    const firstName = randomChoice(FIRST_NAMES);
    const lastName = randomChoice(LAST_NAMES);
    const name = `${firstName} ${lastName}`;

    // Email domain based on role
    const domain =
      role === 'customer' ? randomChoice(CUSTOMER_DOMAINS) : randomChoice(INTERNAL_DOMAINS);

    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;

    return {
      id: `user_${userIdCounter++}`,
      name,
      email,
      role,
      company_id,
      avatar_url: `https://i.pravatar.cc/150?img=${randomInt(1, 70)}`,
      created_at: randomPastDate(365),
      metadata: {
        role,
        is_internal: role !== 'customer',
      },
    };
  };

  // Generate customer users (distributed across companies)
  const companiesWithUsers = [...params.companies];
  for (let i = 0; i < params.customer; i++) {
    const company = companiesWithUsers[i % companiesWithUsers.length];
    users.push(createUser('customer', company.id));
  }

  // Generate internal users
  for (let i = 0; i < params.support; i++) {
    users.push(createUser('support'));
  }

  for (let i = 0; i < params.engineering; i++) {
    users.push(createUser('engineering'));
  }

  for (let i = 0; i < params.sales; i++) {
    users.push(createUser('sales'));
  }

  for (let i = 0; i < params.product; i++) {
    users.push(createUser('product'));
  }

  return users;
}

// =============================================================================
// User Query Helpers
// =============================================================================

/**
 * Get user by ID
 */
export function getUserById(users: User[], id: string): User | undefined {
  return users.find((u) => u.id === id);
}

/**
 * Get users by role
 */
export function getUsersByRole(users: User[], role: User['role']): User[] {
  return users.filter((u) => u.role === role);
}

/**
 * Get users by company
 */
export function getUsersByCompany(users: User[], companyId: string): User[] {
  return users.filter((u) => u.company_id === companyId);
}

/**
 * Get internal users (non-customers)
 */
export function getInternalUsers(users: User[]): User[] {
  return users.filter((u) => u.role !== 'customer');
}

/**
 * Get customer users
 */
export function getCustomerUsers(users: User[]): User[] {
  return users.filter((u) => u.role === 'customer');
}

/**
 * Get random user by role
 */
export function randomUserByRole(users: User[], role: User['role']): User {
  const filtered = getUsersByRole(users, role);
  if (filtered.length === 0) {
    throw new Error(`No users found with role: ${role}`);
  }
  return randomChoice(filtered);
}

/**
 * Get random user from company
 */
export function randomUserFromCompany(users: User[], companyId: string): User {
  const filtered = getUsersByCompany(users, companyId);
  if (filtered.length === 0) {
    throw new Error(`No users found for company: ${companyId}`);
  }
  return randomChoice(filtered);
}

/**
 * Get random internal user (for Slack threads)
 */
export function randomInternalUser(users: User[]): User {
  const internal = getInternalUsers(users);
  return randomChoice(internal);
}

/**
 * Get random customer user
 */
export function randomCustomerUser(users: User[]): User {
  const customers = getCustomerUsers(users);
  return randomChoice(customers);
}

/**
 * Get multiple random users by role
 */
export function randomUsersByRole(users: User[], role: User['role'], count: number): User[] {
  const filtered = getUsersByRole(users, role);
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, filtered.length));
}

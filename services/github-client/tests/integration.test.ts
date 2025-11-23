/**
 * Integration tests for GitHub Client
 *
 * These tests verify the GitHub API client works correctly with real GitHub data.
 * You need to set GITHUB_TOKEN environment variable to run these tests.
 *
 * Usage: GITHUB_TOKEN=your_token npm test
 */

import { GitHubClient } from '../src/client';

describe('GitHubClient Integration Tests', () => {
  let client: GitHubClient;
  const testOwner = 'octocat'; // Public GitHub user for testing
  const testRepo = 'Hello-World'; // Public repo for testing

  beforeAll(() => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error('GITHUB_TOKEN environment variable is required for integration tests');
    }

    client = new GitHubClient({ token });
  });

  describe('Authentication', () => {
    it('should authenticate successfully', async () => {
      const result = await client.authenticate();
      expect(result).toBe(true);
      expect(client.getAuthenticationStatus()).toBe(true);
    });
  });

  describe('Issues', () => {
    it('should fetch issues from a repository', async () => {
      const issues = await client.getIssues(testOwner, testRepo, {
        state: 'all',
        perPage: 10,
      });

      expect(Array.isArray(issues)).toBe(true);
      if (issues.length > 0) {
        const issue = issues[0];
        expect(issue).toHaveProperty('id');
        expect(issue).toHaveProperty('number');
        expect(issue).toHaveProperty('title');
        expect(issue).toHaveProperty('state');
        expect(issue).toHaveProperty('user');
        expect(issue).toHaveProperty('created_at');
        expect(issue).toHaveProperty('updated_at');
      }
    });

    it('should filter issues by state', async () => {
      const openIssues = await client.getIssues(testOwner, testRepo, {
        state: 'open',
        perPage: 5,
      });

      expect(Array.isArray(openIssues)).toBe(true);
      openIssues.forEach((issue) => {
        expect(issue.state).toBe('open');
      });
    });

    it('should fetch issue comments', async () => {
      const issues = await client.getIssues(testOwner, testRepo, {
        state: 'all',
        perPage: 5,
      });

      if (issues.length > 0) {
        const issueWithComments = issues.find((issue) => issue.comments > 0);

        if (issueWithComments) {
          const comments = await client.getIssueComments(
            testOwner,
            testRepo,
            issueWithComments.number
          );

          expect(Array.isArray(comments)).toBe(true);
          if (comments.length > 0) {
            const comment = comments[0];
            expect(comment).toHaveProperty('id');
            expect(comment).toHaveProperty('body');
            expect(comment).toHaveProperty('user');
            expect(comment).toHaveProperty('created_at');
          }
        }
      }
    });

    it('should handle pagination for getAllIssues', async () => {
      const allIssues = await client.getAllIssues(testOwner, testRepo, {
        state: 'all',
      });

      expect(Array.isArray(allIssues)).toBe(true);
      console.log(`Total issues fetched: ${allIssues.length}`);
    }, 60000); // Increase timeout for pagination
  });

  describe('Pull Requests', () => {
    it('should fetch pull requests from a repository', async () => {
      const prs = await client.getPullRequests(testOwner, testRepo, {
        state: 'all',
        perPage: 10,
      });

      expect(Array.isArray(prs)).toBe(true);
      if (prs.length > 0) {
        const pr = prs[0];
        expect(pr).toHaveProperty('id');
        expect(pr).toHaveProperty('number');
        expect(pr).toHaveProperty('title');
        expect(pr).toHaveProperty('state');
        expect(pr).toHaveProperty('user');
        expect(pr).toHaveProperty('head');
        expect(pr).toHaveProperty('base');
        expect(pr).toHaveProperty('created_at');
        expect(pr).toHaveProperty('updated_at');
        expect(pr.head).toHaveProperty('ref');
        expect(pr.base).toHaveProperty('ref');
      }
    });

    it('should filter pull requests by state', async () => {
      const closedPRs = await client.getPullRequests(testOwner, testRepo, {
        state: 'closed',
        perPage: 5,
      });

      expect(Array.isArray(closedPRs)).toBe(true);
      closedPRs.forEach((pr) => {
        expect(pr.state).toBe('closed');
      });
    });

    it('should fetch pull request reviews', async () => {
      const prs = await client.getPullRequests(testOwner, testRepo, {
        state: 'all',
        perPage: 10,
      });

      if (prs.length > 0) {
        // Find a merged PR which likely has reviews
        const prWithReviews = prs.find((pr) => pr.merged);

        if (prWithReviews) {
          const reviews = await client.getPullRequestReviews(
            testOwner,
            testRepo,
            prWithReviews.number
          );

          expect(Array.isArray(reviews)).toBe(true);
          if (reviews.length > 0) {
            const review = reviews[0];
            expect(review).toHaveProperty('id');
            expect(review).toHaveProperty('user');
            expect(review).toHaveProperty('state');
            expect(review).toHaveProperty('submitted_at');
          }
        }
      }
    });

    it('should fetch pull request review comments', async () => {
      const prs = await client.getPullRequests(testOwner, testRepo, {
        state: 'all',
        perPage: 10,
      });

      if (prs.length > 0) {
        const prWithComments = prs.find((pr) => pr.review_comments > 0);

        if (prWithComments) {
          const comments = await client.getPullRequestComments(
            testOwner,
            testRepo,
            prWithComments.number
          );

          expect(Array.isArray(comments)).toBe(true);
          if (comments.length > 0) {
            const comment = comments[0];
            expect(comment).toHaveProperty('id');
            expect(comment).toHaveProperty('body');
            expect(comment).toHaveProperty('user');
            expect(comment).toHaveProperty('created_at');
          }
        }
      }
    });

    it('should handle pagination for getAllPullRequests', async () => {
      const allPRs = await client.getAllPullRequests(testOwner, testRepo, {
        state: 'all',
      });

      expect(Array.isArray(allPRs)).toBe(true);
      console.log(`Total pull requests fetched: ${allPRs.length}`);
    }, 60000); // Increase timeout for pagination
  });

  describe('Rate Limiting', () => {
    it('should get rate limit status', async () => {
      const rateLimit = await client.getRateLimit();

      expect(rateLimit).toHaveProperty('core');
      expect(rateLimit).toHaveProperty('search');
      expect(rateLimit).toHaveProperty('graphql');

      expect(rateLimit.core).toHaveProperty('limit');
      expect(rateLimit.core).toHaveProperty('remaining');
      expect(rateLimit.core).toHaveProperty('reset');
      expect(rateLimit.core).toHaveProperty('resetDate');

      console.log(`Rate limit - Remaining: ${rateLimit.core.remaining}/${rateLimit.core.limit}`);
    });

    it('should check if rate limit is low', async () => {
      const isLow = await client.isRateLimitLow();
      expect(typeof isLow).toBe('boolean');
      console.log(`Rate limit is low: ${isLow}`);
    });
  });

  describe('Error Handling', () => {
    it('should handle repository not found', async () => {
      await expect(
        client.getIssues('nonexistent-owner-12345', 'nonexistent-repo-67890')
      ).rejects.toThrow();
    });

    it('should handle invalid issue number', async () => {
      await expect(client.getIssueComments(testOwner, testRepo, 999999999)).rejects.toThrow();
    });

    it('should handle invalid PR number', async () => {
      await expect(client.getPullRequestReviews(testOwner, testRepo, 999999999)).rejects.toThrow();
    });
  });
});

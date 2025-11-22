/**
 * Unit tests for GitHubClient
 */

import { GitHubClient } from '../src/client';
import { GitHubAuthenticationError, GitHubNotFoundError } from '../src/errors';

describe('GitHubClient', () => {
  describe('constructor', () => {
    it('should create a client with valid config', () => {
      const client = new GitHubClient({
        token: 'test_token',
      });

      expect(client).toBeInstanceOf(GitHubClient);
      expect(client.getAuthenticationStatus()).toBe(false);
    });

    it('should accept custom userAgent', () => {
      const client = new GitHubClient({
        token: 'test_token',
        userAgent: 'custom-agent',
      });

      expect(client).toBeInstanceOf(GitHubClient);
    });

    it('should accept custom baseUrl for GitHub Enterprise', () => {
      const client = new GitHubClient({
        token: 'test_token',
        baseUrl: 'https://github.enterprise.com/api/v3',
      });

      expect(client).toBeInstanceOf(GitHubClient);
    });
  });

  describe('authenticate', () => {
    it('should throw error when not authenticated before API calls', async () => {
      const client = new GitHubClient({ token: 'invalid_token' });

      await expect(client.listRepositories()).rejects.toThrow(GitHubAuthenticationError);
    });

    // Note: Real authentication tests require a valid token
    // and should be run in integration tests, not unit tests
  });

  describe('error handling', () => {
    it('should handle 404 errors', async () => {
      const client = new GitHubClient({ token: process.env.GITHUB_TOKEN || 'test' });

      // Try to get a repository that definitely doesn't exist
      await expect(
        client.getRepository('nonexistent-owner-xyz123', 'nonexistent-repo-xyz123')
      ).rejects.toThrow(GitHubNotFoundError);
    });
  });
});

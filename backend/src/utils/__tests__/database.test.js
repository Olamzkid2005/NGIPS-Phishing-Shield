process.env.NODE_ENV = 'test';
import { describe, it, expect, vi } from 'vitest';

// Mock Prisma before importing database
vi.mock('@prisma/client', () => {
  const mockClient = {
    PrismaClient: vi.fn().mockImplementation(() => ({
      $connect: vi.fn().mockResolvedValue(undefined),
      $disconnect: vi.fn().mockResolvedValue(undefined)
    }))
  };
  return mockClient;
});

describe('Database Module', () => {
  describe('getDatabase', () => {
    it('should export prisma client', async () => {
      // Test that module loads without error
      const { prisma } = await import('../database.js');
      expect(prisma).toBeDefined();
    });
  });
});
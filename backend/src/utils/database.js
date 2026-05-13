/**
 * Database Client - Prisma initialization and connection pooling
 */

import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  datasources: {
    db: {
      url: process.env.DATABASE_URL || `file:${join(__dirname, '../../prisma/dev.db')}`
    }
  }
});

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Graceful shutdown
async function disconnectPrisma() {
  try { await prisma.$disconnect(); } catch {}
}

process.on('beforeExit', disconnectPrisma);
process.on('SIGTERM', () => { disconnectPrisma().then(() => process.exit(0)); });
process.on('SIGINT', () => { disconnectPrisma().then(() => process.exit(0)); });

export default prisma;
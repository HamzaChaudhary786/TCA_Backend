const { Client } = require('pg');
const prisma = require('./db/prisma');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function fixLoginIssues() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL to fix session table...');

    // 1. Create session table if it doesn't exist
    const createSessionTable = `
      CREATE TABLE IF NOT EXISTS "session" (
        "sid" varchar NOT NULL COLLATE "default",
        "sess" json NOT NULL,
        "expire" timestamp(6) NOT NULL
      ) WITH (OIDS=FALSE);
      
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
          ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE;
        END IF;
      END $$;

      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON "session" ("expire");
    `;
    await client.query(createSessionTable);
    console.log('✅ Session table checked/created.');

    // 2. Ensure at least one Admin exists with hashed password
    const adminEmail = 'admin@example.com'; // Default or from env
    const password = 'password123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingAdmin = await prisma.user.findFirst({
      where: { userType: 'admin' }
    });

    if (!existingAdmin) {
      await prisma.user.create({
        data: {
          name: 'Main Admin',
          email: adminEmail,
          password: hashedPassword,
          userType: 'admin',
          isAccepted: true,
          subscriptionActive: true,
          subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
        }
      });
      console.log(`✅ Default admin created. Email: ${adminEmail}, Password: ${password}`);
    } else {
      // If user manually added an admin, it's probably unhashed. Let's fix it if it's the one they are trying.
      // Or just warn them. 
      console.log(`ℹ️ Admin already exists with email: ${existingAdmin.email}. Make sure the password was hashed with bcrypt.`);
    }

  } catch (err) {
    console.error('❌ Error fixing login issues:', err);
  } finally {
    await client.end();
    process.exit();
  }
}

fixLoginIssues();

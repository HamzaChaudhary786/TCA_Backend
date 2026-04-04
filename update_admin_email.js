const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const oldEmail = 'admin@example.com';
  const newEmail = 'admin@gmail.com';
  const password = 'password123';
  const hashedPassword = bcrypt.hashSync(password, 10);

  try {
    const admin = await prisma.user.findUnique({
      where: { email: oldEmail }
    });

    if (admin) {
      const updatedAdmin = await prisma.user.update({
        where: { id: admin.id },
        data: {
          email: newEmail,
          password: hashedPassword,
          isAccepted: true
        }
      });
      console.log(`✅ Admin updated! New Email: ${newEmail}, Password: ${password}`);
    } else {
      // If not found by email, find by userType admin
      const adminByType = await prisma.user.findFirst({
        where: { userType: 'admin' }
      });

      if (adminByType) {
        const updatedAdmin = await prisma.user.update({
          where: { id: adminByType.id },
          data: {
            email: newEmail,
            password: hashedPassword,
            isAccepted: true
          }
        });
        console.log(`✅ Admin updated! New Email: ${newEmail}, Password: ${password}`);
      } else {
        // Create if not exists at all
        await prisma.user.create({
          data: {
            name: 'Main Admin',
            email: newEmail,
            password: hashedPassword,
            userType: 'admin',
            isAccepted: true,
            subscriptionActive: true,
            subscriptionExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          }
        });
        console.log(`✅ New Admin created! Email: ${newEmail}, Password: ${password}`);
      }
    }
  } catch (error) {
    console.error('❌ Error updating admin:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

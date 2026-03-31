const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function main() {
  const email = 'admin@gmail.com';
  const newPassword = 'qwe123';
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  try {
    const user = await prisma.user.findUnique({
      where: { email: email }
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log(`✅ Password updated for ${email} to: ${newPassword}`);
    } else {
      console.log(`❌ User ${email} not found.`);
    }
  } catch (error) {
    console.error('❌ Error updating password:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

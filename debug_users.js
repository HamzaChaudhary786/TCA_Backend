const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      select: {
        email: true,
        userType: true
      }
    });
    console.log('USERS_START');
    users.forEach(u => console.log(`EMAIL: [${u.email}] TYPE: [${u.userType}]`));
    console.log('USERS_END');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

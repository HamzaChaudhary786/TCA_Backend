const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: 'admin'
        }
      },
      select: {
        email: true,
        userType: true
      }
    });
    console.log('--- Search Results for "admin" ---');
    console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

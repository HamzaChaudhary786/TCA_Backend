const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({
      where: {
        email: {
          contains: 'gmail.com'
        }
      },
      select: {
        email: true,
        userType: true
      }
    });
    console.log('--- Search Results for "gmail.com" ---');
    console.log(JSON.stringify(users, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

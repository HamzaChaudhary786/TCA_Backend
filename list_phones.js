const prisma = require('./db/prisma');

async function listAllStudentPhones() {
  try {
    const students = await prisma.user.findMany({
      where: { userType: 'student' },
      select: { name: true, guardianPhoneNumber: true, email: true },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    console.log('Students with Phones:', JSON.stringify(students, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

listAllStudentPhones();

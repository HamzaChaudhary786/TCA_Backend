const prisma = require('./db/prisma');

async function dumpStudents() {
  try {
    const students = await prisma.user.findMany({
      where: { userType: 'student' },
      select: { name: true, guardianPhoneNumber: true },
      take: 5
    });
    console.log('Sample Students:', JSON.stringify(students, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

dumpStudents();

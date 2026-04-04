const prisma = require('./db/prisma');

async function searchStudent() {
  try {
    const student = await prisma.user.findFirst({
      where: {
        userType: 'student',
        OR: [
          { guardianPhoneNumber: { contains: '3068361835' } },
          { guardianPhoneNumber: { contains: '923068361835' } }
        ]
      },
      select: { name: true, guardianPhoneNumber: true }
    });
    console.log('Found Student:', JSON.stringify(student, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

searchStudent();

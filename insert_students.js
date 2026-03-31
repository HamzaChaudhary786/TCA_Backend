const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const students = [
    { name: 'Ali Raza', email: 'ali1@gmail.com', phoneNumber: '0300000001' },
    { name: 'Ahmed Khan', email: 'ahmed1@gmail.com', phoneNumber: '0300000002' },
    { name: 'Usman Ali', email: 'usman1@gmail.com', phoneNumber: '0300000003' },
    { name: 'Hassan Raza', email: 'hassan1@gmail.com', phoneNumber: '0300000004' },
    { name: 'Bilal Ahmed', email: 'bilal1@gmail.com', phoneNumber: '0300000005' },
    { name: 'Saad Khan', email: 'saad1@gmail.com', phoneNumber: '0300000006' },
    { name: 'Zain Abbas', email: 'zain1@gmail.com', phoneNumber: '0300000007' },
    { name: 'Talha Javed', email: 'talha1@gmail.com', phoneNumber: '0300000008' },
    { name: 'Imran Shah', email: 'imran1@gmail.com', phoneNumber: '0300000009' },
    { name: 'Farhan Malik', email: 'farhan1@gmail.com', phoneNumber: '0300000010' }
  ];

  const commonPassword = '$2a$08$prXooFrDHt.jnRbMC9HaMuIMrhmUFA6pYJzDomyHBmfgSNjQyCkm6';

  try {
    const createdUsers = [];
    for (const s of students) {
      const user = await prisma.user.upsert({
        where: { email: s.email },
        update: {},
        create: {
          name: s.name,
          email: s.email,
          password: commonPassword,
          phoneNumber: s.phoneNumber,
          userType: 'student',
          isAccepted: true,
          isBlocked: false,
          isFirstLogin: true,
          subjects: []
        }
      });
      createdUsers.push(user.email);
    }
    console.log('✅ Successfully processed students:');
    console.log(createdUsers.join(', '));
  } catch (error) {
    console.error('❌ Error inserting students:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

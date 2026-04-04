const { Client } = require('pg');
require('dotenv').config();

async function checkTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  try {
    await client.connect();
    const res = await client.query("SELECT to_regclass('public.session')");
    console.log('Result:', res.rows[0]);
    if (res.rows[0].to_regclass) {
      console.log('✅ TABLE EXISTS');
    } else {
      console.log('❌ TABLE DOES NOT EXIST');
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

checkTable();

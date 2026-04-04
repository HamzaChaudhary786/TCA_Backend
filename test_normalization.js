const { normalizePhoneNumber } = require('./utils/whatsappUtils');

const testNumbers = [
    '03068361835',
    '923068361835',
    '+923068361835',
    '3068361835',
    '00923068361835'
];

console.log('--- Normalization Tests ---');
testNumbers.forEach(n => {
    console.log(`Original: ${n.padEnd(15)} | Normalized: ${normalizePhoneNumber(n)}`);
});

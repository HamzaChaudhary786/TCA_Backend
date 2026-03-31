const normalizeEmail = (email) => email.trim().toLowerCase();

const mockUser = {
  email: "admin@example.com"
};

function testNormalization(inputEmail) {
  const normalizedInput = normalizeEmail(inputEmail);
  const isMatch = normalizedInput === mockUser.email;
  console.log(`Input: [${inputEmail}] -> Normalized: [${normalizedInput}] -> Match: ${isMatch}`);
  return isMatch;
}

console.log("Testing email normalization logic...");
testNormalization("admin@example.com");
testNormalization("Admin@example.com");
testNormalization(" ADMIN@EXAMPLE.COM ");
testNormalization("admin@Example.com");

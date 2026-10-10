import bcrypt from 'bcryptjs';

const pw = process.argv[2];
if (!pw || pw.length < 8) {
  console.error('Usage: npm run hash-password -- "YourStrongPassword"   (min 8 characters)');
  process.exit(1);
}
console.log('\nPut this in ADMIN_PASSWORD_HASH:\n');
console.log(bcrypt.hashSync(pw, 12));
console.log('');

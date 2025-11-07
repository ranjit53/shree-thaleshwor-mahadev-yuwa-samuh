/**
 * Script to generate password hash for initial admin user
 * Run: node scripts/generate-password-hash.js
 */

const bcrypt = require('bcryptjs');

const password = process.argv[2] || 'admin123';

bcrypt.hash(password, 10).then(hash => {
  console.log('Password:', password);
  console.log('Hash:', hash);
  console.log('\nUpdate data/settings.json with this hash for the admin user.');
});


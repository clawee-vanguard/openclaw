#!/usr/bin/env node

const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Hide password input
rl.stdoutMuted = true;

rl.question('Enter password to hash: ', (password) => {
  rl.stdoutMuted = false;
  
  if (!password) {
    console.log('\nPassword cannot be empty');
    process.exit(1);
  }

  bcrypt.hash(password, 12, (err, hash) => {
    if (err) {
      console.error('\nError generating hash:', err.message);
      process.exit(1);
    } else {
      console.log('\nBcrypt hash generated:');
      console.log(hash);
      console.log('\nAdd this to your config under plugins.entries.openclaw-dashboard-auth.config.passwordHash');
    }
    rl.close();
  });
});

rl._writeToOutput = function(stringToWrite) {
  if (rl.stdoutMuted && stringToWrite !== '\n') {
    rl.output.write('*');
  } else {
    rl.output.write(stringToWrite);
  }
};
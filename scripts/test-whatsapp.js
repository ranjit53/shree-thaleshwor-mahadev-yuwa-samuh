/**
 * Test script for WhatsApp notifications
 * Run with: node scripts/test-whatsapp.js
 */

require('dotenv').config({ path: '.env.local' });

const {
  sendLoanNotification,
  sendPaymentNotification,
  sendSavingsNotification,
  sendFineNotification,
  sendExpenditureNotification
} = require('../src/lib/whatsapp.ts');

async function testWhatsAppNotifications() {
  console.log('🧪 Testing WhatsApp Notifications...\n');

  // Test data
  const testPhone = process.env.TEST_PHONE_NUMBER || '+9779812092516'; // Replace with your test number
  const testMemberName = 'Test Member';

  console.log('📱 Using test phone number:', testPhone);
  console.log('👤 Test member name:', testMemberName);
  console.log('');

  try {
    // Test Loan Notification
    console.log('1️⃣ Testing Loan Notification...');
    const loanResult = await sendLoanNotification(testPhone, testMemberName, {
      id: 'L-TEST-001',
      principal: 50000,
      interestRate: 20,
      termMonths: 6,
      startDate: '2025-12-30',
    });
    console.log('   Loan notification:', loanResult ? '✅ Sent' : '❌ Failed');
    console.log('');

    // Test Payment Notification
    console.log('2️⃣ Testing Payment Notification...');
    const paymentResult = await sendPaymentNotification(testPhone, testMemberName, {
      id: 'P-TEST-001',
      loanId: 'L-TEST-001',
      date: '2025-12-30',
      principalPaid: 5000,
      interestPaid: 1000,
      remarks: 'Monthly payment',
    });
    console.log('   Payment notification:', paymentResult ? '✅ Sent' : '❌ Failed');
    console.log('');

    // Test Savings Notification
    console.log('3️⃣ Testing Savings Notification...');
    const savingsResult = await sendSavingsNotification(testPhone, testMemberName, {
      id: 'S-TEST-001',
      date: '2025-12-30',
      amount: 2500,
      balance: 15000,
    });
    console.log('   Savings notification:', savingsResult ? '✅ Sent' : '❌ Failed');
    console.log('');

    // Test Fine Notification
    console.log('4️⃣ Testing Fine Notification...');
    const fineResult = await sendFineNotification(testPhone, testMemberName, {
      id: 'F-TEST-001',
      date: '2025-12-30',
      amount: 500,
      reason: 'Late payment fee',
    });
    console.log('   Fine notification:', fineResult ? '✅ Sent' : '❌ Failed');
    console.log('');

    // Test Expenditure Notification
    console.log('5️⃣ Testing Expenditure Notification...');
    const expenditureResult = await sendExpenditureNotification(testPhone, testMemberName, {
      id: 'E-TEST-001',
      date: '2025-12-30',
      amount: 10000,
      description: 'Office maintenance',
      category: 'Maintenance',
    });
    console.log('   Expenditure notification:', expenditureResult ? '✅ Sent' : '❌ Failed');
    console.log('');

    console.log('🎉 WhatsApp notification testing completed!');
    console.log('\n💡 Note: If messages were not sent, check:');
    console.log('   - SendWo credentials are correct');
    console.log('   - WhatsApp number is properly configured in SendWo');
    console.log('   - Phone number format is correct');
    console.log('   - Check SendWo dashboard/logs for detailed error messages');

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('   - Ensure all SendWo environment variables are set');
    console.log('   - Check that the WhatsApp number is properly configured in SendWo');
    console.log('   - Verify the test phone number can receive WhatsApp messages');
    console.log('   - Confirm SendWo API endpoint and authentication method');
  }
}

// Check environment variables
console.log('🔍 Checking environment variables...\n');

const requiredEnvVars = [
  'SENDWO_API_KEY',
  'SENDWO_WHATSAPP_NUMBER'
];

const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
  console.log('❌ Missing required environment variables:');
  missingVars.forEach(varName => console.log(`   - ${varName}`));
  console.log('\n📝 Please set these in your .env.local file');
  console.log('💡 Copy from .env.example and fill in your SendWo credentials');
  process.exit(1);
}

console.log('✅ All required environment variables are set\n');

// Run the test
testWhatsAppNotifications();

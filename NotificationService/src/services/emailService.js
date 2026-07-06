const nodemailer = require('nodemailer');

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  });
}

async function sendWinnerEmail(toEmail, giftName) {
  const transporter = createTransporter();
  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: toEmail,
    subject: 'זכית בהגרלה!',
    text: `מזל טוב! זכית במתנה: ${giftName}`
  });
  console.log(`Winner email sent to ${toEmail} for gift: ${giftName}`);
}

async function sendOrderFinalStateEmail(toEmail, status, reason) {
  const transporter = createTransporter();
  const normalizedStatus = status === 'Confirmed' ? 'confirmed' : 'compensated';
  const subject = normalizedStatus === 'confirmed'
    ? 'Your order was confirmed'
    : 'Your order was compensated';
  const text = normalizedStatus === 'confirmed'
    ? 'Your order has been confirmed successfully.'
    : `Your order could not be completed and was compensated.${reason ? ` Reason: ${reason}` : ''}`;

  await transporter.sendMail({
    from: process.env.FROM_EMAIL,
    to: toEmail,
    subject,
    text
  });

  console.log(`Order final-state email sent to ${toEmail}. Status=${status}`);
}

module.exports = { sendWinnerEmail, sendOrderFinalStateEmail };

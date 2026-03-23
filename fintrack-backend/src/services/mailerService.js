const inferHostByEmail = (email = '') => {
  const domain = String(email).split('@')[1]?.toLowerCase() || '';
  if (!domain) return null;

  if (domain === 'gmail.com') return 'smtp.gmail.com';
  if (domain === 'outlook.com' || domain === 'hotmail.com' || domain === 'live.com') return 'smtp.office365.com';
  if (domain === 'yandex.ru' || domain === 'yandex.com') return 'smtp.yandex.com';
  if (domain === 'mail.ru' || domain === 'inbox.ru' || domain === 'list.ru' || domain === 'bk.ru') return 'smtp.mail.ru';
  if (domain === 'icloud.com' || domain === 'me.com') return 'smtp.mail.me.com';

  return null;
};

const getSmtpConfig = () => {
  const user = process.env.SMTP_USER;
  const inferredHost = inferHostByEmail(user);
  const host = process.env.SMTP_HOST || inferredHost;
  const port = Number.parseInt(process.env.SMTP_PORT || '587', 10);
  const pass = process.env.SMTP_PASS;

  return { host, port, user, pass };
};

const isSmtpConfigured = () => {
  const { host, user, pass } = getSmtpConfig();
  return Boolean(host && user && pass);
};

const buildTransport = () => {
  const { host, port, user, pass } = getSmtpConfig();

  if (!isSmtpConfigured()) {
    throw Object.assign(new Error('Email xizmati sozlanmagan (kamida SMTP_USER va SMTP_PASS kerak)'), {
      statusCode: 400,
      code: 'SMTP_NOT_CONFIGURED',
    });
  }

  let nodemailer;
  try {
    // Lazy require: runtime dependency check
    // eslint-disable-next-line global-require
    nodemailer = require('nodemailer');
  } catch {
    throw Object.assign(new Error('nodemailer topilmadi. `npm install` ni qayta ishga tushiring'), {
      statusCode: 500,
      code: 'MAILER_DEPENDENCY_MISSING',
    });
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
};

const sendHouseholdInviteEmail = async ({ toEmail, inviterName, householdName, inviteLink }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transport = buildTransport();

  const subject = `FinTrack: ${inviterName} sizni "${householdName}" guruhiga taklif qildi`;
  const text = [
    `${inviterName} sizni FinTrack oilaviy guruhiga taklif qildi.`,
    `Guruh: ${householdName}`,
    '',
    'Taklifni qabul qilish uchun havola:',
    inviteLink,
    '',
    'Havola muddati cheklangan.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">
      <p><strong>${inviterName}</strong> sizni FinTrack oilaviy guruhiga taklif qildi.</p>
      <p>Guruh: <strong>${householdName}</strong></p>
      <p>
        <a href="${inviteLink}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none">
          Taklifni qabul qilish
        </a>
      </p>
      <p>Yoki ushbu linkni oching: <br/><a href="${inviteLink}">${inviteLink}</a></p>
    </div>
  `;

  await transport.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
};

const sendPasswordResetEmail = async ({ toEmail, userName, resetLink }) => {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const transport = buildTransport();

  const subject = 'FinTrack: parolni tiklash';
  const text = [
    `Salom${userName ? `, ${userName}` : ''}.`,
    '',
    'Parolni yangilash uchun ushbu havolani oching:',
    resetLink,
    '',
    'Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.',
  ].join('\n');

  const html = `
    <div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5;color:#0f172a">
      <p>Salom${userName ? `, <strong>${userName}</strong>` : ''}.</p>
      <p>Parolni yangilash uchun quyidagi tugmani bosing:</p>
      <p>
        <a href="${resetLink}" style="display:inline-block;padding:10px 14px;border-radius:8px;background:#2563eb;color:#fff;text-decoration:none">
          Parolni yangilash
        </a>
      </p>
      <p>Yoki ushbu linkni oching: <br/><a href="${resetLink}">${resetLink}</a></p>
      <p>Agar bu so‘rovni siz yubormagan bo‘lsangiz, xatni e’tiborsiz qoldiring.</p>
    </div>
  `;

  await transport.sendMail({
    from,
    to: toEmail,
    subject,
    text,
    html,
  });
};

module.exports = {
  sendHouseholdInviteEmail,
  sendPasswordResetEmail,
  isSmtpConfigured,
};

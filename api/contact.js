// api/contact.js

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  try {
    const {
      name,
      email,
      subject,
      message,
      attachment
    } = req.body || {};

    // Required fields
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill all required fields.'
      });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    // Maximum attachment size: approximately 4 MB
    if (attachment && attachment.content) {
      const base64Length = attachment.content.length;
      const fileSize = Math.ceil((base64Length * 3) / 4);

      if (fileSize > 4 * 1024 * 1024) {
        return res.status(400).json({
          success: false,
          message: 'Attachment is too large. Maximum size is 4 MB.'
        });
      }
    }

    // Brevo API key from Vercel Environment Variables
    const BREVO_API_KEY = process.env.BREVO_API_KEY;

    // Sender information
    const BREVO_SENDER_EMAIL =
      process.env.BREVO_SENDER_EMAIL ||
      'support.pipzone@gmail.com';

    const BREVO_SENDER_NAME =
      process.env.BREVO_SENDER_NAME ||
      'PipZoNe Support';

    if (!BREVO_API_KEY) {
      console.error('BREVO_API_KEY is missing.');

      return res.status(500).json({
        success: false,
        message: 'Email service is not configured.'
      });
    }

    // Escape HTML characters
    const escapeHtml = (value) => {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    };

    const safeName = escapeHtml(name);
    const safeEmail = escapeHtml(email);
    const safeSubject = escapeHtml(subject);
    const safeMessage = escapeHtml(message).replace(/\n/g, '<br>');

    // Email content
    const htmlContent = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222">

        <h2 style="margin-bottom:20px;">
          New Support Message — PipZoNe
        </h2>

        <p>
          <strong>Name:</strong><br>
          ${safeName}
        </p>

        <p>
          <strong>Email:</strong><br>
          ${safeEmail}
        </p>

        <p>
          <strong>Subject:</strong><br>
          ${safeSubject}
        </p>

        <p>
          <strong>Message:</strong><br>
          ${safeMessage}
        </p>

        ${
          attachment
            ? `
              <p>
                <strong>Attachment:</strong><br>
                ${escapeHtml(
                  attachment.name || 'Attached file'
                )}
              </p>
            `
            : ''
        }

        <hr style="margin-top:25px">

        <p style="font-size:12px;color:#777">
          This message was submitted through the PipZoNe website contact form.
        </p>

      </div>
    `;

    // Brevo email payload
    const emailData = {
      sender: {
        name: BREVO_SENDER_NAME,
        email: BREVO_SENDER_EMAIL
      },

      to: [
        {
          email: 'support.pipzone@gmail.com',
          name: 'PipZoNe Support'
        }
      ],

      replyTo: {
        email: email,
        name: name
      },

      subject: `PipZoNe Support: ${subject}`,

      htmlContent: htmlContent
    };

    // Add attachment if user selected one
    if (attachment && attachment.content) {
      emailData.attachment = [
        {
          name: attachment.name || 'attachment',
          content: attachment.content
        }
      ];
    }

    // Send through Brevo
    const brevoResponse = await fetch(
      'https://api.brevo.com/v3/smtp/email',
      {
        method: 'POST',

        headers: {
          'accept': 'application/json',
          'api-key': BREVO_API_KEY,
          'content-type': 'application/json'
        },

        body: JSON.stringify(emailData)
      }
    );

    const brevoData = await brevoResponse.json();

    if (!brevoResponse.ok) {
      console.error(
        'Brevo error:',
        brevoData
      );

      return res.status(500).json({
        success: false,
        message: 'Unable to send email right now.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Message sent successfully.',
      messageId: brevoData.messageId || null
    });

  } catch (error) {
    console.error(
      'Contact API error:',
      error
    );

    return res.status(500).json({
      success: false,
      message: 'Something went wrong while sending your message.'
    });
  }
}

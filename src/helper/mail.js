import Mailgen from "mailgen";
import config from "../config/config.js";

import { Resend } from "resend";

const sendEmail = async (options) => {
  const mailGenerator = new Mailgen({
    theme: "default",
    product: {
      name: "Amberis",
      link: "https://google.com",
    },
  });

  // const emailTextual = mailGenerator.generatePlaintext(options.mailContent);
  const emailHtml = mailGenerator.generate(options.mailContent);

  const resend = new Resend(config.RESEND_API_KEY);
  try {
    const { data } = await resend.emails.send({
      from: "Acme <onboarding@resend.dev>",
      to: [options.email],
      subject: options.subject,
      html: emailHtml,
    });
    console.log("email sent successfully", data);
  } catch (error) {
    console.error("Email failed to send");
    console.log("error", error);
  }
};

const emailVerificationContent = (username, verificationUrl) => {
  return {
    body: {
      name: username,
      intro: "Welcome to our App! We are excited to have you on board.",
      action: {
        instructions:
          "To verify your email please click on the following button",
        button: {
          color: "#000fff",
          text: "Verify your email",
          link: verificationUrl,
        },
      },
      outro:
        "Need help, or have questions? Just reply to this email, we'd love to help.",
    },
  };
};

export { sendEmail, emailVerificationContent };

const nodemailer = require("nodemailer")
const Mailgen = require("mailgen")
const config = require("../config/config")

const sendEmail = async (options)=>{
    const mailGenerator = new Mailgen({
        theme:"default",
        product:{
            name: "electroCart",
            link:"https://google.com"
        }
    })

    const emailTextual = mailGenerator.generatePlaintext(options.mailContent);
    const emailHtml = mailGenerator.generate(options.mailContent);


    const transporter = nodemailer.createTransport({
        service:"gmail",
        auth:{
            user: config.MAIL_SMTP_USER,
            pass:config.MAIL_SMTP_PASS
        }
    })

    const mail = {
        from: "test.@gmail.com",
        to:options.email,
        subject:options.subject,
        text:emailTextual,
        html:emailHtml
    }

    try {
        await transporter.sendMail(mail)
    } catch (error) {
    console.error(
      "Email service failed silently, make sure you provide mailtrap credentials in the .env",
    ); 
    console.log("error", error);
    }
}




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


module.exports = {
    sendEmail,
    emailVerificationContent
}
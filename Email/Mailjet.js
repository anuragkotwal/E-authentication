const apiKey = process.env.API_KEY_MAILJET
const SecretKey = process.env.SECRET_KEY_MAILJET
const mailjet = require ('node-mailjet')
.connect(`${apiKey}`,`${SecretKey}`);

const SendOtp = (toemail,firstname,lastname,otp) =>mailjet
    .post("send", {'version': 'v3.1'})
    .request({
    "Messages":[
        {
        "From": {
            "Email": process.env.SENDER_MAIL,
            "Name":"AuthService"
        },
        "To": [
            {
            "Email": toemail,
            }
        ],
        "Subject": "Verification",
        "HTMLPart": `   <html>
                        <body>
                        <div style="font-family: Helvetica,Arial,sans-serif;min-width:1000px;overflow:auto;line-height:2">
                        <div style="margin:50px auto;width:70%;padding:20px 0">
                        <div style="border-bottom:1px solid #eee">
                            <a href="" style="font-size:1.4em;color: #00466a;text-decoration:none;font-weight:600">Auth Service</a>
                        </div>
                        <p style="font-size:1.1em">Hi ${firstname} ${lastname},</p>
                        <p>Use the following OTP to complete your Log In procedure</p>
                        <h2 style="background: #00466a;margin: 0 auto;width: max-content;padding: 0 10px;color: #fff;border-radius: 4px;">${otp}</h2>
                        <p style="font-size:0.9em;">Regards,<br />Auth Service</p>
                        <hr style="border:none;border-top:1px solid #eee" />
                        <div style="float:right;padding:8px 0;color:#aaa;font-size:0.8em;line-height:1;font-weight:300">
                        </div>
                        </div>
                        </div>
                        </body>
                    </html>`,
        "CustomID": "AppGettingStartedTest"
        }
    ]
    })

module.exports = SendOtp;
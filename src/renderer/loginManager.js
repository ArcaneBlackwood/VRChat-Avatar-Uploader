import { Popups } from "./popups.js";

export const LoginManager = {
	init(form) {
		this.form = form;
		const loginUsername = form.querySelector("#username");
		const loginPassword = form.querySelector("#password");
		const loginSave = form.querySelector("#savelogin");
		const loginInfo = form.querySelector("#loginInfo");
		form.addEventListener("submit", function(e) {
			e.preventDefault();
			eventSend.loginAttempt({
				username: loginUsername.value,
				password: loginPassword.value,
				save: loginSave.checked
			});
		});
		function setLoginInfo(message) {
			loginInfo.innerText = message;
			console.log("Set login info: " + message);
		}
		document.body.addEventListener("screenswitch", ({screen}) => {
			if (screen == "login")
				setLoginInfo("");
		});
		window.eventRecv.setLoginInfo((e,message)=>setLoginInfo(message));
		window.eventRecv.setLoginSave((e,state) => {
			loginSave.checked = state;
		});
		eventRecv.request2FA((e,{type}) => {
			const messages = {
				"otp": "Enter your 2FA code from your phone, or authenticator",
				"emailOtp": "Enter your 2FA code from your email",
			};
			setLoginInfo(messages[type]);
			Popups.popup2FA(messages[type], code=>{
				eventSend.submit2FA({
					type,
					code
				});
			});
		});
	}
};
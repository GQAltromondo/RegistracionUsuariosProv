sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/m/MessageToast"
], function (BaseController, MessageToast) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.ForgotPassword", {

		onNavBack: function () {
			this.navTo("Login");
		},

		onSendReset: function () {
			const sMail = this.byId("emailForgot").getValue().trim();

			if (!sMail) {
				MessageToast.show("Ingresá un correo válido");
				return;
			}

			// TODO: llamada REST/OData a tu backend
			// fetch("/api/password-reset", { method:"POST", body: JSON.stringify({email:sMail}) })

			MessageToast.show("Si el correo existe, recibirás un enlace para restablecer la contraseña");
			this.byId("emailForgot").setValue("");
		}

	});
});

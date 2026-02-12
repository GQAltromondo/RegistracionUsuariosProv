sap.ui.define([
	"sacde/RegistracionUsuariosProv/controller/BaseController",
	"sap/m/MessageBox"
], function (BaseController, MessageBox) {
	"use strict";

	return BaseController.extend("sacde.RegistracionUsuariosProv.controller.ResetPassword", {

		onInit: function () {
			this.getRouter().getRoute("ResetPassword").attachPatternMatched(this._onRouteMatched, this);
		},

		_onRouteMatched: function (oEvent) {
			const oParams = oEvent.getParameter("arguments");
			this._token = oParams.token;
		},

		onChangePassword: function () {
			const oView = this.getView();
			const sNewPassword = oView.byId("newPassword").getValue();
			const sConfirmPassword = oView.byId("confirmPassword").getValue();
			const oMessageStrip = oView.byId("messageStrip");

			if (!sNewPassword || !sConfirmPassword) {
				MessageBox.error("Todos los campos son obligatorios.");
				return;
			}

			if (sNewPassword !== sConfirmPassword) {
				MessageBox.error("Las contraseñas no coinciden.");
				return;
			}

			// TODO: llamar servicio real para actualizar la contraseña
			// this._sendResetPassword(this._token, sNewPassword);

			oMessageStrip.setType("Success");
			oMessageStrip.setText("La contraseña ha sido restablecida correctamente.");
			oMessageStrip.setVisible(true);
		}

	});
});

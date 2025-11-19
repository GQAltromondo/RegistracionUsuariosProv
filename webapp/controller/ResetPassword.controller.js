sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/m/MessageBox"
], function (Controller, MessageBox) {
  "use strict";

  return Controller.extend("sacde.RegistracionUsuariosProv.controller.ResetPassword", {
    onInit: function () {
      const oComponent = this.getOwnerComponent();
      const oRouter = oComponent.getRouter();
      oRouter.getRoute("ResetPassword").attachPatternMatched(this._onRouteMatched, this);
    },

    _onRouteMatched: function (oEvent) {
      const oParams = oEvent.getParameter("arguments");
      this._token = oParams.token;

      // Podrías llamar a un servicio para validar que el token esté activo
      // Ejemplo: this._validateToken(this._token);
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

      // Aquí se puede llamar un servicio real para actualizar la contraseña
      // Por ejemplo:
      // this._sendResetPassword(this._token, sNewPassword);

      oMessageStrip.setType("Success");
      oMessageStrip.setText("La contraseña ha sido restablecida correctamente.");
      oMessageStrip.setVisible(true);
    },

    // Simulación de backend
    _sendResetPassword: function (token, newPassword) {
      // Lógica para enviar al backend el token y la nueva contraseña
    }
  });
});
